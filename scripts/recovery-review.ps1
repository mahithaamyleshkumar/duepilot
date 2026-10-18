
$ErrorActionPreference = "Stop"

$apiUrl = "https://duepilot-api.onrender.com/api/invoices"
$today = (Get-Date).Date
$reportDate = $today.ToString("yyyy-MM-dd")

Write-Host "`nFetching live DuePilot invoices..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Get
    if (-not $response.success -or $null -eq $response.invoices) {
        throw "The API returned an unexpected response."
    }
}
catch {
    Write-Host "Could not fetch invoices: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$invoices = @($response.invoices)

$unpaid = @($invoices | Where-Object {
    $_.status -and $_.status.Trim() -ne "Paid"
})

$overdue = @(
    foreach ($invoice in $unpaid) {
        $dueDate = [datetime]::MinValue
        $validDate = [datetime]::TryParse(
            [string]$invoice.dueDate,
            [ref]$dueDate
        )

        if ($invoice.status.Trim() -eq "Overdue" -or
            ($validDate -and $dueDate.Date -lt $today)) {
            $daysOverdue = 0
            if ($validDate -and $dueDate.Date -lt $today) {
                $daysOverdue = ($today - $dueDate.Date).Days
            }

            [PSCustomObject]@{
                Client       = $invoice.client
                Project      = $invoice.project
                Amount       = [decimal]$invoice.amount
                DueDate      = $invoice.dueDate
                Status       = $invoice.status
                DaysOverdue  = $daysOverdue
                SuggestedAction = "Review and prepare a payment reminder"
            }
        }
    }
)

$upcoming = @(
    foreach ($invoice in $unpaid) {
        $dueDate = [datetime]::MinValue
        $validDate = [datetime]::TryParse(
            [string]$invoice.dueDate,
            [ref]$dueDate
        )

        if ($validDate) {
            $daysUntilDue = ($dueDate.Date - $today).Days

            if ($daysUntilDue -ge 0 -and
                $daysUntilDue -le 3 -and
                $invoice.status.Trim() -ne "Overdue") {
                [PSCustomObject]@{
                    Client       = $invoice.client
                    Project      = $invoice.project
                    Amount       = [decimal]$invoice.amount
                    DueDate      = $invoice.dueDate
                    Status       = $invoice.status
                    DaysUntilDue = $daysUntilDue
                }
            }
        }
    }
)

$overdue = @($overdue | Sort-Object DaysOverdue -Descending)
$upcoming = @($upcoming | Sort-Object DueDate)

$totalOutstanding = [decimal](($unpaid | Measure-Object -Property amount -Sum).Sum)
$overdueAmount = [decimal](($overdue | Measure-Object -Property Amount -Sum).Sum)

$summary = [PSCustomObject]@{
    ReportDate          = $reportDate
    TotalInvoices       = $invoices.Count
    UnpaidInvoices      = $unpaid.Count
    OverdueInvoices     = $overdue.Count
    UpcomingInvoices    = $upcoming.Count
    TotalOutstandingINR = $totalOutstanding
    OverdueAmountINR    = $overdueAmount
    Mode                = "Read-only"
}

Write-Host "`n========== DUEPILOT RECOVERY REVIEW ==========" -ForegroundColor Cyan
$summary | Format-List

Write-Host "--- OVERDUE PRIORITIES ---" -ForegroundColor Yellow
if ($overdue.Count -gt 0) {
    $overdue | Format-Table Client, Project, Amount, DueDate, DaysOverdue -AutoSize
} else {
    Write-Host "No overdue unpaid invoices."
}

Write-Host "--- UPCOMING PAYMENTS (NEXT 3 DAYS) ---" -ForegroundColor Green
if ($upcoming.Count -gt 0) {
    $upcoming | Format-Table Client, Project, Amount, DueDate, DaysUntilDue -AutoSize
} else {
    Write-Host "No upcoming payments in the next 3 days."
}

$reportFolder = Join-Path $PSScriptRoot "reports"
New-Item -ItemType Directory -Force -Path $reportFolder | Out-Null

$summaryPath = Join-Path $reportFolder "recovery-summary-$reportDate.csv"
$invoicePath = Join-Path $reportFolder "recovery-invoices-$reportDate.csv"

$summary | Export-Csv -Path $summaryPath -NoTypeInformation -Encoding UTF8

$reportRows = @(
    foreach ($invoice in $invoices) {
        [PSCustomObject]@{
            ReportDate = $reportDate
            Client     = $invoice.client
            Project    = $invoice.project
            Amount     = $invoice.amount
            DueDate    = $invoice.dueDate
            Status     = $invoice.status
            Priority   = if ($invoice.status.Trim() -eq "Paid") {
                "Paid"
            } elseif ($overdue.Client -contains $invoice.client) {
                "Overdue"
            } elseif ($upcoming.Client -contains $invoice.client) {
                "Upcoming"
            } else {
                "Open"
            }
        }
    }
)

$reportRows | Export-Csv -Path $invoicePath -NoTypeInformation -Encoding UTF8

Write-Host "`nReports saved:" -ForegroundColor Cyan
Write-Host $summaryPath
Write-Host $invoicePath
Write-Host "`nRead-only report complete. No invoice data was changed."
