# Design 2: Photo Sharing / Social Media (Instagram / Twitter)

When designing a social media platform like Instagram or Twitter, the core functionality revolves around two extremely distinct workloads:
1.  **Write/Upload:** Users uploading massive blobs of data (Photos/Videos).
2.  **Read/Newsfeed:** Generating a personalized, chronologically sorted timeline of content from the people you follow.

---

## 1. Clarification & Requirements

### Functional Requirements
1.  **Posting:** Users can upload photos (or tweets) with text.
2.  **Following:** Users can follow other users.
3.  **Timeline:** Users can view a scrollable newsfeed consisting of top photos from all the users they follow.

### Non-Functional Requirements
1.  **Read-Heavy Model:** Viewing feeds dominates posting photos (`100:1` read-to-write ratio).
2.  **Timeline Generation Latency:** Generating the newsfeed must be insanely fast (under 200ms). If it takes 3 seconds to load the feed, users leave the app.
3.  **High Availability:** The system must never go down. Eventually consistent data is perfectly acceptable (e.g., if my friend uploads a photo, it's fine if I see it 3 seconds later, rather than instantaneously).

---

## 2. Infrastructure Math & Scale

Let's assume **500 Million Daily Active Users (DAU)**.

*   **New Photos:** 2 million new photos per day.
*   **Photo Size:** 2 Megabytes (MB) per payload.
*   **Storage (Writes):** `2M photos/day * 2MB = 4 Terabytes (TB) per day.` (This is purely the media blob size, not the relational metadata.)
*   **Read Traffic (Feeds):** `500M users * 5 feed refreshes/day = 2.5 Billion feed queries/day.`
*   `2.5 Billion / 10^5 seconds = ~25,000 requests per second (RPS) read traffic.`

This system requires massive Blob storage for images and a highly scalable NoSQL architecture to handle the 25k Read RPS.

---

## 3. The Core Challenge: The "Celebrity" Problem

Generating the timeline is the hardest part of building social media. How do we build my feed?

### Approach 1: "Pull" (Read-Time Generation)
When John opens Instagram, the server:
1.  Queries the DB: "Who does John follow?" (Result: Alice, Bob, Charlie).
2.  Queries the DB: `SELECT * FROM Photos WHERE user_id IN (Alice, Bob, Charlie) ORDER BY timestamp DESC LIMIT 20;`
3.  Sends the 20 photos back to John.

*   **The Disaster:** If John follows 1,000 people, compiling this SQL query (`JOIN`ing thousands of rows and sorting them on the fly) takes 3-5 seconds. We need sub-200ms latency. At 25,000 RPS, the database cluster will instantly melt down.

### Approach 2: "Push" (Write-Time Generation - Fan-Out)
Instead of building the feed when John opens the app, we *pre-build* it in memory (Redis) the moment someone uploads a photo. This is called **Fan-Out on Write**.
1.  Alice uploads a new photo.
2.  A worker node immediately grabs all 500 people who follow Alice.
3.  The worker literally copies the `photo_id` into the Redis-backed Newsfeed of all 500 followers.
4.  When John opens the app, the server just grabs John's pre-computed list `Redis.get(john_newsfeed)`. Latency is an incredible `<1ms`.

*   **The Disaster (The Celebrity Problem):** What if Justin Bieber (with 100 Million followers) uploads a photo? The worker node must execute 100 Million database/Redis writes to push that photo into 100 Million distinct timelines. This single photo upload crashes the background processing cluster.

### Approach 3: The Hybrid Fan-Out Architecture (The Industry Standard)
We combine Pull and Push.
1.  **For Normal Users (e.g., Alice with 500 followers):** We use **Push**. It is extremely efficient to write 500 Redis records.
2.  **For Celebrities (e.g., Justin Bieber):** We explicitly mark them as "Celebrities" in our DB and DISABLE Push for them.
3.  When John opens the app, the `FeedService`:
    *   Grabs John's pre-computed Redis feed (containing all normal users).
    *   **Pulls** the latest posts from any Celebrities John follows.
    *   Merges the two lists in memory, sorts them, and returns them to John. Latency is incredibly low, and we protected the write cluster.

---

## 4. High-Level Design (HLD)

When dealing with a write-heavy and read-heavy system simultaneously, decouple them completely using **Message Queues**.

```mermaid
graph TD
    User((User app)) --> Gateway[API Gateway]
    
    Gateway --> PostSvc[Post Service / API]
    Gateway --> FeedSvc[Newsfeed API]
    
    PostSvc -->|1. Store Image Blob| S3Media[(Amazon S3)]
    PostSvc -->|2. Store Metadata| DB_MetaData[(Cassandra NoSQL)]
    PostSvc -->|3. Async Event| Kafka[Kafka Event Queue]
    
    Kafka --> PushWorkers[Fan-Out Workers]
    PushWorkers -->|Fetches Normal Followers| DB_MetaData
    PushWorkers -->|Pre-generates Feeds O(1)| RedisFeeds[(Redis User Timelines)]
    
    FeedSvc -.->|Step 1: Get Normal Feed| RedisFeeds
    FeedSvc -.->|Step 2: Pull Celeb| DB_MetaData
    FeedSvc -->|Merged List back| User
```

---

## 5. Low-Level Database Schema (NoSQL Cassandra)

We cannot use PostgreSQL. A table with 100 Billion Photos and massive cross-joins will not scale. We use a Wide-Column NoSQL database like **Cassandra**.

Cassandra excels at `O(1)` appending to the end of massive lists.

**Table 1: User_Timeline (Denormalized)**
*Purpose: Extremely fast retrieval of a pre-computed timeline.*
*   `user_id` (Partition Key - Determines which server physical holds this timeline)
*   `creation_time` (Clustering Column - Automatically sorts the timeline chronologically on disk)
*   `photo_id` (Text)
*   *Note: Cassandra stores the data physically ordered by the clustering column. When John asks for his timeline, it takes 2ms to read the first 20 rows because they are literally stored next to each other on the SSD.*

**Table 2: Photo_Metadata**
*Purpose: The source of truth for the image.*
*   `photo_id` (Partition Key)
*   `user_id`
*   `s3_image_url` (Text)
*   `latitude`, `longitude`

**Table 3: User_Relationships**
*Purpose: Keeping track of followers.*
*   `followee_id` (Partition Key - "Who is being followed, e.g., Justin Bieber")
*   `follower_id` (Clustering Column - "Who is following him")
*   *Why?* When Justin posts a photo, the PushWorker must query `SELECT follower_id WHERE followee_id = 'Justin'`. Because the partition key is Justin, every single one of his followers is stored on the exact same physical shard, making the lookup milliseconds instead of querying 10 different servers.
