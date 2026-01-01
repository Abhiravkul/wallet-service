CREATE TABLE wallet (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_id BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    type VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    CONSTRAINT uniq_transactions_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT fk_wallet
        FOREIGN KEY (wallet_id)
        REFERENCES wallet(id)
);