import { logger, schedules } from "@trigger.dev/sdk/v3";

const HOOK_BASE_URL = "https://platform4x-api-node.onrender.com/webhooks/http/ANY/catchHook";

/**
 * Common request logic for flow completion hooks.
 * Fire-and-forget logic (not awaiting full response body).
 */
async function triggerHook(flowId: string, label: string) {
  const url = `${HOOK_BASE_URL}?flowId=${flowId}`;
  const token = process.env.HOOK_AUTH_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwNjllNTQ0OS05OWIzLTQwODUtOWQwNi1kOGQxYTM2MDJlZDMiLCJlbWFpbCI6InRlc3RAbWFpbC5jb20iLCJyb2xlcyI6WyJzdXBlcl9hZG1pbiJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzc1NTcxMzAyLCJpc3MiOiJwbGF0Zm9ybTR4IiwiYXVkIjoicGxhdGZvcm00eCIsImV4cCI6MTc3NTU3MjIwMn0.sc4sU4jagUSwQGmVHKLpYmz6eyY7Ujc1NSolY8oaQM0";

  if (!token) {
    logger.error(`HOOK_AUTH_TOKEN not found for ${label} (${flowId})`);
    return;
  }

  logger.log(`Pulse for ${label} (flowId: ${flowId}): Firing hook...`);
  
  try {
    fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: "sample" })
    }).catch(err => {
      logger.error(`Error firing ${label} (${flowId}):`, { error: err });
    });
    
    logger.log(`Pulse for ${label} (${flowId}) sent.`);
  } catch (err) {
    logger.error(`Critical error in ${label} trigger:`, { error: err });
  }
}

/**
 * 🔹 Task: Renew Subscription
 * Flow ID: 1775129566877
 * Runs every 30 minutes.
 */
export const renewSubscriptionTask = schedules.task({
  id: "renew-subscription-1775129566877",
  cron: "*/70 * * * *",
  run: async () => {
    await triggerHook("1775129566877", "Renew Subscription");
  }
});

/**
 * 🔹 Task: Refresh Token
 * Flow ID: 1775125349554
 * Runs every 30 minutes.
 */
export const refreshTokenTask = schedules.task({
  id: "refresh-token-1775125349554",
  cron: "*/30 * * * *",
  run: async () => {
    await triggerHook("1775125349554", "Refresh Token");
  }
});
