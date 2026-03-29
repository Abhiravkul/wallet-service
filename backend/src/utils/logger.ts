import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "wallet-service" },
  transport: {
    target: "pino-loki",
    options: {
     host: process.env.LOKI_HOST || "http://loki:3100",
      labels: { service: "wallet-service" }
    }
  }
});