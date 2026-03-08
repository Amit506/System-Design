# Part 5: Data Partitioning (Sharding)

A single database server has a physical limit on how much RAM, CPU, and Disk it can hold. When a database grows to Terabytes of data, it becomes too slow to scan and too large to back up effectively. To scale beyond a single machine's physical limits, we must utilize Data Partitioning (also known as Sharding).

---

## 🔪 What is Data Partitioning?

Partitioning divides a large logical database into smaller, more easily managed pieces called "partitions" or "shards". These shards can be distributed across multiple independent servers. From the application's perspective, it feels like communicating with one massive database.

---

## 🧱 Sharding Strategies

There are three primary ways to split a database.

### 1. Vertical Partitioning (Feature-based)
Instead of putting all tables on one server, you put completely different tables/features on different servers.
*   **Example (Instagram):** Server 1 holds user profiles (`users_table`). Server 2 holds the actual photos (`photos_table`). Server 3 holds follow relationships (`followers_table`).
*   **Pros:** Very easy to implement. It aligns nicely with microservice architectures.
*   **Cons:** If the `photos_table` grows to 5 Terabytes on its own, Server 2 will still hit a physical cap. You eventually still need horizontal scaling.

### 2. Horizontal Partitioning (Data-based Sharding)
This is the true definition of "Sharding". You put different rows of the *exact same table* onto different servers based on a specific logic key.
*   **Example:** A `users` table is split. Users A-M go to Server 1. Users N-Z go to Server 2.
*   **Pros:** Theoretically infinite scaling. If a server fills up, just buy another server and re-shard.
*   **Cons:** Re-balancing data when you add a server is painful. Application logic becomes incredibly complex.

### 3. Directory-Based Partitioning
A hybrid approach. The application queries a central "Directory Service" (like Zookeeper or Redis) to ask, "Which server holds the data for User 145?"
*   **Pros:** Absolute control. You can move data around invisibly.
*   **Cons:** The Directory Service becomes a Single Point of Failure and a massive bottleneck, requiring its own robust scaling.

---

## 🔑 Horizontal Partitioning Methods (The Shard Key)

When sharding horizontally, you must choose a "Shard Key" (a column) to route the data. Choosing this key is the most critical DB decision you will make.

### 1. Range Based Partitioning
Data is placed on servers based on a sequential range of values (e.g., Dates or Zips).
*   **Example:** Shard 1 holds tweets from Jan-Feb. Shard 2 holds Mar-Apr.
*   **Pros:** Great for sequential range queries (`SELECT * WHERE date BETWEEN x AND y`).
*   **Cons:** Massive Hotspotting. If everyone is tweeting about an event *today*, الشard 6 (Nov-Dec) gets 100% of the traffic and crashes, while Shard 1 is totally idle.

### 2. Hash Based Partitioning
Apply a mathematical hash to a key (like `user_id` or `uuid`), then use modulo arithmetic (`hash % number_of_servers`) to determine the server.
*   **Example:** `Hash(user_id=145) % 4_servers = Server 3`.
*   **Pros:** Evenly distributes data and load. No single server takes the brunt of reads/writes.
*   **Cons:** Terrible for range queries. Searching for all users in "New York" now requires querying every single shard simultaneously and merging the results. Adding a 5th server ruins the module math (`hash % 5`), forcing you to move almost all your data. (This is solved by Consistent Hashing).

---

## 🔥 The Disasters of Sharding (Why it's so hard)

*Interviewer: "You sharded the database horizontally by user_id to solve the write bottleneck. What problems did you just introduce?"*

1.  **Joins and Denormalization:**
    *   *Problem:* You cannot write a SQL query like `SELECT users.name, photos.url JOIN photos ON user.id = photos.user_id` if the user is on DB Server 1, but their photos are stored on DB Server 7.
    *   *Solution:* Denormalize your data (store duplicate data together so joins aren't needed) or perform the Join manually in your Application code (pull from DB 1, pull from DB 7, merge in Python/Java). It is very slow.

2.  **Distributed Transactions (ACID Failure):**
    *   *Problem:* If a user transfers money to someone on another shard, how do you handle a failure mid-transaction (Two-Phase Commit)? Transactional safety is notoriously difficult across shards.

3.  **The "Celebrity" Hotspot:**
    *   *Problem:* You sharded by `user_id` perfectly. But what if Justin Bieber (User 99) is on Shard 4? Millions of users hitting Shard 4 just to read his timeline will crash Shard 4, while the other shards sleep.
    *   *Solution:* Heavily cache Justin Bieber's data in Redis to protect the shard, or implement custom logic to separate mega-users onto their own dedicated, ultra-powerful isolated database servers.


---

## Frequently Asked Tricky Interview Questions
**Q: "You decided to partition your User database by `user_id % 10`. What is the catastrophic flaw of this approach?"**
*Answer:* This is naive Modulo Hashing. If your traffic grows and you need to add an 11th server to the cluster, the formula becomes `user_id % 11`. Mathematically, almost every single user will now explicitly route to a different server than they did before. You must physically move $90\%$ of your data across the network to re-balance the cluster, causing massive downtime. The solution is **Consistent Hashing**, where adding a node only requires moving $1/N$ of the data.

**Q: "What is the 'Celebrity Problem' (Hot Partitioning), and how do you resolve it if you partition a Social Network purely by `User_ID`?"**
*Answer:* If Justin Bieber (`User_ID = 5`) goes viral, $99\%$ of global traffic queries Server 2 (where his data lives). Server 2 crashes, while Servers 1, 3, and 4 sit completely idle. Sharding solely by `User_ID` creates a Hot Key.
*Solution:* **Compound Routing Keys / Salt Hashing.** You append a random salt to the celebrity's ID or append the timestamp (`User_ID_5_Timestamp`). This mathematically forces their data (and the read traffic) to be sliced and distributed across all the servers in the cluster evenly.
