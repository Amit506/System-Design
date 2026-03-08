# Part 9: SQL vs. NoSQL (Choosing the Right Database)

The most common mistake in System Design Interviews is choosing the wrong database for the job.

If you say "I'll use MongoDB to store User Passwords and Financial Ledgers" or "I'll use PostgreSQL to store 5 billion daily IoT sensor logs," you will likely fail the interview.

---

## 🏛️ SQL (Relational Databases)
**Examples:** PostgreSQL, MySQL, Oracle, SQL Server.

SQL databases store data in highly structured tables (Rows and Columns). They enforce a strict schema, meaning every row must adhere to the exact same column definitions.

### The Superpower: ACID Compliance
Relational databases are built on the principles of **ACID**.
*   **Atomicity:** Either all parts of a transaction succeed, or the entire transaction fails. (e.g., Transferring $100 from Alice to Bob. If Bob's account doesn't credit, Alice's account rollback the debit instantly).
*   **Consistency:** Data is always valid according to the schema rules.
*   **Isolation:** Concurrent transactions don't interfere with each other.
*   **Durability:** Once a transaction is committed, it is saved to disk and survives a power failure.

### Pros & Cons
*   **Pros:** Perfect for structured data. Powerful query language (`JOIN` across 5 tables). Rock-solid data integrity.
*   **Cons:** Very hard to scale horizontally (Sharding SQL is a massive headache). Because of the strict schema, adding a new column to a table with 1 billion rows requires locking the entire table for hours/days.

---

## 🚀 NoSQL (Non-Relational Databases)

NoSQL was born because Google and Facebook had too much data for single SQL servers to handle. NoSQL databases sacrifice ACID compliance (usually offering "Eventual Consistency") in exchange for massive, effortless horizontal scalability.

### The 4 Families of NoSQL

#### 1. Key-Value Stores
**Examples:** Redis, Memcached, Amazon DynamoDB.
*   **Structure:** Essentially a massive Hash Map. `Key = UserID : Value = JSON String`.
*   **Pros:** The fastest databases on the planet (`O(1)` lookups). Perfect for Caching, Session Management, and Leaderboards.
*   **Cons:** You cannot query by the "Value". You can only query if you know the exact "Key".

#### 2. Document Stores
**Examples:** MongoDB, Couchbase, Firestore.
*   **Structure:** Stores data in JSON-like documents.
*   **Pros:** Flexible Schema. User A can have 5 fields, User B can have 20 fields in the exact same collection. Excellent for rapid prototyping, content management systems (CMS), and e-commerce catalogs where every product has different attributes.
*   **Cons:** Poor support for complex cross-document `JOIN` operations.

#### 3. Wide-Column Stores (Column-Family)
**Examples:** Apache Cassandra, HBase, ScyllaDB.
*   **Structure:** Designed to store massive amounts of unstructured data across thousands of servers. Data is stored in columns rather than rows. Built entirely on LSM-Trees.
*   **Pros:** Insane write throughput. High availability (masterless architecture - no single point of failure). Perfect for Time-Series data, logging (Uber GPS coordinates), and massive Write-Heavy workloads.
*   **Cons:** Very limited querying capabilities without carefully architected secondary indexes.

#### 4. Graph Databases
**Examples:** Neo4j, Amazon Neptune.
*   **Structure:** Stores data as Nodes (Users) and Edges (Relationships).
*   **Pros:** Unbeatable for traversing deep relationships.
    *   *Example Query:* "Find all Friends (Depth 1) of Friends (Depth 2) of Friends (Depth 3) who have liked the movie 'Inception'."
    *   In SQL, this requires a 4-way `JOIN` that would take 10 minutes. In Neo4j, it takes 15 milliseconds.
*   **Cons:** Extremely niche use case. Terrible at horizontal scaling because splitting a massive interconnected web of nodes across physical servers breaks the graph traversal.

---

## ⚖️ The Flowchart: How to Choose

During an interview, narrate your thought process:

1.  **Does the system require strict ACID guarantees?**
    *   Yes (Banking, High-Value Inventory) ➡️ **SQL (PostgreSQL).**
2.  **Is the data massive, unstructured, and rapidly changing?**
    *   Yes (Catalogs, Startups) ➡️ **NoSQL Document (MongoDB).**
3.  **Is the system experiencing millions of writes per second?**
    *   Yes (Logging, IoT, Ride Hailing GPS) ➡️ **NoSQL Wide-Column (Cassandra).**
4.  **Are you purely trying to reduce read latency?**
    *   Yes ➡️ **NoSQL Key-Value Cache (Redis).**
5.  **Are you building a recommendation engine or social network graph?**
    *   Yes ➡️ **NoSQL Graph (Neo4j).**


---

## Frequently Asked Tricky Interview Questions
**Q: "Most NoSQL databases (like Cassandra) are 'Eventually Consistent'. If Alice updates her password from 'apple' to 'banana', and 1 millisecond later tries to login, what happens?"**
*Answer:* She might be denied access. In Eventual Consistency, the write went to Node A. Her subsequent read hits Node B, which has not yet synchronized with Node A. Node B still thinks her password is 'apple'. 
*Solution:* For critical fields like Passwords or Financial Balances, you cannot use Eventual Consistency. You must tune the database to use **Strong Consistency (Quorum Reads)**. E.g., instructing Cassandra to not return a value unless $51\%$ of the nodes agree on the data, inherently slowing the response time but guaranteeing absolute mathematical accuracy.

**Q: "Can't I just use a JSON-column in PostgreSQL to get 'NoSQL' flexibility while keeping SQL ACID guarantees?"**
*Answer:* Yes, Postgres `JSONB` columns are incredibly powerful. However, the bottleneck of SQL is not just the Schema rigidity. The physical bottleneck is **Horizontal Scaling (Sharding)**. Postgres is highly structured for single-node vertical scaling. If your JSON data balloons to 50 Terabytes spanning 10 servers, Postgres lacks native multi-leader automatic sharding architectures. NoSQL databases (like DynamoDB) were built specifically to distribute massive key-value blob data safely across 100s of physical machines seamlessly.
