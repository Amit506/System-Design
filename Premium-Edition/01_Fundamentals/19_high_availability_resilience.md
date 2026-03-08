# Part 19: High-Availability & Resilience Patterns

In distributed systems, failure is not a possibility—it is an absolute certainty. Hardware degrades, network switches drop packets, and external APIs experience downtime. High Availability (HA) engineering is the art of designing systems that gracefully absorb these cascading failures without crashing the entire platform.

---

## 🛑 1. The Circuit Breaker Pattern

If your application depends on a slow or failing external microservice (e.g., Stripe Payment API), repeatedly trying to call it will quickly exhaust your own server's thread pool and memory.

**How the Circuit Breaker Works:**
It acts as a state machine sitting between your service and the external service.

1.  **Closed State (Normal):** Everything is healthy. Requests flow through normally.
2.  **Open State (Failing):** If the external service fails X times within Y seconds (e.g., 5 timeouts in 10 seconds), the circuit "trips" open. For a configurable timeout period (e.g., 30 seconds), the Circuit Breaker instantly rejects all new requests, returning a hardcoded error or fallback response (like "Payments temporarily degraded"). *Crucially, this prevents your app from waiting on timeouts and protects the struggling external service from being DDOSed while it tries to recover.*
3.  **Half-Open State (Testing):** After 30 seconds, the breaker allows exactly ONE test request to pass through. If it succeeds, the circuit closes (back to normal). If it fails, the circuit opens again for another 30 seconds.

*Real-World Example:* Netflix's Hystrix library (now Resilience4j).

---

## 🚢 2. The Bulkhead Pattern

Named after the watertight compartments built into the hulls of ships (like the Titanic). If one compartment floods, the watertight doors close, preventing the whole ship from sinking.

**How it Works in Software:**
You isolate resources into pools so that if one part of your system fails, it doesn't drain the resources of the entire application.

*   *Scenario:* You have a monolithic app handling both `/search` and `/checkout`. You have a global connection pool of 100 database threads.
*   *The Disaster:* A bad code deployment causes the `/search` database queries to take 30 seconds each. Within seconds, all 100 threads are tied up waiting for `/search`. Now, users trying to hit `/checkout` cannot get a database thread, and the entire app crashes.
*   *The Bulkhead Solution:* You create two distinct thread pools: 80 threads strictly for `/search` and 20 threads strictly for `/checkout`. If `/search` hangs again, it will consume its 80 threads and fail, but the 20 checkout threads remain perfectly pristine, allowing the company to still collect revenue.

---

## 🔁 3. Retries, Exponential Backoff, and Jitter

When a network request fails due to a temporary glitch, the immediate instinct is to retry the request.

*   **The Naive Retry Problem:** If a backend server drops offline for 2 seconds, and 50,000 clients instantly retry their failed requests in a tight loop, they will create a massive, synchronized DDOS attack that destroys the server the millisecond it comes back online.

*   **1. Exponential Backoff:** You must stagger the retries. Try after 1s, then 2s, then 4s, then 8s. This buys the backend time to recover.
*   **2. Jitter (Randomness):** Even with exponential backoff, all 50,000 clients might execute their "4-second retry" at the exact same millisecond. You must introduce *Jitter* by adding a random integer to the backoff equation: `(2^retry_count) + random(0, 1000ms)`. This mathematically smooths out the massive traffic spike into a manageable rolling wave.

---

## 🌪️ 4. Disaster Recovery: RTO vs. RPO

When a hurricane destroys your primary AWS datacenter in `us-east-1` (Virginia), how does the business survive?

You must define two critical Service Level Agreements (SLAs) with the business:

1.  **RPO (Recovery Point Objective):** The maximum acceptable amount of data loss measured in time.
    *   *Example: RPO of 15 minutes.* This means you must back up your database to a different region at least every 15 minutes. If a meteor hits Virginia, the business accepts that orders placed in the last 14 minutes are permanently vaporized.
2.  **RTO (Recovery Time Objective):** The maximum acceptable time the system can be completely offline before massive financial damage occurs.
    *   *Example: RTO of 4 hours.* This gives engineers 4 hours to spin up the backup infrastructure in `us-west-1` (California), restore the database from backups, and redirect DNS.

### Deployment Topologies
*   **Active-Passive (Pilot Light):** `us-east` takes 100% of traffic. `us-west` has a tiny database replica running, but no expensive compute servers. If `us-east` dies, you spend 30 minutes booting up servers in `us-west`. (High RTO, Cheap).
*   **Active-Active (Multi-Region):** Both `us-east` and `us-west` serve live customer traffic 50/50 simultaneously. If `us-east` dies, Route53 DNS instantly routes 100% of traffic to `us-west`. (Near-Zero RTO, Extremely Expensive and complex to keep databases synced across continents).


---

## Frequently Asked Tricky Interview Questions
**Q: "If your system boasts 99.999% (Five Nines) Availability, how much acceptable downtime does that strictly allow per year?"**
*Answer:* 5.26 Minutes per **Year**. This is an absurdly tight constraint. It means you cannot have human operators manually intervening in an outage. The system *must* be fully self-healing, active-active multi-region, and geographically load-balanced automatically under 30 seconds.

**Q: "How does a 'Bulkhead Pattern' isolate failures differently from a 'Circuit Breaker'?"**
*Answer:* A Circuit Breaker stops making outbound requests internally if the downstream service is dead, preventing local thread exhaustion. A **Bulkhead** is architectural isolation (named after partitions in a submarine). If the "Payment Microservice" uses the exact same Database Connection Pool as the "Search Microservice", a massive spike in user searches will exhaust the DB pool, causing Payments to instantly fail. A Bulkhead physically enforces separate connection pools, separate hardware limits, or dedicated threads. Even if the Search API crashes violently, the Payment API remains functionally insulated and 100% operational.
