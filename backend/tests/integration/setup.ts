import dotenv from "dotenv";
dotenv.config();  
import { pool } from "../../src/utils/db";
import { redisClient } from "../../src/utils/redis";

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }
}));

beforeAll(async () => {
if (!redisClient.isOpen) {
    await redisClient.connect();
  }
try {
    await pool.query("SELECT 1");
  } catch (err) {
    // This will now use the mock correctly because it's inside a hook
    console.error("Setup failed to connect to DB:", err);
    throw err; 
  }
});

afterAll(async () => {
 await Promise.all([
    pool.end(),
    redisClient.isOpen ? redisClient.quit() : Promise.resolve()
  ]);
});
