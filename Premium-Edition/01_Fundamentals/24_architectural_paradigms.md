# Part 24: Architectural Paradigms

Understanding individual components (like Redis or Kafka) is essential, but a Senior Engineer must understand how to architect the glue that binds them all together securely and predictably.

---

## 🏛️ 1. Monoliths vs. Microservices

### The Monolith
All business logic (Authentication, Billing, Shipping, User Profiles) runs in a single process, deployed deployed as a single massive executable (e.g., one huge `.war` file for Java, one massive Django app).
*   **Pros:** Easy to deploy. Local debugging is trivial. No inter-service network latency. Perfect transactional integrity (a single SQL database handles `BEGIN; UPDATE users; UPDATE billing; COMMIT;`).
*   **Cons:** Any single bug (like an infinite loop in the User Profile code) crashes the entire application (including Billing). It scales terribly (if Billing needs 100 servers on Black Friday, but Shipping only needs 2, you have to deploy 100 identical massive Monoliths, wasting immense memory).

### The Strangler Fig Pattern (Migration)
How do you safely move from Monolith to Microservices without downtime?
1.  Do not rewrite the entire Monolith at once. That takes 3 years and usually fails.
2.  Put an API Gateway in front of the Monolith.
3.  Rewrite *one specific, small domain* (e.g., "Reviews") as a new, standalone Microservice.
4.  Configure the API Gateway to route `/api/reviews` to the new Microservice, while routing everything else `/api/*` to the legacy Monolith.
5.  Slowly, over years, "strangle" the Monolith by peeling off features one by one until the Monolith is empty.

---

## 🚦 2. Event-Driven Architecture (EDA) & Event Sourcing

In a traditional CRUD app (Create, Read, Update, Delete), the database stores the *current state* of an entity. 

**The CRUD Problem:** You lose the history. If you update a User's Bank Balance from $100 to $50, the database overwrites the row. You no longer know *why* or *when* they had $100. (Unless you maintain massive, slow audit tables).

### Event Sourcing
Instead of storing the *Current State*, you store an append-only log of *every immutable event* that has ever happened to the object.
*   **Event 1:** `AccountCreated (Balance 0)`
*   **Event 2:** `DepositReceived (+100)`
*   **Event 3:** `WithdrawalApproved (-50)`
*   **The Current State:** You derive the current balance ($50) by mathematically "replaying" the entire event log from the beginning in memory.

### CQRS (Command Query Responsibility Segregation)
Event Sourcing guarantees a perfect audit trail, but "replaying 50,000 events to calculate a user's final bank balance" on every page load is far too slow for reads.

**The Solution:** We explicitly split the system into two distinct halves:
1.  **Command Path (Writes):** Users send Commands (e.g., `WithdrawMoney`). These Commands execute business logic and persist immutable Events to an Event Store (like Kafka or EventStoreDB).
2.  **The Projection Engine:** A background worker listens to the Event Store. When it hears `WithdrawalApproved (-50)`, it instantly updates a highly optimized Read-Database (e.g., Redis: `SET user:balance 50`).
3.  **Query Path (Reads):** When the user opens the mobile app, they do not ask the Event Store. They instantly fetch their balance from the optimized Redis Read-Database.

*Use Cases:* Banking, Accounting systems, high-frequency stock trading platforms.

---

## 🕸️ 3. The Service Mesh (Istio / Envoy)

**The Problem:** You have 500 distinct microservices. They all talk to each other over the internal network.
*   *Security:* Anyone on the internal network can wiretap the traffic if it isn't encrypted identically.
*   *Resilience:* If Service A calls Service B, and B fails, A needs logic to retry with Exponential Backoff.
*   *Discovery:* Service A needs to know the IP addresses of the 50 instances of Service B.
*   *The Disaster:* If you force every developer to manually write "Retry Logic", "mTLS Encryption", and "Service Discovery" code in Python, Java, Go, and NodeJS, it will be a chaotic, buggy nightmare.

**The Solution: The Service Mesh Sidecar**
A Service Mesh is a dedicated infrastructure layer (usually deployed in Kubernetes).

*   **How it Works (The Sidecar Pattern):** K8s automatically injects a tiny "Proxy Container" (e.g., Envoy) directly next to every single Application Container in the identical Pod.
*   *The Application Code:* The python developer writes `requests.get("http://service-b/")`. They write zero security, zero retry logic, zero load balancing. The app thinks it's a simple, local network call.
*   *The Magic:* The Envoy Proxy transparently intercepts that outgoing HTTP request. The Proxy automatically:
    1. Looks up the IP for Service B.
    2. Encrypts the payload with mTLS.
    3. Adds tracing IDs (OpenTelemetry).
    4. Automatically retries if the network blips.
    5. Sends it over the wire to Service B's Proxy, which decrypts it and delivers it locally.

*   *Benefits:* Complete separation of concerns. Developers write pure business logic. Infrastructure Engineers manage the global Service Mesh configuration for security and resilience without touching application code.
