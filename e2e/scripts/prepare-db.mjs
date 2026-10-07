// Creates the e2e database if it does not exist yet.
import pg from "pg";
import { DB_ADMIN_URL, DB_NAME } from "../stack.config.mjs";

const client = new pg.Client({ connectionString: DB_ADMIN_URL });
await client.connect();
try {
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [DB_NAME],
  );
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`Created database ${DB_NAME}`);
  }
} finally {
  await client.end();
}
