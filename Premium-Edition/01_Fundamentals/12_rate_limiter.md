# Part 12: Rate Limiting Algorithms

A Rate Limiter is a defensive mechanism that controls the rate of traffic sent by a client or a service. In the context of APIs, an API rate limiter restricts the number of client requests allowed over a specified time period. If the API request count exceeds the limit threshold, all excess calls are blocked.

---

## 🚦 Why Do We Need Rate Limiting?

1.  **Prevent DDoS Attacks:** Malicious actors sending 100,000 requests per second to crash your servers.
2.  **Reduce Costs:** If you pay AWS per request or per compute cycle, a runaway script on a client's machine can cost you thousands of dollars abruptly.
3.  **Prevent Server Overload:** Protect backend components (like slow SQL databases) from being overwhelmed during unexpected viral traffic spikes.
4.  **Resource Fairness:** Ensure that one "noisy neighbor" user doesn't consume 99% of your API bandwidth, leaving nothing for the rest of your customers.

---

## ✨ Where to Implement the Rate Limiter?

*   **Client-Side:** Highly unreliable. Malicious actors will simply bypass your client application and hit the API directly using cURL or Postman.
*   **Server-Side:** You can build rate-limiting directly into your API application code (e.g., NodeJS middlewares).
*   **API Gateway (Industry Standard):** The most common place to put a rate limiter is at the perimeter, in front of your application servers. Services like Amazon API Gateway, Cloudflare, or an NGINX reverse-proxy handle rate limiting natively.

---

## ⚙️ The 4 Core Rate Limiting Algorithms

To design a rate limiter in an interview, you must know these mathematical algorithms.

### 1. The Token Bucket Algorithm
This is the most popular, widely understood algorithm (used by Amazon and Stripe).

*   **How it Works:** Imagine a literal bucket that holds a maximum of $N$ tokens. Every $X$ seconds, a "refiller" drops a new token into the bucket.
*   When a request arrives, it tries to grab a token from the bucket.
    *   If a token exists, the request takes it, proceeds to the API, and the bucket token count decreases by 1.
    *   If the bucket is empty (0 tokens), the request is dropped (HTTP `429 Too Many Requests`).
*   **Pros:** Very easy to implement. Highly memory efficient. It allows for short bursts of traffic (if the bucket was full, a user can instantly send $N$ requests in one second).
*   **Cons:** Tuning the exact bucket size and refill rate can be tricky.

### 2. The Leaking Bucket Algorithm
Similar to the token bucket, but requests are processed at a strictly fixed rate. It is usually implemented using a First-In-First-Out (FIFO) queue.

*   **How it Works:** Imagine a bucket with a small hole in the bottom. Water (requests) pours into the top of the bucket. Water drips out of the bottom hole at a constant, fixed rate (e.g., 5 drips per second).
*   If water pours in faster than it drains, the bucket fills up. Once the bucket is totally full, any new water poured in instantly spills over the sides and is discarded (HTTP 429).
*   **Pros:** Guarantees a perfectly smoothed, stable outflow rate for your backend servers. Great for protecting fragile legacy databases.
*   **Cons:** A sudden burst of traffic will fill up the bucket with old requests. If they process slowly, newer, perhaps more important requests are immediately discarded because the bucket is full of the old burst.

### 3. Fixed Window Counter
*   **How it Works:** The timeline is divided into fixed time windows (e.g., 1:00:00 to 1:01:00 is Window 1). Each window has a counter starting at 0.
*   Every request increments the counter. If the counter hits the limit (e.g., 100), all further requests in that exact time window are dropped.
*   **Pros:** Extremely memory efficient and easy to understand.
*   **Cons (The Boundary Spike Problem):** If the limit is 100 per minute, a user could send 100 requests at 1:00:59, and another 100 requests at 1:01:01. The system technically respected the limits, but your server just got hit with 200 requests in a 2-second span, defeating the purpose of the limiter.

### 4. Sliding Window Log
This algorithm completely fixes the "Boundary Spike" problem of the Fixed Window.

*   **How it Works:** Instead of counting integer numbers, we keep a "Log" of the exact timestamp of every single request. (Often stored in a Redis Sorted Set).
*   When a new request arrives, we look at its timestamp (e.g., 1:01:15).
*   We delete all timestamps in the log older than our exact sliding window (e.g., anything older than 1:00:15).
*   We count how many logs remain. If the count exceeds the limit, we drop the request. Otherwise, we log the new timestamp and process the request.
*   **Pros:** Perfect accuracy. The rate limit is strictly enforced in any rolling time window.
*   **Cons:** Consumes a massive amount of memory, because you are storing millions of explicit datetime stamps instead of just a single integer counter.

---

## 🏗️ High-Level Design (Distributed Implementation)

If you only have one monolithic server, a rate limiter is just a hash map in memory. But distributed systems have dozens of gateway servers.

### The Problem:
If UserA hits Gateway 1, the counter is 1. Next second, UserA hits Gateway 2. If Gateway 2 is tracking counters locally, it doesn't know UserA already used a request.

### The Solution: Redis (Centralized Datastore)
Rate Limiting counters must be kept in a centralized, insanely fast in-memory datastore. **Redis is the undisputed king of Rate Limiting.**

1.  Client connects to API Gateway.
2.  API Gateway executes a Redis `INCR` command (or fetches a Token score).
3.  Redis returns the count in 1 millisecond.
4.  Gateway makes the routing decision.

### Edge Case: Redis Race Conditions
If two Gateways read the Redis counter (Value = 4) simultaneously, and both increment it locally and write back (Value = 5), one request was "lost" due to the race condition.
*   **Fix:** Use **Redis Lua Scripts**. A Lua script executes entirely on the Redis server atomically (blocking all other operations for microseconds), ensuring perfect transactional increments without race conditions.


---

## Frequently Asked Tricky Interview Questions
**Q: "A dedicated attacker knows your Rate Limiter blocks them if they exceed 100 requests per minute from their IP address. How do they easily bypass your rate limiter, and how do you defend against it?"**
*Answer:* They use a Botnet or rotating Residential Proxies (changing their IP address on every request). A purely IP-based rate limiter is useless against distributed attacks. 
*Defense:* You must implement **Multi-Tiered Rate Limiting**. 
1. Limit by IP (basic defense).
2. Limit by `User_ID` / API Key (authenticates the actual user across IPs).
3. Limit globally by `Route` (if `POST /login` exceeds global 10,000 requests/sec, the system physically begins shedding load universally to save the database, regardless of IP).

**Q: "If your Rate Limiter uses a Redis cluster, and the Redis cluster physically crashes and dies, what should the API Gateway do?"**
*Answer:* **Fail Open.** Rate limiters are defensive mechanisms. If the defense breaks, you should generally allow traffic to flow to the core application to keep the business running (returning HTTP 200s), rather than failing closed (returning HTTP 500s to all legitimate users because the limiter is dead). You sacrifice backend load safety for user availability.
