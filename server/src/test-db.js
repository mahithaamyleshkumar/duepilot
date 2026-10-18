
const pool = require("./db");

async function testDatabase() {
  console.log("Testing DuePilot PostgreSQL connection...\n");

  try {
    // 1. Test the database connection
    const connectionResult = await pool.query(
      "SELECT NOW() AS server_time, CURRENT_DATABASE() AS database_name"
    );

    console.log("Database connection: SUCCESS");
    console.log("Database name:", connectionResult.rows[0].database_name);
    console.log("Database server time:", connectionResult.rows[0].server_time);

    // 2. Check whether the invoices table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'invoices'
      ) AS table_exists
    `);

    if (!tableResult.rows[0].table_exists) {
      console.log("\nInvoices table: NOT FOUND");
      console.log("Run the database initialization script before testing invoices.");
      return;
    }

    console.log("\nInvoices table: FOUND");

    // 3. Count invoices without changing anything
    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total FROM invoices"
    );

    console.log("Total invoices:", countResult.rows[0].total);

    // 4. Show a summary of invoice statuses
    const statusResult = await pool.query(`
      SELECT status, COUNT(*)::int AS total
      FROM invoices
      GROUP BY status
      ORDER BY status
    `);

    console.log("\nInvoice status summary:");

    if (statusResult.rows.length === 0) {
      console.log("No invoices found.");
    } else {
      console.table(statusResult.rows);
    }

    console.log("\nDatabase test completed successfully.");
  } catch (error) {
    console.error("\nDatabase test FAILED.");
    console.error("Error:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabase();
