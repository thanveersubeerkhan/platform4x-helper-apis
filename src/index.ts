import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Context, Hono } from 'hono'
import { sql, ensureTableExists } from './db.js'
import cleanEmail from './email_cleaner/index.js'

import { hasArabic } from './text_utils.js'

// --- 🔹 Schema Definitions ---
export interface SuccessResponse {
  success: boolean
}

export interface ErrorResponse {
  error: string
}

export interface TokenResponse {
  access_token: string
  expires_at: string
  is_expired: boolean
  should_refresh: boolean
  remaining_seconds: number
  remaining_minutes: number
}

export interface NewExpiryResponse {
  base_time: string
  new_expiry: string
}

export interface SubscriptionRenewResponse {
  subscription_id: string
  current_expiry: string
  remaining_minutes: number
  remaining_seconds: number
  is_expired: boolean
  is_expiring_soon: boolean
  new_expiry: string
}
// ----------------------------

const app = new Hono()

// Ensure table exists on startup
ensureTableExists().catch((err) => {
  console.error('Failed to initialize database table:', err)
})

/**
 * 🔹 POST /token
 * Insert or update token
 */
app.post('/token', async (c: Context) => {
  try {
    const { access_token, expires_at, expires_in } = await c.req.json()

    if (!access_token) {
      return c.json({ error: 'Missing access_token' }, 400)
    }

    let calculatedExpiry: string

    if (expires_in && typeof expires_in === 'number') {
      // Calculate expires_at: Current Time + X seconds
      const expiryDate = new Date()
      expiryDate.setSeconds(expiryDate.getSeconds() + expires_in)
      calculatedExpiry = expiryDate.toISOString()
    } else if (expires_at) {
      calculatedExpiry = expires_at
    } else {
      return c.json({ error: 'Missing expires_at or expires_in' }, 400)
    }

    await sql`
      INSERT INTO graph_token_store (id, access_token, expires_at)
      VALUES (1, ${access_token}, ${calculatedExpiry})
      ON CONFLICT (id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `

    return c.json({ success: true } as SuccessResponse)

  } catch (err) {
    console.error('Token save error:', err)
    return c.json({ error: 'Failed to save token' } as ErrorResponse, 500)
  }
})

/**
 * 🔹 GET /token
 * Get token + expiry + status + remaining time
 */
app.get('/token', async (c: Context) => {
  try {
    const result = await sql`
      SELECT 
        access_token,
        expires_at,
        NOW() >= expires_at AS is_expired,
        NOW() >= (expires_at - INTERVAL '5 minutes') AS should_refresh,
        EXTRACT(EPOCH FROM (expires_at - NOW())) AS remaining_seconds,
        FLOOR(EXTRACT(EPOCH FROM (expires_at - NOW())) / 60) AS remaining_minutes
      FROM graph_token_store
      WHERE id = 1
    `

    if (result.length === 0) {
      return c.json({ error: 'No token found' }, 404)
    }

    return c.json(result[0])

  } catch (err) {
    console.error('Token fetch error:', err)
    return c.json({ error: 'Failed to fetch token' }, 500)
  }
})

/**
 * 🔹 GET /token/new-expiry
 * Generate new expiry (Base + 55 min)
 */
app.get('/token/new-expiry', async (c: Context) => {
  try {
    // Single query to handle both the base_time retrieval and calculation
    const result = await sql`
      SELECT 
        COALESCE(expires_at, NOW()) AS base_time,
        COALESCE(expires_at, NOW()) + INTERVAL '55 minutes' AS new_expiry
      FROM (SELECT 1) AS dummy
      LEFT JOIN graph_token_store ON id = 1
    `

    return c.json(result[0])

  } catch (err) {
    console.error('Expiry calculation error:', err)
    return c.json({ error: 'Failed to generate expiry' }, 500)
  }
})

/**
 * 🔹 GET /subscription/latest
 * Get renewal info for the most recently updated subscription
 */
app.get('/subscription/latest', async (c: Context) => {
  try {
    const result = await sql`
      WITH latest_sub AS (
        SELECT subscription_id 
        FROM graph_subscription_store 
        ORDER BY updated_at DESC 
        LIMIT 1
      ),
      sub_state AS (
        SELECT 
          s.subscription_id,
          s.expiration_date_time AS current_expiry,
          EXTRACT(EPOCH FROM (s.expiration_date_time - NOW())) AS rem_seconds,
          FLOOR(EXTRACT(EPOCH FROM (s.expiration_date_time - NOW())) / 60) AS rem_minutes,
          NOW() >= s.expiration_date_time AS expired_flag,
          NOW() >= (s.expiration_date_time - INTERVAL '20 minutes') AS expiring_soon_flag
        FROM graph_subscription_store s
        JOIN latest_sub l ON s.subscription_id = l.subscription_id
      )
      SELECT 
        *,
        (CASE 
          WHEN current_expiry < NOW() THEN NOW()
          ELSE current_expiry
        END + INTERVAL '55 minutes') AS calculated_new_expiry
      FROM sub_state
    `

    if (result.length === 0) {
      return c.json({ error: 'No subscriptions found' } as ErrorResponse, 404)
    }

    const row = result[0]

    return c.json({
      subscription_id: row.subscription_id,
      current_expiry: row.current_expiry,
      remaining_minutes: Number(row.rem_minutes),
      remaining_seconds: Number(row.rem_seconds),
      is_expired: row.expired_flag,
      is_expiring_soon: row.expiring_soon_flag,
      new_expiry: row.calculated_new_expiry
    } as SubscriptionRenewResponse)

  } catch (err) {
    console.error('Failed to get latest subscription:', err)
    return c.json({ error: 'Failed to process latest subscription' } as ErrorResponse, 500)
  }
})

