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
  SELECT n.nspname AS table_schema, c.relname AS table_name
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'f')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY n.nspname, c.relname;
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
    kcu.ordinal_position,
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
  ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;
`;

const queryUniqueConstraints = `
  SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    kcu.ordinal_position
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
  ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;
`;

const tableKey = (schema, name) => `${schema}.${name}`;

const run = async () => {
  await client.connect();

  const tablesRes = await client.query(queryTables);
  const columnsRes = await client.query(queryColumns);
  const fksRes = await client.query(queryForeignKeys);
  const uniqueRes = await client.query(queryUniqueConstraints);

  const tables = new Map();

  for (const row of tablesRes.rows) {
    const key = tableKey(row.table_schema, row.table_name);
    tables.set(key, {
      schema: row.table_schema,
      name: row.table_name,
      columns: [],
    });
  }

  const nullableMap = new Map();

  for (const col of columnsRes.rows) {
    const key = tableKey(col.table_schema, col.table_name);
    const table = tables.get(key);
    if (!table) continue;
    nullableMap.set(`${key}.${col.column_name}`, col.is_nullable === "YES");
    table.columns.push({
      name: col.column_name,
      type: col.data_type,
      nullable: col.is_nullable === "YES",
      default: col.column_default || null,
      ordinal: col.ordinal_position,
    });
  }

  const uniqueMap = new Map();

  for (const row of uniqueRes.rows) {
    const key = tableKey(row.table_schema, row.table_name);
    const mapKey = `${key}.${row.constraint_name}`;
    if (!uniqueMap.has(mapKey)) {
      uniqueMap.set(mapKey, []);
    }
    uniqueMap.get(mapKey).push(row.column_name);
  }

  const uniqueSetsByTable = new Map();
  for (const [constraintKey, columns] of uniqueMap.entries()) {
    const tableKeyPart = constraintKey.split(".").slice(0, 2).join(".");
    if (!uniqueSetsByTable.has(tableKeyPart)) {
      uniqueSetsByTable.set(tableKeyPart, []);
    }
    uniqueSetsByTable.get(tableKeyPart).push(columns);
  }

  const relationsMap = new Map();

  for (const fk of fksRes.rows) {
    const mapKey = `${fk.table_schema}.${fk.table_name}.${fk.constraint_name}`;
    if (!relationsMap.has(mapKey)) {
      relationsMap.set(mapKey, {
        name: fk.constraint_name,
        from: {
          schema: fk.table_schema,
          table: fk.table_name,
          columns: [],
        },
        to: {
          schema: fk.foreign_table_schema,
          table: fk.foreign_table_name,
          columns: [],
        },
        isUnique: false,
        isNullable: false,
      });
    }
    const relation = relationsMap.get(mapKey);
    relation.from.columns.push(fk.column_name);
    relation.to.columns.push(fk.foreign_column_name);
  }

  for (const relation of relationsMap.values()) {
    const tableKeyPart = tableKey(relation.from.schema, relation.from.table);
    const uniqueSets = uniqueSetsByTable.get(tableKeyPart) || [];
    const fkColumns = [...relation.from.columns].sort();
    relation.isUnique = uniqueSets.some((cols) => {
      const sorted = [...cols].sort();
      if (sorted.length !== fkColumns.length) return false;
      return sorted.every((col, idx) => col === fkColumns[idx]);
    });
    relation.isNullable = relation.from.columns.some((column) =>
      nullableMap.get(`${tableKeyPart}.${column}`)
    );
  }

  const relations = Array.from(relationsMap.values());

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
