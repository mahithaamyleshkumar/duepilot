
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");
const { generateReminder } = require("./ai");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Format PostgreSQL invoice rows for the React frontend.
function formatInvoice(row) {
  return {
    id: row.id,
    client: row.client,
    initials: row.initials,
    project: row.project,
    amount: Number(row.amount),
    dueDate:
      row.due_date instanceof Date
        ? row.due_date.toISOString().slice(0, 10)
        : String(row.due_date).slice(0, 10),
    status: row.status,
    daysOverdue: row.days_overdue,
    email: row.email,
  };
}

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "DuePilot API",
    status: "healthy",
    message: "DuePilot payment recovery API is running.",
  });
});

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected",
      aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  } catch (error) {
    console.error("Health check failed:", error.message);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

// Get all invoices
app.get("/api/invoices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, client, initials, project, amount,
             due_date, status, days_overdue, email
      FROM invoices
      ORDER BY due_date ASC
    `);

    const invoices = result.rows.map(formatInvoice);

    res.json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (error) {
    console.error("Fetching invoices failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch invoices.",
    });
  }
});

// Get one invoice
app.get("/api/invoices/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, client, initials, project, amount,
              due_date, status, days_overdue, email
       FROM invoices
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    res.json({
      success: true,
      invoice: formatInvoice(result.rows[0]),
    });
  } catch (error) {
    console.error("Fetching invoice failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not fetch invoice.",
    });
  }
});

// Manually mark an invoice as paid.
// This does not independently verify a bank transfer.
app.patch("/api/invoices/:id/paid", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE invoices
       SET status = 'Paid', days_overdue = 0
       WHERE id = $1
       RETURNING id, client, initials, project, amount,
                 due_date, status, days_overdue, email`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    res.json({
      success: true,
      message: "Invoice marked as paid.",
      invoice: formatInvoice(result.rows[0]),
    });
  } catch (error) {
    console.error("Updating invoice failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update invoice.",
    });
  }
});

// Generate an AI reminder or use the template fallback.
app.post("/api/invoices/:id/reminder", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, client, initials, project, amount,
              due_date, status, days_overdue, email
       FROM invoices
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found.",
      });
    }

    const invoice = formatInvoice(result.rows[0]);

    if (invoice.status === "Paid") {
      return res.status(400).json({
        success: false,
        message: "This invoice is already marked as paid.",
      });
    }

    // generateReminder returns:
    // { reminder, source, note }
    const draft = await generateReminder(invoice);

    res.json({
      success: true,
      invoiceId: invoice.id,
      reminder: draft.reminder,
      source: draft.source,
      note: draft.note,
    });
  } catch (error) {
    console.error("Reminder endpoint failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not create a reminder. Please try again.",
    });
  }
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

// Handle unexpected errors
app.use((error, req, res, next) => {
  console.error("Unexpected API error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`DuePilot API running on port ${PORT}`);
});

// Graceful shutdown
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  server.close(async () => {
    try {
      await pool.end();
      console.log("DuePilot server shut down safely.");
      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
