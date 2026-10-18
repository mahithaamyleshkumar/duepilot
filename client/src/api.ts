
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export type InvoiceStatus = "Overdue" | "Due soon" | "Paid" | "Open";

export type Invoice = {
  id: string;
  client: string;
  initials: string;
  project: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  daysOverdue: number;
  email: string;
};

type InvoiceResponse = {
  success: boolean;
  count?: number;
  invoices?: Invoice[];
  invoice?: Invoice;
  message?: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

export async function getInvoices(): Promise<Invoice[]> {
  const result = await request<InvoiceResponse>("/api/invoices");
  return result.invoices ?? [];
}

export async function markInvoicePaid(id: string): Promise<Invoice> {
  const result = await request<InvoiceResponse>(
    `/api/invoices/${encodeURIComponent(id)}/paid`,
    { method: "PATCH" },
  );

  if (!result.invoice) {
    throw new Error(result.message || "The server did not return the invoice.");
  }

  return result.invoice;
}

export type ReminderResponse = {
  success: boolean;
  invoiceId: string;
  reminder: string;
  source: "gemini" | "template";
  note: string;
};

export async function generateReminder(
  id: string
): Promise<ReminderResponse> {
  return request<ReminderResponse>(
    `/api/invoices/${encodeURIComponent(id)}/reminder`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

