import { Pool } from 'pg';
import { logger } from './logger';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
}
export const pool = new Pool({
    connectionString: DATABASE_URL,
});

pool
    .query("SELECT 1")
    .then(() => {
        logger.info("Postgres connected");
    })
    .catch((err) => {
        logger.error({
            event: "POSTGRES_CONNECTION_FAILED",
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined
        }, "Postgres connection failed");
        process.exit(1);
    })