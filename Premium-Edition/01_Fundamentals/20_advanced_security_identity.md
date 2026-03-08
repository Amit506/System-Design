# Part 20: Advanced Security & Identity

Security is no longer an afterthought in system design. As breaches become more sophisticated, the modern architecture requires defending against data exfiltration, lateral internal movement, and malicious token replay.

---

## 🛡️ 1. Authentication vs Authorization

They are fundamentally different, and mixing them up in an interview is a lethal error.

### Authentication (AuthN) - "Are you who you say you are?"
Proving identity.
*   **Methods:** Passwords, FaceID (Biometrics), Multi-Factor Authentication (MFA), One-Time Passwords (OTPs) via SMS.
*   **The Artifact:** Usually, successful authentication results in the generation of a Session Cookie or a JSON Web Token (JWT).

### Authorization (AuthZ) - "What are you allowed to do?"
Validating permissions.
*   **Scenario:** John proved he is John (AuthN). But is John allowed to delete the database table? No. 
*   **Methods:** Role-Based Access Control (RBAC - "You are an Admin"), Attribute-Based Access Control (ABAC - "You can edit this post because your User ID matches the Author ID of the post").

---

## 🔑 2. JSON Web Tokens (JWT) vs Session Cookies

How does the API Gateway know who is making the request?

### 1. Stateful Session Cookies (The Old Way)
*   **How it works:** User logs in. Server checks the database. If correct, the server generates a random string (e.g., `SessionID: xyz123`). The server saves `xyz123 -> User 5` in its own PostgreSQL database (or Redis cache). It sends `xyz123` back to the browser as a hardened HTTP-Only Cookie.
*   *Pros:* Extremely secure against XSS. The server has total control. It can instantly ban a user by deleting `xyz123` from Redis.
*   *Cons:* Does not scale beautifully. If you have 500 API Gateway servers, they all have to query a central Redis database on *every single request* just to figure out who `xyz123` is. This adds network latency to every call.

### 2. Stateless JSON Web Tokens (JWT) (The Modern Way)
*   **How it works:** User logs in. Server encrypts the user's data (e.g., `{"id": 5, "role": "admin"}`) using a highly secure private RSA key. This huge generated string (the JWT) is sent to the client. The client sends it back in the `Authorization: Bearer <token>` header on every request.
*   **The Magic:** The 500 API Gateways do not need to talk to a database. They just use their public RSA key to mathematically *verify* the signature on the JWT. If the math checks out, they trust the payload `{"id": 5}` instantly.
*   *Pros:* Infinitely scalable. Zero database lookups for authentication.
*   *Cons:* Very hard to revoke. If a hacker steals a JWT that is valid for 1 hour, there is almost no way to stop them for that entire hour, because the API Gateways are verifying it mathematically, not checking a central ban-list database. (This requires complex refresh token rotations).

---

## 🔐 3. OAuth 2.0 and Single Sign-On (SSO)

When you see a button that says "Log in with Google" or "Log in with Apple," that relies on OAuth 2.0.

### The Problem
You build a new CRM application. You don't want to manage passwords, handle password resets, or worry about getting hacked. You want Google to handle it.

### The Flow (Authorization Code Grant)
1.  **Redirection:** User clicks "Log in with Google" on your app. You redirect their browser entirely away from your site to `accounts.google.com`.
2.  **Consent:** Google asks the user for their password (on Google's secure servers, so your app never sees it). Google then asks "Do you want to share your email with CRM-App?"
3.  **The Authorization Code:** If approved, Google redirects the user back to your app, appending a short-lived `code=xyz987` to the URL.
4.  **The Token Exchange (Server to Server):** Your backend server securely takes `xyz987` and sends an invisible API request directly to Google's backend, passing your secret API App password. Google verifies the code and gives your backend the golden **Access Token**.

---

## 🚷 4. Zero Trust Architecture (mTLS)

Historically, networks relied on a "Castle and Moat" security model. If a hacker breached the perimeter firewall (the Moat), they could roam freely inside the corporate network because internal servers trusted each other blindly.

**Zero Trust** means exactly what it sounds like. "Never Trust, Always Verify."
Even if Service A and Service B are running inside the same AWS VPC in the same server rack, they do not trust each other.

### Mutual TLS (mTLS)
When your laptop talks to `amazon.com`, the server provides a TLS certificate proving it is Amazon. This is one-way TLS. 

In microservices, we use **Mutual TLS**:
1.  Service A (Orders) wants to talk to Service B (Payments).
2.  Service B demands a cryptographic certificate proving Service A is definitively the Orders service.
3.  Service A demands a cryptographic certificate proving Service B is definitively the Payments service.
4.  Only when both mathematically verify each other's identity do they open the encrypted channel.
*   *Benefits:* If a hacker gains remote code execution on the "Images" service, they cannot arbitrarily send requests to the "Payments" service, because the Images service lacks the proper mTLS certificates for financial APIs. (Usually managed automatically by a **Service Mesh** like Istio).
