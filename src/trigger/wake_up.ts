import { logger, schedules } from "@trigger.dev/sdk/v3";

/**
 * Scheduled task to ping the Helper APIs.
 * Runs every 2 minutes to keep the Render-hosted service awake.
 * Pings 3 times in parallel.
 */
export const wakeUpHelperApis = schedules.task({
  id: "wake-up-helper-apis",
  cron: "*/2 * * * *",
  run: async () => {
    const url = "https://platform4x-helper-apis.onrender.com";
    logger.log(`Pinging ${url} 3 times...`);
    try {
      const results = await Promise.all([
        fetch(url),
        fetch(url),
        fetch(url)
      ]);
      results.forEach((res, i) => logger.log(`Response ${i+1} from ${url}: ${res.status} ${res.statusText}`));
      return { url, results: results.map(res => ({ status: res.status, ok: res.ok })) };
    } catch (error) {
      logger.error(`Error pinging ${url}`, { error });
      throw error;
    }
  },
});

/**
 * Scheduled task to ping the AI Backend.
 * Runs every 2 minutes to keep the Render-hosted service awake.
 * Pings 3 times in parallel.
 */
export const wakeUpAiBackend = schedules.task({
  id: "wake-up-ai-backend",
  cron: "*/2 * * * *",
  run: async () => {
    const url = "https://platform4x-ai-backend.onrender.com";
    logger.log(`Pinging ${url} 3 times...`);
    try {
      const results = await Promise.all([
        fetch(url),
        fetch(url),
        fetch(url)
      ]);
      results.forEach((res, i) => logger.log(`Response ${i+1} from ${url}: ${res.status} ${res.statusText}`));
      return { url, results: results.map(res => ({ status: res.status, ok: res.ok })) };
    } catch (error) {
      logger.error(`Error pinging ${url}`, { error });
      throw error;
    }
  },
});

/**
 * Scheduled task to ping the API Node service.
 * Runs every 2 minutes to keep the Render-hosted service awake.
 * Pings 3 times in parallel.
 */
export const wakeUpApiNode = schedules.task({
  id: "wake-up-api-node",
  cron: "*/2 * * * *",
  run: async () => {
    const url = "https://platform4x-api-node.onrender.com";
    logger.log(`Pinging ${url} 3 times...`);
    try {
      const results = await Promise.all([
        fetch(url),
        fetch(url),
        fetch(url)
      ]);
      results.forEach((res, i) => logger.log(`Response ${i+1} from ${url}: ${res.status} ${res.statusText}`));
      return { url, results: results.map(res => ({ status: res.status, ok: res.ok })) };
    } catch (error) {
      logger.error(`Error pinging ${url}`, { error });
      throw error;
    }
  },
});
