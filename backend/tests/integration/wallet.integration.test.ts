import { WalletService } from "../../src/services/wallet.services";
import { TxType } from "../../src/domain/types/TxTypes";
import { pool } from "../../src/utils/db";
import { WalletRepository } from "../../src/repositories/wallet.repo";
import { redisClient } from "../../src/utils/redis";
import { PoolClient } from "pg";

const walletRepo = new WalletRepository();
const service = new WalletService(walletRepo, redisClient);

/**
 * Helper: create a wallet with initial balance
 */
async function createWallet(client: PoolClient, initialBalance = 1000) {
  const randomId = Math.floor(Math.random() * 1000000);
  const result = await client.query(
    "INSERT INTO wallet (user_id, balance, currency) VALUES ($1, $2, $3) RETURNING id",
    [randomId, initialBalance, "INR"]
  );
  return result.rows[0].id;
}

/**
 * Cleanup after each test to keep isolation
 */


// afterEach(async () => {

//     await pool.query("DELETE FROM transactions"),
//     await pool.query("DELETE FROM wallet"),
//     await redisClient.flushAll().catch(() => {}) // Catch if redis is intentionally down
// });


describe("Wallet Integration Tests", () => {
  let testClient: PoolClient;

  beforeEach(async () => {
    // 1. Get a dedicated client from the pool
    testClient = await pool.connect();
    // 2. Start the transaction
    await testClient.query("BEGIN");
  });

  afterEach(async () => {
    // 3. Rollback EVERYTHING done in the test
    await testClient.query("ROLLBACK");
    // 4. Release the client back to the pool
    testClient.release();
    // 5. Still clear Redis since it doesn't support SQL rollbacks
    await redisClient.flushAll();
  });

  test("should not process same idempotency key twice", async () => {
    const walletId = await createWallet(testClient);
    const key = "idem-1234";

    const res1 = await service.executeTx(walletId, 100, key, TxType.CREDIT, "INR", testClient);
    const res2 = await service.executeTx(walletId, 100, key, TxType.CREDIT, "INR", testClient);

    expect(res1).toEqual(res2);

    const txCount = await testClient.query(
      "SELECT COUNT(*) FROM transactions WHERE idempotency_key = $1",
      [key]
    );

    expect(Number(txCount.rows[0].count)).toBe(1);
  });

  test("should handle concurrent debit safely", async () => {
    const walletId = await createWallet(testClient, 1000);

    const results = await Promise.allSettled([
      service.executeTx(walletId, 800, "k1", TxType.DEBIT, "INR", testClient),
      service.executeTx(walletId, 800, "k2", TxType.DEBIT, "INR", testClient)
    ]);

    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failCount = results.filter(r => r.status === "rejected").length;

    expect(successCount).toBe(1);
    expect(failCount).toBe(1);

    const wallet = await testClient.query(
      "SELECT balance FROM wallet WHERE id = $1",
      [walletId]
    );

    expect(Number(wallet.rows[0].balance)).toBe(200);
  });

  test("retry should not double debit", async () => {
    const walletId = await createWallet(testClient, 1000);
    const key = "retry-1234";

    await service.executeTx(walletId, 100, key, TxType.DEBIT, "INR", testClient);

    const retry = await service.executeTx(walletId, 100, key, TxType.DEBIT, "INR", testClient);

    expect(retry).toBeDefined();

    const wallet = await testClient.query(
      "SELECT balance FROM wallet WHERE id = $1",
      [walletId]
    );

    expect(Number(wallet.rows[0].balance)).toBe(900);
  });

  test("should maintain balance correctness after credit", async () => {
    const walletId = await createWallet(testClient, 1000);

    await service.executeTx(walletId, 200, "c1", TxType.CREDIT, "INR", testClient);

    const result = await testClient.query(
      "SELECT balance FROM wallet WHERE id = $1",
      [walletId]
    );

    expect(Number(result.rows[0].balance)).toBe(1200);
  });

  test("should fail on insufficient balance", async () => {
    const walletId = await createWallet(testClient, 100);

    await expect(
      service.executeTx(walletId, 200, "fail1", TxType.DEBIT, "INR", testClient)
    ).rejects.toThrow();

    const wallet = await testClient.query(
      "SELECT balance FROM wallet WHERE id = $1",
      [walletId]
    );

    expect(Number(wallet.rows[0].balance)).toBe(100);
  });
  test("should work even if redis is unavailable", async () => {
    const walletId = await createWallet(testClient, 1000);
    const key = "redis-down-test";

    // 1. Force Redis to throw an error for this test only
    const redisSpy = jest.spyOn(redisClient, 'get').mockRejectedValue(new Error("Redis Conn Refused"));
    const redisSetSpy = jest.spyOn(redisClient, 'set').mockRejectedValue(new Error("Redis Conn Refused"));

    // 2. Execute service call
    const res = await service.executeTx(walletId, 100, key, TxType.CREDIT, "INR", testClient);

    // 3. Assertions
    expect(res.balance).toBe("1100"); // DB part should still work
    expect(redisSpy).toHaveBeenCalled();

    // 4. Cleanup: Restore Redis to normal for the next test
    redisSpy.mockRestore();
    redisSetSpy.mockRestore();
  });

});