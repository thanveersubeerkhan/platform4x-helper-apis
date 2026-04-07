import { logger, schedules, wait } from "@trigger.dev/sdk/v3";

const urls = [
  "https://platform4x-helper-apis.onrender.com",
  "https://platform4x-ai-backend.onrender.com",
  "https://platform4x-api-node.onrender.com"
];

/**
 * Scheduled task to ping helper APIs and related services.
 * Runs every minute (* * * * *).
 * Inside each run, it performs 3 pulses with 20-second intervals (0s, 20s, 40s).
 * This ensures the Render-hosted services stay awake with consistent traffic.
 */
export const keepAliveTask = schedules.task({
  id: "keep-alive-task",
  cron: "* * * * *",
  run: async () => {
    logger.log("Starting fire-and-forget keep-alive cycle (1 minute)...");

    for (let i = 0; i < 3; i++) {
      const pulseNumber = i + 1;
      logger.log(`Pulse ${pulseNumber}/3: Firing ${urls.length} API requests (fire-and-forget)...`);
      
      // Fire requests without awaiting responses
      urls.forEach(url => {
        fetch(url).catch(err => {
          logger.error(`Error firing request to ${url}:`, { error: err });
        });
      });

      // Wait for 20 seconds before the next pulse, unless it's the last one
      if (i < 2) {
        await wait.for({ seconds: 20 });
      }
    }

    logger.log("Keep-alive cycle completed.");
    return { success: true };
  },
});
