CREATE TABLE wallet (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    wallet_id BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    type VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    balance_before BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uniq_transactions_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT fk_wallet
        FOREIGN KEY (wallet_id)
        REFERENCES wallet(id)
);