# Part 6: Database Engines & Indexes

If you're interviewing for a senior role, the interviewer won't ask if you know SQL vs. NoSQL. They will ask: *"How does Postgres actually write data to disk vs. Cassandra?"*

Understanding the internal data structures of databases dictates your entire architecture.

---

## 🗂️ What is an Index?

An index is an auxiliary data structure built by the database to drastically speed up read operations.

*   Without an index, finding `user_id = 95` requires a **Full Table Scan**: The DB must read every single row from disk until it finds the match. (Time complexity: `O(N)`).
*   With an index on `user_id`, the DB queries a separate tiny table (the index), which holds pointers to exactly where the data lives on the hard drive. (Time complexity: `O(log N)` or `O(1)`).

**The Golden Rule of Indexes:**
Reads become exponentially faster. Writes become slower.
*   *Why?* Every time you `INSERT`, `UPDATE`, or `DELETE` a row, the database must also update the underlying B-Tree index structure. If you have 5 indexes on a table, every single write requires 5 additional write operations on the disk.

---

## 🌳 The Two Titans of Database Engines

To master System Design, you must understand the two fundamental ways data is written to disk: **B-Trees** and **LSM Trees**.

### 1. The B-Tree Engine (Traditional Relational DBs)
**Used By:** PostgreSQL, MySQL (InnoDB), Oracle.

A B-Tree (Balanced Tree) is a deeply nested tree structure. Data on disk is broken into fixed-size "Pages" (usually 4KB or 8KB).

**How it works:**
1.  The root node points to child nodes based on ranges (e.g., Keys 1-100 go left, 101-200 go right).
2.  The leaf nodes at the bottom contain the actual row data (or a pointer to it).
3.  Because the tree must remain "balanced", inserting a new row in the middle of a full page forces the database to split the page into two, rewrite the parent node pointers, and flush it all to disk.

*   **Pros:** Fantastically fast and consistent reads (`O(log N)`). Excellent support for complex transactions, joins, and range queries. Immediate consistency.
*   **Cons:** Writes are expensive. Inserting data requires **Random Disk I/O** (moving the disk head to entirely different mechanical sectors to update tree branches). If you write 100,000 logs a second, a B-Tree will physically choke your hard drive.

### 2. The LSM Tree Engine (Log-Structured Merge Trees / Columnar)
**Used By:** Cassandra, LevelDB, RocksDB, DynamoDB, InfluxDB (Time-series).

An LSM Tree takes the opposite approach. Instead of updating a complex tree in place on disk, it treats all incoming writes as an "append-only log" in memory.

**How it works (The MemTable):**
1.  **Write to Memory (MemTable):** When you `INSERT`, the data is written to a fast, sorted, in-memory tree (RAM).
2.  **Write-Ahead Log (WAL):** To prevent data loss on crash, the raw byte operation is quickly appended to a file on disk sequentially.
3.  **Flush to Disk (SSTable):** When the MemTable RAM fills up (e.g., 4MB), the database freezes it and writes the entire sorted block to disk as an immutable (unchangeable) file called an SSTable (Sorted String Table).
4.  **Compaction (Background Magic):** Over time, you build up thousands of these SSTable files. A background process merges them together, throwing away deleted rows or old versions of updated rows.

*   **Pros:** The absolute undisputed king of Write throughput. Because everything goes to RAM first, and disk flushes are massive **Sequential Disk I/O** blocks, LSM databases can handle millions of writes per second across clusters effortlessly.
*   **Cons:** Reads are significantly slower than B-Trees. To read data, the DB must check the MemTable, then check the newest SSTable, then the next, diving through multiple files. (This is mitigated using **Bloom Filters**).

---

## 🔎 The Secret Weapon: Bloom Filters

If LSM databases have slow reads because they check dozens of immutable files on disk, how is Cassandra so fast?

Enter the **Bloom Filter**.

A Bloom Filter is a probabilistic, incredibly memory-efficient data structure (using bit arrays and multiple hash functions) that answers a single question: *"Does this key exist in this dataset?"*

*   **If it says "No",** it is 100% guaranteed the data does not exist. The DB skips checking the file entirely.
*   **If it says "Yes",** it means the data *probably* exists. The DB then spends the time to open the file and look.

When designing a web crawler or a massive NoSQL database, always mention Bloom Filters to prevent expensive, useless disk seeks.
