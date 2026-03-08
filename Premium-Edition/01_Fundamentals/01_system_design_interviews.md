# Part 1: Approaching System Design Interviews

Welcome to the premium Masterclass. This chapter equips you with a mental framework to conquer any System Design Interview (SDI). SDIs are fundamentally different from algorithmic coding interviews. There is rarely one "correct" answer. Instead, the interviewer wants to see your thought process, your ability to navigate trade-offs, and your capability to gather requirements before jumping to conclusions.

---

## 🛑 The Golden Rule of System Design
**Never dive straight into the solution.** If an interviewer says, "Design Twitter," the worst thing you can do is immediately say, "We need a Load Balancer, a Cassandra Database, and Redis." 

Why? Because you have no idea what "Twitter" means in this context. Are you designing the read-heavy news feed, the write-heavy trending algorithm, or the notification system? 

To succeed, you must drive the conversation using a structured, **6-Step Framework**.

---

## 🗺️ The 6-Step SDI Framework

### Step 1: Clarify Requirements (3-5 Minutes)
Your first goal is to aggressively narrow the scope. Treat the interviewer like a Product Manager. You need to extract the exact feature set and constraints.

**A. Functional Requirements:** What does the system actually do?
*   *Example (Twitter):* Users can post tweets (text only, or images?). Users can follow others. Users can view a timeline of followed tweets.

**B. Non-Functional Requirements:** What are the system qualities?
*   *Scale:* How many Daily Active Users (DAU)? (Determines if you need 1 server or 10,000 servers).
*   *Availability vs. Consistency:* Is it okay if a tweet takes 2 seconds to appear for a follower (Eventual Consistency), or must it be instant (Strong Consistency)?
*   *Latency:* Does the newsfeed need to load in under 200ms?

### Step 2: Back-of-the-Envelope Estimation (3-5 Minutes)
You need to prove you understand the sheer mathematical scale of the problem. (We will cover the exact math in the next chapter).
*   **Traffic Estimates:** Calculate Requests Per Second (RPS) or Queries Per Second (QPS) for Read and Write operations.
    *   *Rule of Thumb:* 100 million requests per month ≈ 40 requests per second.
*   **Storage Estimates:** How much data are we writing per day? Per year? Let's say 10M tweets/day at 100 bytes each = 1GB/day = 365GB/year.
*   **Bandwidth Estimates:** Are we serving massive 10MB images, or tiny text JSON payloads?

### Step 3: Define the System Interface / API (2-4 Minutes)
Define the API signatures. This solidifies the "contract" of what your system will do.
*   `post_tweet(user_id, tweet_context, media_ids)`
*   `get_timeline(user_id, pagination_token)`
*   `follow_user(follower_id, followee_id)`

### Step 4: Define the Data Model (4-6 Minutes)
Before drawing boxes, define how data is stored. This step heavily influences whether you choose SQL or NoSQL.
*   **Entities:** Users, Tweets, FollowerMappings.
*   **Database Choice:** Do we need strong ACID transactions (SQL) or massive horizontal scalability with eventual consistency (NoSQL Cassandra/DynamoDB)?

### Step 5: High-Level Design (HLD) (10 Minutes)
Now, draw the 10,000-foot view. Start simple.
1.  **Client:** Web, Mobile App.
2.  **API Gateway/Load Balancer:** The entry point.
3.  **Application Servers:** Stateless logic processors.
4.  **Database:** The persistence layer.

*Don't try to add caches, message queues, or sharding yet. Draw the "Happy Path" that works for 1,000 users.*

### Step 6: Deep Dive and Identify Bottlenecks (15-20 Minutes)
This is where you earn your senior engineer badge. Look at your HLD and ask, "Where does this break at 100 Million users?"
*   **Bottleneck:** "Writing to the database directly for every tweet will kill the DB."
    *   *Solution:* Introduce a Message Queue (Kafka) to buffer bursts of writes.
*   **Bottleneck:** "Generating the news feed by querying the DB on every single page load is too slow."
    *   *Solution:* Introduce a Distributed Cache (Redis / Memcached) to hold pre-computed timelines.
*   **Bottleneck:** "The database is holding 500 Terabytes and single queries take seconds."
    *   *Solution:* Implement Data Partitioning / Sharding based on `user_id`.

---

## 🧠 Managing the Interviewer
*   **Think Out Loud:** A silent candidate is a failing candidate. Say, "I'm considering SQL vs NoSQL here. Because we need massive read scale and don't care about strict ACID compliance across tables, I'm leaning toward Cassandra."
*   **Acknowledge Trade-offs:** There are no silver bullets. If you use a cache, you must explicitly state the trade-off: "Caching solves read latency, but introduces the complexity of cache invalidation and data staleness."
*   **Drive the Conversation:** Don't wait for them to ask you what to do next. Say, "Now that we have the HLD, I'd like to dive into the database sharding strategy. Does that sound good?"
