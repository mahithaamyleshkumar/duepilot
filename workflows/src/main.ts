
import { task, type TaskContext } from "@renderinc/sdk/workflows";

const API_URL =
  process.env.DUEPILOT_API_URL ||
  "https://duepilot-api.onrender.com";

type Invoice = {
  id: string;
  client: string;
  project: string;
  amount: number;
  dueDate: string;
  status: string;
  daysOverdue: number;
};

type InvoiceResponse = {
  success: boolean;
  count: number;
  invoices: Invoice[];
};

const fetchInvoices = task(
  {
    name: "fetchInvoices",
    retry: {
      maxRetries: 3,
      waitDurationMs: 2000,
      backoffScaling: 2,
    },
    timeoutSeconds: 60,
  },
  async function fetchInvoices(
    _ctx: TaskContext,
  ): Promise<Invoice[]> {
    const response = await fetch(`${API_URL}/api/invoices`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      throw new Error(
        `DuePilot API returned HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as InvoiceResponse;

    if (!data.success || !Array.isArray(data.invoices)) {
      throw new Error("The invoice API returned an unexpected response.");
    }

    return data.invoices;
  },
);

const buildRecoveryReport = task(
  {
    name: "buildRecoveryReport",
    timeoutSeconds: 60,
  },
  function buildRecoveryReport(
    _ctx: TaskContext,
    invoices: Invoice[],
  ) {
    const today = new Date();
    const todayUTC = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );

    const unpaid = invoices.filter(
      (invoice) => invoice.status.toLowerCase() !== "paid",
    );

    const overdue = unpaid
      .filter((invoice) => {
        const due = Date.parse(`${invoice.dueDate}T00:00:00Z`);
        return (
          invoice.status.toLowerCase() === "overdue" ||
          (!Number.isNaN(due) && due < todayUTC)
        );
      })
      .map((invoice) => ({
        id: invoice.id,
        client: invoice.client,
        project: invoice.project,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        daysOverdue: Math.max(
          0,
          Number(invoice.daysOverdue) || 0,
          Math.floor(
            (todayUTC -
              Date.parse(`${invoice.dueDate}T00:00:00Z`)) /
              86400000,
          ),
        ),
        suggestedAction: "Review and prepare a payment reminder",
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const upcoming = unpaid.filter((invoice) => {
      const due = Date.parse(`${invoice.dueDate}T00:00:00Z`);
      const daysUntilDue = Math.ceil((due - todayUTC) / 86400000);

      return (
        !Number.isNaN(due) &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 3 &&
        invoice.status.toLowerCase() !== "overdue"
      );
    });

    return {
      report: "DuePilot Recovery Review",
      generatedAt: new Date().toISOString(),
      mode: "read-only",
      summary: {
        totalInvoices: invoices.length,
        unpaidInvoices: unpaid.length,
        overdueInvoices: overdue.length,
        upcomingInvoices: upcoming.length,
        overdueAmount: overdue.reduce(
          (total, invoice) => total + invoice.amount,
          0,
        ),
        totalOutstandingAmount: unpaid.reduce(
          (total, invoice) => total + invoice.amount,
          0,
        ),
        currency: "INR",
      },
      priorities: overdue,
      upcomingPayments: upcoming.map((invoice) => ({
        id: invoice.id,
        client: invoice.client,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
      })),
      limitations: [
        "Recovery priorities are based on invoice status and due dates.",
        "This report does not predict whether a client will pay.",
        "No emails are sent and no invoice statuses are changed.",
      ],
    };
  },
);

task(
  {
    name: "runRecoveryReview",
    retry: {
      maxRetries: 2,
      waitDurationMs: 3000,
      backoffScaling: 2,
    },
    timeoutSeconds: 120,
  },
  async function runRecoveryReview(ctx: TaskContext) {
    const invoices = await ctx.run(fetchInvoices);
    const report = await ctx.run(buildRecoveryReport, invoices);

    console.log("DuePilot recovery report generated.");
    console.log(JSON.stringify(report, null, 2));

    return report;
  },
);
