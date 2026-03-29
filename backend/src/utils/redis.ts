import { createClient } from "redis";
import { logger } from "./logger";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://redis:6379",
});

redisClient.on("error", (err) => {
  logger.error({
    event: "REDIS_ERROR",
    error: err instanceof Error ? err.message : err,
    stack: err instanceof Error ? err.stack : undefined
  }, "Redis client error");
});

export async function connectRedis() {
  try {
    await redisClient.connect();
   logger.info({
      event: "REDIS_CONNECTED"
    });
  } catch (err) {
    logger.error({
      event: "REDIS_CONNECTION_FAILED",
      error: err instanceof Error ? err.message : err
    }, "Failed to connect to Redis");

    throw err;
  }
}

export { redisClient };
