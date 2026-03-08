# 🗃️ CQRS & Event Sourcing

**Core Focus:** Segregating Read/Write workloads, Immutable Event Logs, Projections, High Throughput Accounting.

---

## 1. The CRUD Monolith Problem
In traditional REST architectures (Create, Read, Update, Delete), you use a single database model (e.g., `User` table) for both writing Data and reading Data.

**The Flaw:** 
A complex system has severely imbalanced needs. 
*   **Writes** require strict validation, deep business logic, and heavy locks to ensure banking accuracy.
*   **Reads** need to be instantaneous, pulling flattened, pre-computed data without locking rows.
If 10,000 users are querying their bank balance (Reads), they will financially lock out the 10 users trying to deposit money (Writes) because they share the exact same Database indexes.

## 2. CQRS (Command Query Responsibility Segregation)
CQRS explicitly splits your architecture in half at the code level.
*   **The Command Side (Writes):** Receives intent to mutate (`DepositMoneyCommand`). It validates rules, changes the state, and writes to a highly write-optimized Database.
*   **The Query Side (Reads):** A completely separate database (e.g., a flattened NoSQL Elasticsearch or Redis instance) that is strictly optimized for fast queries. It answers `GetBalanceQuery`.

*How do they sync?* When the Command side successfully writes a Deposit, it publishes an Event to a Message Broker (Kafka). The Query side listens to Kafka, updates its own separate Redis database, and goes to sleep.

## 3. Event Sourcing (The Ultimate Transaction Log)
CQRS is usually paired with Event Sourcing. Instead of saving the *current state* in your database (e.g., `Balance: $500`), you save the *history of events that led to the state*.

*   **Database before Event Sourcing:** `[User: Alice, Balance: $500]`
*   **Database with Event Sourcing (Immutable Append-Only Log):**
    1.  `AccountCreated(Initial: $0)`
    2.  `Deposited($1000)`
    3.  `Withdrew($500)`

**Why is this revolutionary?**
*   **Perfect Audibility:** If you are a Bank, and regulatory auditors ask "Why is Alice's balance $500?", you have absolute mathematical proof of the sequence of actions. Standard CRUD overwrites data forever; Event Sourcing never deletes or updates data. It only appends.
*   **Time Travel:** You can rebuild the exact state of the database "as it was on Tuesday at 4:00 PM" by replaying the event log up until string timestamp `4:00 PM`.

## 4. Projections & Snapshots
If an account has 5 Million small transactions over 10 years, loading their balance takes forever because you must replay 5 Million lines of math.
**The Solution:** The Query side creates **Snapshots**. Every 1,000 events, it runs the math and stores a static "Projection" (`Balance = $5,000 at Event 1000`). When a user queries their balance, the system instantly grabs the snapshot and mathematically replays only the $5$ tiny events that happened since the snapshot.

---

## Frequently Asked Tricky Interview Questions
**Q: "If the Command Side Database updates successfully, but Kafka crashes before it updates the Query Side Database, a user will deposit $100 but their app will still show $0. How do you prevent this (The Dual Write Problem)?"**
*Answer:* You cannot write to a Database and a Message Broker in a single atomic transaction without distributed 2PC (Two-Phase Commit). Modern systems use the **Transactional Outbox Pattern**. The Command service writes the Event into an `Outbox` table directly *inside the same SQL database transaction*. This is $100\%$ atomic. A separate background process (e.g., Debezium CDC) microscopically strips the `Outbox` table and pushes it to Kafka seamlessly, guaranteeing Delivery.

**Q: "If Event Sourcing dictates that events are mathematically immutable and append-only, how do you comply with GDPR 'Right to be Forgotten' laws where a user demands you physically delete their data?"**
*Answer:* You cannot rewrite a multi-terabyte immutable sequence blockchain log. The industry solves this via **Crypto-Shredding**. Before generating `UserCreatedEvent(email='alice@a.com')`, Alice's PII (Personally Identifiable Information) is encrypted using a unique Key assigned specifically to her in AWS KMS. The immutable log stores `UserCreatedEvent(hash='ZxCvBnM...`)`. When she exercises her GDPR right, you do not touch the immutable log. You physically delete her single unique Decryption Key from AWS KMS. The event still exists forever, but is now computationally irreversibly anonymized.
