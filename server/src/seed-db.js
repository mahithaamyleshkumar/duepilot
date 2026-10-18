
const pool = require("./db");

const invoices = [
  {
    id: "INV-1042",
    client: "Northstar Studio",
    initials: "NS",
    project: "Brand identity",
    amount: 48500,
    dueDate: "2026-10-12",
    status: "Overdue",
    email: "accounts@northstar.example",
  },
  {
    id: "INV-1041",
    client: "Pixel & Co.",
    initials: "PC",
    project: "Website redesign",
    amount: 32000,
    dueDate: "2026-10-15",
    status: "Overdue",
    email: "finance@pixel.example",
  },
  {
    id: "INV-1040",
    client: "Greenline Labs",
    initials: "GL",
    project: "Product illustrations",
    amount: 18500,
    dueDate: "2026-10-19",
    status: "Due soon",
    email: "team@greenline.example",
  },
  {
    id: "INV-1039",
    client: "Monocle Media",
    initials: "MM",
    project: "Monthly retainer",
    amount: 54000,
    dueDate: "2026-10-22",
    status: "Open",
    email: "billing@monocle.example",
  },
  {
    id: "INV-1038",
    client: "Studio August",
    initials: "SA",
    project: "Campaign design",
    amount: 27000,
    dueDate: "2026-10-10",
    status: "Paid",
    email: "hello@august.example",
  },
];

async function seedDatabase() {
  try {
    for (const invoice of invoices) {
      await pool.query(
        `INSERT INTO invoices (
          id,
          client,
          initials,
          project,
          amount,
          due_date,
          status,
          days_overdue,
          email
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::date, $7::varchar,
          CASE
            WHEN $7::varchar = 'Overdue'
            THEN GREATEST(CURRENT_DATE - $6::date, 0)
            ELSE 0
          END,
          $8
        )
        ON CONFLICT (id) DO UPDATE SET
          client = EXCLUDED.client,
          initials = EXCLUDED.initials,
          project = EXCLUDED.project,
          amount = EXCLUDED.amount,
          due_date = EXCLUDED.due_date,
          status = EXCLUDED.status,
          days_overdue = CASE
            WHEN EXCLUDED.status::varchar = 'Overdue'
            THEN GREATEST(
              CURRENT_DATE - EXCLUDED.due_date,
              0
            )
            ELSE 0
          END,
          email = EXCLUDED.email`,
        [
          invoice.id,
          invoice.client,
          invoice.initials,
          invoice.project,
          invoice.amount,
          invoice.dueDate,
          invoice.status,
          invoice.email,
        ]
      );
    }

    const result = await pool.query(
      `SELECT
        id,
        client,
        due_date,
        status,
        days_overdue
      FROM invoices
      WHERE id = ANY($1::varchar[])
      ORDER BY id DESC`,
      [invoices.map((invoice) => invoice.id)]
    );

    console.log("\nDemo invoice data updated successfully.");
    console.table(
      result.rows.map((row) => ({
        id: row.id,
        client: row.client,
        dueDate: row.due_date,
        status: row.status,
        daysOverdue: row.days_overdue,
      }))
    );

    console.log(`Verified ${result.rows.length} demo invoices.`);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedDatabase();
