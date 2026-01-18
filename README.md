# Wallet Service — Correctness-First Backend Project

## Overview

This project implements a **correctness-focused wallet service** that supports credit and debit operations under **concurrent access**, **retries**, and **partial failures**.

The goal is not feature breadth, but to demonstrate **reasoning** around:

- concurrent writes
- idempotency
- transactional safety
- timeout handling
- frontend–backend interaction under failure

The system intentionally avoids over-engineering and focuses on **core guarantees**.

---

## Core Guarantees

The system provides the following guarantees:

- No lost updates under concurrency  
- Exactly-once semantics for write operations  
- No double credit/debit on retries  
- Safe behavior under request timeouts  
- Correct behavior when Redis is unavailable  

---

## Architecture Summary

### Technology Stack

- **Backend:** Node.js + Express  
- **Database:** PostgreSQL (source of truth)  
- **Cache:** Redis (optional optimization only)  
- **Frontend:** React (minimal)

### Design Principles

- Database is the **only authority**
- Redis is a **performance optimization**, never required for correctness
- Transactions are **short and explicit**
- Frontend state is **single-writer**
- Conflicts are **surfaced, not hidden**

---

## Wallet Data Model

### Wallet Table

- `balance` stored as `BIGINT`
- All monetary values use the **smallest currency unit**
- No floating-point arithmetic

### Transactions Table

- Records every successful credit/debit
- Enforces idempotency via a **unique constraint on `idempotency_key`**

This ensures:

- full auditability
- replay safety
- crash recovery

---

## Concurrency Control

### Why Optimistic Locking

The wallet uses **optimistic locking** via a `version` column.

Each update:

- reads the current version
- updates only if the version matches
- increments the version atomically

This prevents:

- lost updates
- silent overwrites
- inconsistent balances

### Why Not Pessimistic Locking

Pessimistic locking:

- reduces throughput
- increases contention
- blocks readers unnecessarily

Optimistic locking keeps transactions short and scalable.

---

## Idempotency Design

### Problem

Clients may retry requests due to:

- network timeouts
- frontend refresh
- server restarts

Without idempotency, retries can cause **double credit/debit**.

### Solution

- Clients send an `Idempotency-Key` for every write
- The key is stored in the database with a uniqueness constraint
- Duplicate requests are detected at the database layer

Redis is used as a **fast-path cache** for replaying successful responses, but correctness does not depend on it.

---

## Failure Scenarios & Behavior

### Redis Is Down

- Requests still succeed
- Database enforces idempotency
- System becomes slower but remains correct

### Request Times Out Mid-Processing

- HTTP request may fail
- Database transaction may still commit
- Retried request with the same idempotency key safely replays the result

### Concurrent Requests

- Multiple requests may race
- Exactly one succeeds
- Others receive a conflict response
- No balance corruption occurs

---

## Timeout Handling

The system uses **promise-based request timeouts**.

Design intent:

- Bound how long the server waits
- Ensure `try/finally` cleanup runs
- Avoid assuming in-flight DB work can be cancelled

Correctness is ensured via:

- transactions
- idempotency
- conflict detection

---

## Frontend Responsibilities

The frontend is intentionally minimal but non-toy.

It:

- disables invalid actions
- generates idempotency keys
- handles conflict responses explicitly
- applies only successful responses to state
- demonstrates concurrency and retry behavior

The UI includes **explicit demos** for:

- retrying the same request
- issuing concurrent requests to the same wallet

## Key Takeaways

This project demonstrates that:

- correctness under concurrency is a **design problem**, not a framework feature
- idempotency must be enforced at the **database layer**
- retries and timeouts are safe only when combined with strong invariants
- In normal operation, frontend write paths are intentionally constrained to a single writer; the concurrency demos deliberately relax these constraints to expose backend behavior under race conditions.

---

## Why This Project Exists

Most portfolio projects focus on **features**.

This project focuses on **failure modes**.

The goal was to build something small, understandable, and **correct under stress**.

---