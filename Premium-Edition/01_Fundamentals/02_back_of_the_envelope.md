# Part 2: Back-of-the-Envelope Estimation

You are applying for a Senior or Staff Engineer role. The interviewer asks: *"How much storage do we need for Twitter?"*

To pass this interview, you cannot guess. You must be able to perform rough calculations in your head or on a whiteboard. This demonstrates you understand the raw physics of distributed systems.

---

## 🧮 1. The Power of Two Rules
When you do math on a whiteboard, round numbers aggressively.

*   `1 Day` ≈ `10^5 seconds` (Actually 86,400s).
*   `2.5 Million requests / month` ≈ `1 Request / Second`.
*   `100 Million requests / month` ≈ `40 Requests / Second`.
*   `1 Billion requests / month` ≈ `400 Requests / Second`.

### Memory & Disk Scale
Learn to translate zeros to bytes instantly:
*   `10^3 Bytes` = `1 Kilobyte (KB)`
*   `10^6 Bytes` = `1 Megabyte (MB)` (e.g., Short Video)
*   `10^9 Bytes` = `1 Gigabyte (GB)`
*   `10^12 Bytes` = `1 Terabyte (TB)` (e.g., Average DB size)
*   `10^15 Bytes` = `1 Petabyte (PB)` (e.g., Massive scale Analytics)
*   `10^18 Bytes` = `1 Exabyte (EB)` (e.g., Google's index, Amazon S3)

---

## ⏱️ 2. The Numbers Every Engineer Should Know (Latency)

Your architecture decisions depend directly on hardware latency. If your DB is on disk, it's thousands of times slower than memory.

*   **L1 Cache Reference:** 0.5 nanoseconds (ns)
*   **L2 Cache Reference:** 7 ns
*   **Main Memory (RAM) Read:** 100 ns
*   **Read 1 MB sequentially from RAM:** 250,000 ns (0.25 ms)
*   **Disk Seek (Magnetic, SSD is faster):** 10,000,000 ns (10 ms)
*   **Read 1 MB sequentially from Network:** 10,000,000 ns (10 ms)
*   **Read 1 MB sequentially from Disk:** 30,000,000 ns (30 ms)
*   **Send packet CA to Netherlands and back:** 150,000,000 ns (150 ms)

### 💡 The Takeaway
1.  **Memory is incredibly fast:** 100x faster than disk. This is why we use Redis caching.
2.  **Sequential disk reads are decent, random seeks are terrible:** This is why Cassandra (Append-only LSM Trees) writes faster than Postgres (B-Tree random seeks).
3.  **Network is slow:** Minimize round-trips to the DB from your backend APIs.

---

## 📐 3. Estimation Blueprint (The 4 Metrics)

Always structure your math around these four pillars.

### A. Traffic (QPS / RPS) Estimates
Question: System with 10M DAU. Each user tweets 2 times a day and views 5 timelines (20 tweets per timeline).

*   **Write QPS:** `10M DAU * 2 tweets / 10^5 seconds = 20M / 10^5 = 200 writes / second.`
*   **Read QPS:** `10M DAU * 5 views / 10^5 seconds = 50M / 10^5 = 500 reads / second.`
*   *Peak QPS:* Always double this to account for traffic spikes (400 writes/sec, 1000 reads/sec).

### B. Storage Estimates
Question: We need to store 5 years of tweets. Each tweet is roughly 140 chars text plus metadata (500 Bytes). 10% of tweets contain an image (1MB).

*   **Text Storage per Day:** `20M tweets * 500B = 10 Billion Bytes = 10 GB/day.`
*   **Image Storage per Day:** `20M * 0.10 * 1MB = 2,000,000 MB = 2 TB/day.`
*   **Total per 5 Years:** `(10 GB + 2 TB) * 365 days * 5 = ~3.65 PB of storage.`

### C. Bandwidth Estimates
We established 2 TB of media generated per day.

*   **Ingress (Incoming Bandwidth):** `2 TB / 10^5 seconds = 20 MB/second.`
*   **Egress (Outgoing Bandwidth):** If read traffic is 10x write traffic, then egress is `200 MB/second`.

### D. Memory (Cache) Estimates
*Rule of Thumb: Cache 20% of daily read volume to handle 80% of traffic (Pareto Principle).*

Question: We want to cache timelines to speed up read QPS.
*   Daily read data = `50M views * 20 tweets * (500B text + 10% * 1MB image) = 50M * 20 * ~100KB = 100,000 GB = 100 TB`.
*   *Note: You don't cache 1MB images in Redis! You cache the CDN URL string. So 500B + 50B URL = 550 Bytes.*
*   Recalculated daily read data (Metadata only): `50M * 20 * 550B = ~500 GB`.
*   **Redis Cache Size:** `20% of 500 GB = 100 GB RAM required`.

---

## 📝 Summary: A Real Interview Scenario
*Interviewer: We are building Youtube.*
*   **You (Thinking out loud):** Okay, DAU is 100M. Let's assume 1 video uploaded per 100 users, and 5 videos watched per user.
*   **You:** "Video is massive. I'll estimate 500MB per video on average after compression."
*   **You:** "Write QPS is `100M / 100 = 1M uploads a day / 10^5 seconds = 10 uploads/sec`."
*   **You:** "Read QPS is `100M * 5 = 500M views a day / 10^5 seconds = 5000 streams/sec`. So this is highly read-heavy."
*   **You:** "For storage, 1M uploads * 500MB = 500 TB per day. Or ~180 PB a year. We cannot use a standard SQL database for this; we need highly scalable Blob Storage like Amazon S3 or a custom HDFS cluster."

You just proved in 3 minutes that you understand the architectural reality of YouTube before drawing a single box.


---

## Frequently Asked Tricky Interview Questions
**Q: "If SSD disk reads are fast (~100 microseconds), why do we obsess over keeping databases in RAM (~100 nanoseconds)? Isn't 100 microseconds fast enough for a human?"**
*Answer:* A single 100μs read is invisible to a human. However, if rendering a timeline requires a relational database to execute a `JOIN` that scans 10,000 rows, $10,000 	imes 100\mu s = 1.0	ext{ second}$. If it scans in RAM, $10,000 	imes 100	ext{ns} = 1.0	ext{ millisecond}$. Compounding operations make disk speeds the ultimate systemic bottleneck for scale.

**Q: "You calculated that the system requires 50 TB of storage over 5 years. Is 50 TB the absolute physical reality of what you'll buy from AWS?"**
*Answer:* No, that is strictly the *raw* data requirement. In production, you must account for **Replication Factor** (usually $3x$ for High Availability), which pushes it to 150 TB. Then you must account for **Compaction/Padding Overhead** (NoSQL databases like Cassandra often require 50% free space to run compaction safely), pushing the actual hardware footprint closer to 300 TB.
