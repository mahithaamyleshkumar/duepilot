
const pool = require("./db");

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(30) PRIMARY KEY,
        client VARCHAR(150) NOT NULL,
        initials VARCHAR(10) NOT NULL,
        project VARCHAR(200) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        due_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL
          CHECK (status IN ('Overdue', 'Due soon', 'Paid', 'Open')),
        days_overdue INTEGER NOT NULL DEFAULT 0,
        email VARCHAR(255) NOT NULL
      );
    `);

    console.log("Invoices table created or already exists.");
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initializeDatabase();
