# Part 4: Caching Strategies & Content Delivery

If load balancers are the traffic cops, caches are the high-speed transit lanes bypassing the database traffic entirely. A cache is a short-term memory store. Reading from RAM (cache) takes nanoseconds (ns), while reading from disk (database) takes milliseconds (ms). Caching reduces latency by **1,000x to 100,000x**.

---

## 🏎️ 1. Why is Caching Mandatory at Scale?
Without a cache, a sudden spike in traffic (a "thundering herd") reading the exact same piece of data (e.g., a viral Tweet or breaking news article) will crash your database cluster instantly.

1.  **Reduce Latency:** 0.1ms reads versus 50ms database reads.
2.  **Save Money:** CPU cycles mapping SQL queries and Disk I/O operations are incredibly expensive. Memory is cheap.
3.  **Buffer Spikes:** By caching the top 10% of your most heavily accessed content, you protect your core backend architecture from DDOS-like traffic spikes.

---

## 📊 2. Where Can We Put a Cache?

Caching is effective at almost every layer of the architecture.

*   **Client / Browser Cache:** The browser downloads images and stores them locally.
*   **CDN (Content Delivery Network):** Caches large static media globally (images, CSS, JS) incredibly close to the user physically (Edge servers). It intercepts requests before they hit your data center.
*   **Web Server Cache:** The Reverse Proxy (Nginx) can cache entire rendered HTML pages or HTTP responses before routing the request to the application API.
*   **Application / Database Cache (Redis/Memcached):** Stores structured payloads (JSON, objects, session states, computed queries). This sits between your Application servers and the core Database.

---

## 🧩 3. Cache Population Strategies (Writing to Cache)

How do you keep the cache updated when a user adds new data to the system? This is the hardest part of caching.

### Strategy 1: Cache-Aside (Lazy Loading)
The most common strategy. The cache only holds data that was specifically requested.
*   **Read Flow:** Application -> Cache (Hit/Miss) -> Database -> Application (writes to Cache) -> Client.
*   **Write Flow:** Write to Database ONLY.
*   **Pros:** The cache only contains data users actually want. Memory isn't wasted on unread data.
*   **Cons:** The first time any data is requested, it’s a "Cache Miss," meaning the user experiences the slow database latency.

### Strategy 2: Write-Through
The application writes data to the cache AND the database simultaneously (in a single transaction).
*   **Pros:** Data in the cache is always 100% up-to-date and consistent with the database. No "stale reads." Reads are instantly fast.
*   **Cons:** Higher latency for write operations because you write twice in sequence. A lot of memory is wasted caching data that will never be read.

### Strategy 3: Write-Behind (Write-Back)
The application writes to the Cache ONLY. An asynchronous background process eventually flushes the cache keys to the Database in massive batches.
*   **Pros:** The absolute fastest write speed imaginable (literally writing to RAM). Incredible scalability for write-heavy systems (e.g., logging every Uber driver's GPS coordinate every 2 seconds).
*   **Cons:** **Extreme Data Loss Risk.** If the Redis server crashes before the data flushes to the backend database, that data is permanently vaporized. Use only for non-critical logging or volatile metrics.

---

## 🗑️ 4. Cache Eviction Policies (When full)

Memory is expensive. You can't store 10TB of database data in 1TB of Redis Cache. When the cache hits 100% capacity, how does it decide what to delete?

1.  **LRU (Least Recently Used):** Delete the data that hasn't been requested in the longest amount of time. *The industry standard default.*
2.  **LFU (Least Frequently Used):** Delete data based on hit count. Keep the viral content, delete content that only got 1 view.
3.  **FIFO (First In, First Out):** Delete the oldest data chronologically, regardless of how often it is accessed.
4.  **TTL (Time-To-Live):** The best defense mechanism. When writing a key to Redis, you give it an expiration time (e.g., `expire: 300` for 5 minutes). The cache auto-deletes the key when the timer runs out.

---

## ⛈️ 5. Advanced Interview Concepts

### The Thundering Herd Problem (Cache Stampede)
*   **Scenario:** You cache a breaking news article with a TTL of 1 hour. It's getting 10,000 requests per second. At exactly 1:00 PM, the TTL expires.
*   **The Disaster:** Suddenly, all 10,000 requests in that second register a Cache Miss. All 10,000 requests slam the database simultaneously, completely locking it down or crashing the server.
*   **The Solution:** Implement a Distributed Mutex Lock (e.g., using Redis `SETNX`). When the key expires, the *first* request secures a lock, queries the DB, and re-warms the cache. All other 9,999 requests wait/poll for 50ms, then successfully hit the newly warmed cache.

### Global vs. Distributed Caches
*   **Global Cache:** One massive Redis node. Easy to manage, single point of failure.
*   **Distributed Cache:** Hashing keys across a cluster of 10 Redis nodes. Infinite scaling capacity. If node 3 dies, you only lose 10% of your cached keys via Consistent Hashing.
