
import type { Invoice } from "./api";

export type RecoveryAssessment = {
  invoice: Invoice;
  score: number;
  priority: "Critical" | "High" | "Moderate" | "Low";
  daysOverdue: number;
  reason: string;
  nextAction: string;
};

function getCalendarDaysOverdue(invoice: Invoice): number {
  if (invoice.status !== "Overdue") {
    return 0;
  }

  // Use calendar dates, avoiding time-of-day and timezone differences.
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const due = new Date(`${invoice.dueDate.slice(0, 10)}T00:00:00`);
  const dueUtc = Date.UTC(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  );

  const calculatedDays = Number.isFinite(dueUtc)
    ? Math.max(0, Math.floor((todayUtc - dueUtc) / 86_400_000))
    : 0;

  // Keep the stored value as a fallback if an invoice date is inconsistent.
  return Math.max(0, calculatedDays, invoice.daysOverdue || 0);
}

function calculateScore(
  invoice: Invoice,
  daysOverdue: number,
): number {
  if (invoice.status === "Paid") {
    return 0;
  }

  let score = 0;

  if (invoice.status === "Overdue") {
    score += 35;
    score += Math.min(daysOverdue * 2, 40);
  } else if (invoice.status === "Due soon") {
    score += 18;
  } else {
    score += 8;
  }

  // Higher-value invoices get additional attention, capped at 20 points.
  const amount = Math.max(0, Number(invoice.amount) || 0);
  score += Math.min(20, Math.round(Math.log10(amount + 1) * 3));

  return Math.min(100, score);
}

function getPriority(score: number): RecoveryAssessment["priority"] {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

function getExplanation(
  invoice: Invoice,
  daysOverdue: number,
): { reason: string; nextAction: string } {
  if (invoice.status === "Overdue") {
    return {
      reason:
        daysOverdue > 0
          ? `Overdue by ${daysOverdue} calendar day${daysOverdue === 1 ? "" : "s"}. The invoice is still unpaid.`
          : "Marked overdue but its due date is today or in the future. Verify the invoice date and status.",
      nextAction:
        daysOverdue >= 7
          ? "Send a polite follow-up and ask the client to confirm a payment date."
          : "Send a friendly payment reminder and request a status update.",
    };
  }

  if (invoice.status === "Due soon") {
    return {
      reason: "The invoice is approaching its due date and is not marked paid.",
      nextAction: "Send a courteous pre-due reminder or confirm the payment schedule.",
    };
  }

  return {
    reason: "The invoice is unpaid but is not currently marked overdue.",
    nextAction: "Confirm the due date and agreed payment terms before following up.",
  };
}

export function assessRecovery(
  invoice: Invoice,
): RecoveryAssessment {
  const daysOverdue = getCalendarDaysOverdue(invoice);
  const score = calculateScore(invoice, daysOverdue);
  const explanation = getExplanation(invoice, daysOverdue);

  return {
    invoice,
    score,
    priority: getPriority(score),
    daysOverdue,
    ...explanation,
  };
}

export function rankRecoveryInvoices(
  invoices: Invoice[],
): RecoveryAssessment[] {
  return invoices
    .filter((invoice) => invoice.status !== "Paid")
    .map(assessRecovery)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.daysOverdue - a.daysOverdue;
    });
}
