import postgres from 'postgres'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}

export const sql = postgres(connectionString, {
  ssl: 'require',
})

export const ensureTableExists = async () => {
  // 🔹 Create graph_token_store
  await sql`
    CREATE TABLE IF NOT EXISTS graph_token_store (
      id INT PRIMARY KEY,
      access_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `

  await sql`
    ALTER TABLE graph_token_store 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
  `

  // 🔹 Create graph_subscription_store
  await sql`
    CREATE TABLE IF NOT EXISTS graph_subscription_store (
      subscription_id TEXT PRIMARY KEY,
      expiration_date_time TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `

  await sql`
    ALTER TABLE graph_subscription_store 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
  `

  // 🔹 Create message_ids
  await sql`
    CREATE TABLE IF NOT EXISTS message_ids (
      message_id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
}
