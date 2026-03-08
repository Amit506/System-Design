# 💾 Design a Distributed Cache (Redis / Memcached)

**Core Domains:** Memory Management, Eviction Policies, Sharding.  
**Primary Concepts Demonstrated:** Cache Stampede, Read-Through vs Write-Through, Consistent Hashing, LRU internals.

---

## 1. Scope & Requirements
A distributed cache is the bedrock of any massive system (Twitter, Netflix, Uber). The goal is to build an in-memory key-value store that sits in front of the database to absorb 99% of read traffic.

*   **Traffic Focus:** Immense Read/Write ratio in pure RAM.
*   **Storage:** 5 Terabytes of highly active cache data. (A single machine cannot hold this).
*   **Latency constraint:** $<1\text{ms}$ sub-millisecond response times.

---

## 2. API Design & Core Behaviors
`setValue(key, value, EXPIRE_TIME)`
`getValue(key)` -> Returns Null if evicted or expired.

### Caching Strategies
1. **Cache-Aside (Lazy Loading):** The application asks the Cache. If Miss, it asks the DB. It then writes the answer into the Cache.
    * *Pros:* Simple. The cache only contains what the app requests.
    * *Cons:* Every Cache Miss results in a slow 3-hop process (Ask Cache -> Ask DB -> Write Cache).
2. **Write-Through:** The application ONLY writes to the Cache. The Cache synchronously writes to the DB before returning success.
    * *Pros:* Data is strictly perfectly consistent. The DB and Cache always match.
    * *Cons:* Writes are incredibly slow.

---

## 3. High-Level Design (HLD) & Consistent Hashing
Because we need 5TB of RAM, and standard Redis maxes out efficiently around 64GB per node to prevent garbage collection/saving stalls, we need approximately **100 Redis Servers**.

How do you split 1 Billion keys across 100 servers so you always know where `key_apple` is?

### Naive Hashing
`server_index = hash(key_apple) % 100`
*   **Limitation:** If Server #54 crashes, you now have 99 servers. The formula is now `hash(key) % 99`. Every single key maps to a completely different server index. The entire global cache is instantly invalidated, resulting in 1 Billion requests flooding the DB simultaneously, destroying the site in seconds.

### The Standard Industry Solution: Consistent Hashing
You map the 100 servers onto a mathematical "ring" ($0$ to $360$ degrees).
When you hash a key (`hash("apple") = 205`), you map it to 205 degrees on the ring. You then walk clockwise until you hit the nearest Server.
*   **Advantage:** If Server #54 crashes, only the keys assigned specifically to #54 fall to the next server clockwise (Server #55). The other 99% of the cache on the other 98 servers is completely undisturbed.

```mermaid
graph TD
    AppServer[Application Backend] -->|hash(key)| Router[Hash Router (Consistent Hashing)]
    
    Router -->|If key falls to Sector 1| NodeA[(Cache Node A)]
    Router -->|If key falls to Sector 2| NodeB[(Cache Node B)]
    Router -->|If key falls to Sector 3| NodeC[(Cache Node C)]
    
    NodeA -.->|Async Save| DiskA[Disk Persistence RDB/AOF]
```

---

## 4. Addressing System Bottlenecks

### A. The Cache Stampede (Thundering Herd)
A highly popular Twitter profile (Justin Bieber) is cached in Redis with a 5-minute TTL.
At exactly `5:00:00`, the key expires. 
At `5:00:01`, 1 Million users refresh their timeline at the same time. The Cache returns `null` for all 1 Million. All 1 Million server threads instantly hit the PostgreSQL database to rebuild Justin Bieber's profile. PostgreSQL crashes.
*   **Solution: The Mutex Lock.** The very first thread that gets a Cache Miss instantly sets a lightweight lock in Redis `SET lock_bieber 1 EX 5`. The other 999,999 threads see the lock, and they `sleep(50ms)` instead of hitting the database, waiting for Thread 1 to finish rebuilding the cache.
*   **Alternative Solution: Probabilistic Early Expiration.** If a key expires in 5 minutes, we artificially and randomly force $1\%$ of requests in the final 30 seconds to fetch a fresh copy from the DB in the background.

### B. Eviction Policies (LRU)
When the 64GB RAM fills up entirely, what does the server delete to make room for a new key?
*   **Least Recently Used (LRU):** Delete the key that hasn't been requested in the longest amount of time.
*   **Implementation (LLD):** The industry standard for an LRU cache is a **HashMap + Doubly Linked List**.
    *   The HashMap provides $O(1)$ key lookup.
    *   The Doubly Linked List holds the keys. Every time a key is accessed, you physically rip the Node out of the middle of the linked list and move it to the `HEAD` ($O(1)$ time). When RAM is full, you just delete the `TAIL` node ($O(1)$ time).
    *   *Limitation:* You cannot easily do this across multiple servers. LRU is strictly calculated on a per-node basis.

### C. Write Amplification (Replication Strategy)
If `Node A` dies permanently, all its keys are gone. 
*   **Mitigation:** Redis typically uses a Primary-Replica structure. Every Master `Node A` has 2 hidden read-only Replicas. The Master asynchronously copies every write to the replicas using an append-only transaction log. If `Node A` crashes, Redis Sentinel promotes a Replica to Master under 3 seconds.


---

## 5. Frequently Asked Hard Interview Questions
**Q: If memory fragmentation occurs within a single Node A, how do you clean it up without stopping the server?**
*Answer:* In standard Redis, memory fragmentation (due to creating/deleting varying sized strings over months) can bloat RAM heavily. While modern allocators (jemalloc) handle this well, the ultimate mitigation is **Active Defragmentation**. Redis can be configured to slowly sweep memory in the background, copying scattered blocks into contiguous chunks. If it's severe, we execute a failover: Promote the Replica (which naturally built a clean memory tree), take the Master offline, flush it, and rejoin it to the ring as a clean replica.

**Q: How do you handle cache invalidation consistently across multiple geographic datacenters?**
*Answer:* True multi-region consistency is notoriously difficult. A standard approach is **Pub/Sub or Kafka Event Buses**. If a user's profile is updated in Virginia, the US database writes the change and emits a `ProfileUpdated` event to a global Kafka topic (MirrorMaker). The European cache servers subscribe to this topic and instantly evict the `user_profile` locally. The next Read in Europe will be a Miss, forcing an updated fetch.
