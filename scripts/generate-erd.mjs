import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const config = {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "anla",
  password: process.env.PGPASSWORD || "070078",
  database: process.env.PGDATABASE || "qashierwise",
};

const OUTPUT_PATH = path.join(process.cwd(), "public", "erd-data.json");

const client = new Client(config);

const queryTables = `
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_type = 'BASE TABLE'
    AND table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY table_schema, table_name;
`;

const queryColumns = `
  SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
  FROM information_schema.columns
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY table_schema, table_name, ordinal_position;
`;

const queryForeignKeys = `
  SELECT
    tc.constraint_name,
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY tc.table_schema, tc.table_name, tc.constraint_name;
`;

const tableKey = (schema, name) => `${schema}.${name}`;

const run = async () => {
  await client.connect();

  const [tablesRes, columnsRes, fksRes] = await Promise.all([
    client.query(queryTables),
    client.query(queryColumns),
    client.query(queryForeignKeys),
  ]);

  const tables = new Map();

  for (const row of tablesRes.rows) {
    const key = tableKey(row.table_schema, row.table_name);
    tables.set(key, {
      schema: row.table_schema,
      name: row.table_name,
      columns: [],
    });
  }

  for (const col of columnsRes.rows) {
    const key = tableKey(col.table_schema, col.table_name);
    const table = tables.get(key);
    if (!table) continue;
    table.columns.push({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === "YES",
      default: col.column_default || null,
      ordinal: col.ordinal_position,
    });
  }

  const relations = fksRes.rows.map((fk) => ({
    name: fk.constraint_name,
    from: {
      schema: fk.table_schema,
      table: fk.table_name,
      column: fk.column_name,
    },
    to: {
      schema: fk.foreign_table_schema,
      table: fk.foreign_table_name,
      column: fk.foreign_column_name,
    },
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    database: config.database,
    tables: Array.from(tables.values()),
    relations,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  await client.end();
};

run().catch(async (error) => {
  console.error("Failed to generate ERD data:", error);
  try {
    await client.end();
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});