/**
 * 🔹 GET /subscriptions
 * List all tracked subscriptions
 */
app.get('/subscriptions', async (c: Context) => {
  try {
    const result = await sql`
      SELECT 
        subscription_id, 
        expiration_date_time, 
        updated_at 
      FROM graph_subscription_store 
      ORDER BY updated_at DESC
    `
    return c.json(result)
  } catch (err) {
    console.error('Failed to list subscriptions:', err)
    return c.json({ error: 'Failed to list subscriptions' } as ErrorResponse, 500)
  }
})

/**
 * 🔹 POST /subscription
 * Insert or update subscription state
 */
app.post('/subscription', async (c: Context) => {
  try {
    const { subscription_id, expiration_date_time } = await c.req.json()

    if (!subscription_id || !expiration_date_time) {
      return c.json({ error: 'Missing subscription_id or expiration_date_time' } as ErrorResponse, 400)
    }

    await sql`
      INSERT INTO graph_subscription_store (subscription_id, expiration_date_time)
      VALUES (${subscription_id}, ${expiration_date_time})
      ON CONFLICT (subscription_id)
      DO UPDATE SET
        expiration_date_time = EXCLUDED.expiration_date_time,
        updated_at = NOW()
    `

    return c.json({ success: true } as SuccessResponse)

  } catch (err) {
    console.error('Subscription save error:', err)
    return c.json({ error: 'Failed to save subscription' } as ErrorResponse, 500)
  }
})

/**
 * 🔹 GET /subscription/renew/:id
 * Deterministic renewal logic: Get subscription state + calculated renewal window.
 */
app.get('/subscription/renew/:id', async (c: Context) => {
  try {
    const subId = c.req.param('id') as string

    // Single consolidated query to get current state and next expiry (55 min rule)
    const result = await sql`
      WITH sub_state AS (
        SELECT 
          subscription_id,
          expiration_date_time AS current_expiry,
          -- remaining time
          EXTRACT(EPOCH FROM (expiration_date_time - NOW())) AS rem_seconds,
          FLOOR(EXTRACT(EPOCH FROM (expiration_date_time - NOW())) / 60) AS rem_minutes,
          -- flags
          NOW() >= expiration_date_time AS expired_flag,
          NOW() >= (expiration_date_time - INTERVAL '20 minutes') AS expiring_soon_flag
        FROM graph_subscription_store
        WHERE subscription_id = ${subId}
      )
      SELECT 
        *,
        -- next expiry logic: Current OR NOW + 55 min
        (CASE 
          WHEN current_expiry < NOW() THEN NOW()
          ELSE current_expiry
        END + INTERVAL '55 minutes') AS calculated_new_expiry
      FROM sub_state
    `

    if (result.length === 0) {
      return c.json({ error: 'Subscription not found' } as ErrorResponse, 404)
    }

    const row = result[0]

    return c.json({
      subscription_id: row.subscription_id,
      current_expiry: row.current_expiry,
      remaining_minutes: Number(row.rem_minutes),
      remaining_seconds: Number(row.rem_seconds),
      is_expired: row.expired_flag,
      is_expiring_soon: row.expiring_soon_flag,
      new_expiry: row.calculated_new_expiry
    } as SubscriptionRenewResponse)

  } catch (err) {
    console.error('Subscription renewal check error:', err)
    return c.json({ error: 'Failed to process subscription' } as ErrorResponse, 500)
  }
})

/**
 * 🔹 POST /email/clean
 * Raw email HTML cleaning
 */
app.post('/email/clean', async (c: Context) => {
  try {
    const { htmlBody, config } = await c.req.json()
    if (!htmlBody) {
      return c.json({ error: 'Missing htmlBody' }, 400)
    }

    const cleaned = cleanEmail(htmlBody, config)
    return c.json(cleaned)

  } catch (err) {
    console.error('Email clean error:', err)
    return c.json({ error: 'Failed to clean email' }, 500)
  }
})

/**
 * 🔹 GET /email/fetch-latest
 * Fetch latest emails and clean them
 */


/**
 * 🔹 POST /text/has-arabic
 * Check if the given text contains Arabic characters
 */
app.post('/text/has-arabic', async (c: Context) => {
  try {
    const { text } = await c.req.json()
    return c.json({
      has_arabic: hasArabic(text)
    })
  } catch (err) {
    console.error('Arabic check error:', err)
    return c.json({ error: 'Failed to process Arabic check' }, 500)
  }
})

/**
 * 🔹 Health check
 */
app.get('/', (c: Context) => {
  return c.text('Token & Email Service Running')
})

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})

