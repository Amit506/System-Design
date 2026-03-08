# Part 15: Advanced Database Types and Indices

As system demands have grown, the tech industry has moved far beyond basic SQL B-Trees and NoSQL Key-Value stores. Modern applications (like AI, high-frequency trading, and massive analytics) require specialized indexing and storage mechanisms.

---

## 🤖 1. Vector Databases (The Backbone of AI)

With the explosion of Large Language Models (LLMs) and Semantic Search, a new category of database has emerged: The Vector Database.

**Examples:** Pinecone, Milvus, Weaviate, pg_vector.

### What is a Vector?
In machine learning, text, images, and audio are converted into high-dimensional arrays of numbers called "Embeddings" (Vectors). For example, the word "Apple" might become a 1,536-dimensional array: `[0.012, -0.442, ..., 0.981]`.

### The Problem with Standard SQL
If you want to find "images similar to this picture of a cat", you cannot write `SELECT * FROM images WHERE image = 'cat'`. SQL looks for *exact matches*. AI requires finding the "Nearest Neighbor" in a multi-dimensional mathematical space.

### How Vector DBs Work: Approximate Nearest Neighbor (ANN)
Computing the exact mathematical distance (Cosine Similarity or Euclidean Distance) between your query vector and 10 billion vectors in the database takes far too long (`O(N)`).
Vector Databases use **ANN algorithms** (specifically HNSW - Hierarchical Navigable Small World graphs).
*   **HNSW:** It builds a multi-layered graph. It drops your query into the top sparse layer, finds the closest node, drops down a layer, and repeats until it hones in on the closest cluster of vectors at the bottom layer.
*   **Time Complexity:** `O(log N)`.
*   **Use Cases:** Retreival-Augmented Generation (RAG) for Chatbots, Spotify/Netflix Recommendation Systems, Reverse Image Search.

---

## 🗃️ 2. Bitmap Indices (Analytics and Data Warehouses)

If B-Trees are for transactional lookups (finding 1 specific row out of a million), Bitmap Indices are for scanning millions of rows at lightning speed to find aggregates.

### The Scenario
You have 100 Million users in a table. You want to run analytics: `SELECT COUNT(*) FROM users WHERE gender = 'F' AND premium_member = true AND country = 'US'`.

*   **The B-Tree Failure:** Columns with very low cardinality (only a few distinct values, like Gender or Boolean flags) make terrible B-Tree indices. The DB will basically do a full table scan anyway.

### The Bitmap Solution
Instead of a tree, the database creates a literal array of Bits (1s and 0s) for every distinct value in the column. The array length matches the 100 Million rows.

**Gender = 'F' array:** `[1, 0, 0, 1, 1, 0, ...]` (User 1 is F, User 2 is not, User 3 is not, User 4 is F).
**Premium = 'true' array:** `[1, 1, 0, 0, 1, ...]`

When you run the SQL query, the database simply performs an incredibly fast **Bitwise AND operation** on the CPU:
`[1, 0, 0, 1, 1] AND [1, 1, 0, 0, 1] = [1, 0, 0, 0, 1]`

*   **Result:** It instantly knows User 1 and User 5 match the criteria.
*   **Pros:** Phenomenal for complex analytical READ queries. Compresses massively.
*   **Cons:** Terrible for WRITE operations. If you add or delete a single user, you have to rewrite the entire bit array. Only used in OLAP (Data Warehouse) systems.

---

## 🎥 3. Media & Blob Storage Databases

Storing media (photos, PDFs, 4K videos) inside a traditional database is a massive anti-pattern. If you try to store 5GB videos in PostgreSQL `BLOB` columns, the database backups will take weeks, and RAM will be choked out by media streaming instead of serving queries.

### The Architecture: S3 + NoSQL Metadata
Media storage is always split into two distinct tiers:

1.  **Object Storage (The Blob Store):** Amazon S3, Google Cloud Storage, MinIO.
    *   Object stores do not have 'directories' or 'folders' like a normal hard drive. They map a simple string key (e.g., `user24/video89.mp4`) directly to a massive chunk of binary data spread across hundreds of hard drives.
    *   They are optimized for endless capacity and high throughput sequential reads.
2.  **Metadata Database (The Index):** PostgreSQL or MongoDB.
    *   You store the *Metadata* (author, upload date, tags, and the S3 URL string) in the database.

*Request Flow:* The client queries the Metadata DB to find the video metadata. The DB returns the S3 URL. The client then streams the video directly from S3 (or an attached CDN), bypassing your backend servers entirely.

---

## 📈 4. Time-Series Databases (TSDB)

**Examples:** InfluxDB, Prometheus, TimescaleDB.

### The Use Case
When you need to store data where *time* is the primary axis.
*   **Examples:** Tracking CPU usage on 10,000 servers every second. Tracking the price of Bitcoin every millisecond. IoT temperature sensors pinging every minute.

### Why not just use PostgreSQL?
A server pinging its health every second generates 31 Million rows a year. 10,000 servers generate 310 Billion rows a year. If you try to run `SELECT AVG(cpu) FROM logs WHERE time > NOW() - 1 MINUTE`, standard databases choke.

### How TSDBs Work
*   **Write-Optimized (LSM Trees):** They expect a relentless firehose of `INSERT`s, but almost zero `UPDATE`s or `DELETE`s. (You don't rewrite history for a temperature sensor).
*   **Columnar Compression:** Since the data shape is identical (e.g., `[Timestamp, MetricName, FloatValue]`), TSDBs use extreme Delta-of-Delta compression. Instead of saving `Timestamp 10:00:01`, `10:00:02`, `10:00:03` (which takes 8 bytes each), it just saves `10:00:01` and the delta `+1`, `+1`, compressing the data footprint by 95%.
*   **Automatic Downsampling:** To save disk space, TSDBs automatically compress old data. (e.g., Keep 1-second resolution for 7 days, then automatically average it into 1-minute resolution blocks for historical storage).


---

## Frequently Asked Tricky Interview Questions
**Q: "In a Graph Database (like Neo4j), how is checking 'Friends of Friends of Friends' exponentially faster than a traditional SQL Database?"**
*Answer:* In SQL, relational links are evaluated at query time. To find connections 3 levels deep, SQL must perform 3 massive index scans and `JOIN` tables together, which is mathematically $O(N \log N)$ or worse, scanning millions of unrelated rows.
Graph Databases use **Index-Free Adjacency**. When a node ('Alice') is saved, physical pointers directly to her friends ('Bob') are saved in her disk block. Traversing to Bob is an $O(1)$ memory pointer hop. Traversing the graph is purely a localized memory jump, making depth-first queries on billions of nodes millisecond-fast.

**Q: "When would you choose a Wide-Column Store (Cassandra) over a Key-Value Store (DynamoDB)?"**
*Answer:* DynamoDB is phenomenal for simple `Get(Key) -> Blob` access. However, Cassandra's Wide-Column structure intrinsically sorts data on disk via a "Clustering Key". If you are designing a Time-Series log (e.g., IoT Temperature sensors) and need to query `SELECT * FROM temperature WHERE sensor_id = 5 AND time > X AND time < Y`, Cassandra's on-disk clustering allows it to sweep that exact sequential disk block instantly. A pure Key-Value store would force you to read massive scattered blobs and parse them manually in the application.
