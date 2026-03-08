# Part 21: API Design Deep Dives

APIs are the contracts that bind your microservices and client applications together. Designing a poor API guarantees technical debt, scaling bottlenecks, and furious frontend engineers.

---

## 🗂️ 1. API Pagination: Offset vs. Cursor

When a user opens Instagram, you cannot send all 10 Million photos in one API response. You must paginate the data. But the mathematical approach to pagination dictates whether your database will crash under load.

### Method A: Offset/Limit Pagination (The Beginner Mistake)

This is what most junior developers write in SQL:
```sql
SELECT * FROM instagram_posts ORDER BY created_at DESC LIMIT 20 OFFSET 10000;
```
*   *How it works:* "Give me 20 posts, but skip the first 10,000."
*   **The Catastrophic Flaw:** SQL cannot magically jump to row 10,000 in an index. If you ask for `OFFSET 1,000,000`, the database engine must physically scan through the first 1,000,000 rows, discard them, and return the next 20. This is an `O(N)` operation that brings the database to a grinding halt on high pages.
*   **The Secondary Flaw (Data Drift):** If the user is on Page 1, and 5 new photos are posted, then the user clicks "Page 2" (`OFFSET 20`), they will see 5 photos they *already saw* on Page 1 because the entire dataset was pushed down by the new inserts.

### Method B: Cursor-Based Pagination (The Industry Standard)

This is how Facebook, Twitter, and Slack paginate. You completely eliminate the `OFFSET` keyword.

Instead of passing page numbers (`?page=50`), the client passes a pointer (a Cursor) to the exact item they saw last.
```sql
-- Client passes the cursor "?after=post_id_992"
SELECT * FROM instagram_posts 
WHERE created_at < '2023-10-25 10:00:00' -- The timestamp of post 992
ORDER BY created_at DESC 
LIMIT 20;
```
*   **The Magic:** Because `created_at` or `post_id` are Indexed B-Trees, the database engine executes an `O(log N)` instantaneous jump directly to the timestamp of Post 992 and grabs the next 20. Scanning millions of rows is impossible.
*   *Pros:* Consistent, lightning-fast performance regardless of how deep the user scrolls. Immune to Data Drift (duplicate items appearing).
*   *Cons:* You cannot support "Jump to Page 54" UI buttons easily. It forces infinite-scroll UI paradigms.

---

## 🔗 2. API Idempotency (Preventing Double-Charges)

**Scenario:** A user is buying concert tickets on their phone. They click "Purchase $100". The phone sends a `POST /charge` API request to Stripe. Stripe successfully charges their credit card $100.
*   *The Disaster:* The user's cell tower drops the TCP connection before Stripe can reply "Success". The phone thinks the request failed. The phone automatically retries the `POST /charge` request. Stripe charges them *another* $100. The user sues your company.

**Solution: Idempotency Keys**

An API endpoint is "Idempotent" if making multiple identical requests has the same effect as making a single request. 

*   `GET`, `PUT`, and `DELETE` are naturally idempotent. (`DELETE /user/5` a hundred times leaves the database in the exact same state).
*   `POST` (creating something new or executing an action) is **NOT** idempotent.

To fix the payment scenario, the Frontend must explicitly solve it:
1.  When the user opens the checkout page, the phone generates a UUID (e.g., `8f4b-29c1`).
2.  The phone sends the request: `POST /charge` with Header `Idempotency-Key: 8f4b-29c1`.
3.  Stripe receives the request. Before doing *anything*, Stripe checks a Redis cache for `8f4b-29c1`.
4.  If not found, Stripe charges the card, saves the successful "$100 charged" payload to Redis against the key `8f4b-29c1`, and attempts to reply to the phone.
5.  If the connection drops, and the phone retries with the *same* Header `Idempotency-Key: 8f4b-29c1`...
6.  Stripe sees the key in Redis! It immediately skips the credit card processing step and just returns the *exact identical cached success response* from the first attempt. Perfect safety.

---

## 🏗️ 3. REST vs. GraphQL

### The Flaws of REST
REST requires strict, unchangeable endpoints (e.g., `/users/123/profile`).
1.  **Over-Fetching:** A mobile screen just needs the User's Name and Avatar. But the `GET /profile` REST endpoint arbitrarily returns 400 fields of JSON (Address, Bio, Settings, Payment History), wasting massive mobile bandwidth.
2.  **Under-Fetching & The N+1 Problem:** To render a timeline, the frontend calls `GET /posts` to get 20 Post IDs. Then it has to make 20 simultaneous API calls to `GET /posts/1/comments`, `GET /posts/2/comments`. These cascading network round-trips destroy mobile performance.

### The GraphQL Solution (Developed by Facebook)
Instead of 50 different endpoints, GraphQL uses exactly **one** endpoint (`POST /graphql`).
*   The API does not decide what data to return. The *Client* sends a query explicitly dictating the exact shape of the JSON it wants back.

**The Client's Payload:**
```graphql
query {
  user(id: "123") {
    name
    avatar_url
    posts(limit: 2) {
      title
      comments {
        author
        text
      }
    }
  }
}
```
**The Magic:** The server interprets this graph, hits exactly the necessary underlying microservices or databases, and returns the strictly formatted JSON data in a *single network round-trip*. No over-fetching, no under-fetching.

*   *Tradeoffs:* GraphQL is incredibly complex to cache via standard CDNs (because every request is a unique `POST` instead of cacheable `GET` URLs). It also pushes the "N+1 Problem" from the network layer down into the database resolver layer, requiring complex `DataLoader` batching logic to prevent database crashes.
