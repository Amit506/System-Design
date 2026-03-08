# Part 13: Distributed Caching (Memcached & Redis)

We discussed caching strategies previously, but building a *Distributed* Cache from scratch is a common, highly challenging Senior System Design question. 

*Question: "Design a Distributed Key-Value Cache like Memcached or Redis."*

---

## 1. Clarification & Requirements

### Functional Requirements
1.  **Put(key, value):** Store a value against a key.
2.  **Get(key):** Retrieve the value.
3.  **Eviction:** When memory is full, evict data.

### Non-Functional Requirements
1.  **High Read/Write Throughput:** Millions of QPS.
2.  **Low Latency:** Sub-millisecond response times.
3.  **Scalability:** We must be able to add servers without infinite downtime.
4.  **High Availability:** The cache survives server crashes.

---

## 2. High-Level Architecture (The Distributed Hash Table)

A distributed cache is fundamentally a **Distributed Hash Table (DHT)**.

If a client wants to `Put("user:145", "{name: John}")`, where does it go? We have 10 Cache Servers.

### The Routing Layer
We must use **Consistent Hashing** to route keys to servers.
*   *Why?* If we use simple modulo hashing (`hash(key) % 10`), and Server 5 dies, the modulo changes (`hash(key) % 9`). Suddenly, 90% of all keys map to the wrong server, causing a catastrophic global Cache Miss event that will instantly crush the primary database.
*   Consistent hashing (with virtual nodes) ensures that if Server 5 dies, only the 10% of keys stored on Server 5 are lost. The other 90% remain perfectly mapped.

### Where does the Routing Logic Live?
1.  **Client-Side Routing (Memcached Approach):** 
    *   The application code (e.g., your NodeJS server) holds the Consistent Hash Ring in its own memory. Your code calculates the hash, realizes Server 3 owns the key, and opens a direct TCP connection to Server 3.
    *   *Pros:* Extremely fast. No middleman.
    *   *Cons:* Managing the cluster state across 100 app servers is difficult.
2.  **Proxy Routing (Twemproxy/Envoy):**
    *   The app sends all requests to a Load Balancer / Proxy. The Proxy holds the Hash Ring, calculates the destination, and forwards the packet.
    *   *Pros:* The app is "dumb" and easy to write.
    *   *Cons:* Adds a network hop (latency).
3.  **Server-Side Routing (Redis Cluster Approach):**
    *   The app sends the request to *any* Redis node (e.g., Server 1). Server 1 calculates the hash and says, "I don't own this. Server 3 does." It either forwards the request internally or returns a `MOVED` redirect error to the client.

---

## 3. The Internal Data Structure (LRU Cache)

Once the request reaches the correct server, how is the data stored in RAM efficiently?

A single cache server is just an implementation of the **Least Recently Used (LRU) algorithm**. 

To build an LRU Cache that achieves `O(1)` time complexity for both `GET` and `PUT`, we must combine two data structures:
1.  **Hash Map:** `Key -> Pointer to Node`. This allows `O(1)` lookups.
2.  **Doubly-Linked List:** Holds the actual values and tracks "recency".

### The LRU Mechanism
*   **The Head of the List:** The Most Recently Used item.
*   **The Tail of the List:** The Least Recently Used item.
*   **On GET:** We find the item using the Hash Map in `O(1)`. We unlink the node from the middle of the Linked List and move it to the Head.
*   **On PUT (New):** We insert it at the Head.
*   **On PUT (Eviction):** If the Linked List is at max capacity (e.g., 64GB of RAM is full), we look at the Tail. We delete the Tail node from the List AND delete its key from the Hash Map. Then we insert the new item at the Head.

---

## 4. High Availability & Replication

RAM is volatile. If a server physically loses power, the RAM is wiped. 

### Strategy 1: Replication (Master-Slave)
Every Primary Cache Server has a Secondary Replica.
*   When the Application writes to the Primary, the Primary asynchronously replicates the write to the Secondary.
*   If the Primary dies, a gossip protocol (like Redis Sentinel) detects the failure and promotes the Secondary to Primary.
*   *Tradeoff:* We use 2x the memory.

### Strategy 2: Persistence (RDB & AOF)
We write the RAM state to a hard drive so we can recover it upon reboot.
1.  **Snapshotting (RDB):** Every 5 minutes, we freeze the RAM state and dump the entire 64GB payload onto the SSD.
    *   *Flaw:* If it crashes at minute 4, we lose 4 minutes of data.
2.  **Append-Only File (AOF):** Every single write command (`SET x 5`) is instantly appended to a text log on disk. Upon reboot, the server simply re-plays every command in the log to rebuild the exact RAM state.
    *   *Flaw:* Replaying 1 billion commands on boot takes 20 minutes.

*(Redis uses a combination of both RDB and AOF to achieve maximum speed and safety).*
