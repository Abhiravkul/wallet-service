import { Pool } from 'pg';
import { logger } from './logger';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL && process.env.NODE_ENV !== 'test') {
    throw new Error("DATABASE_URL is not set");
}
export const pool = new Pool({
    connectionString: DATABASE_URL,
});

// SUCCESS LOG: Optional (Only once on the first successful connection)
pool.once('connect', () => {
    logger.info("Postgres: New client connected to pool");
});

// CRITICAL ERROR LOG: Mandatory
pool.on('error', (err) => {
    logger.error({
        event: "POSTGRES_POOL_ERROR",
        msg: err.message,
        stack: err.stack
    }, "Unexpected error on idle Postgres client");
});


