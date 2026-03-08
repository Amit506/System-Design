# Part 7: Proxies, Firewalls, and CDNs

When a user typed `www.facebook.com` into their browser a decade ago, the request went directly to a massive server rack sitting in California. If you lived in India, that request had to travel across suboceanic fiber optic cables, taking upwards of 300 milliseconds just to say "Hello" (the TCP Handshake).

Modern architectures do not let user traffic touch their core data centers directly. They use Proxies and CDNs.

---

## 🛡️ Forward vs. Reverse Proxies

A **Proxy Server** is an intermediary piece of hardware or software that sits between a client and a server, filtering or modifying requests.

### 1. The Forward Proxy (Protecting the Client)
A forward proxy sits in front of a group of client machines. When those client machines make requests to sites on the internet, the forward proxy acts as a middleman.
*   **Use Cases:**
    *   *Corporate Networks:* Blocking employees from accessing Facebook (Content Filtering).
    *   *Anonymity (VPNs/Tor):* The destination server sees the IP address of the Proxy, not the original user.
    *   *Caching:* If every student in a school tries to download the same 5GB Wikipedia update, the school's forward proxy downloads it once from the internet, caches it, and serves the subsequent requests locally to the students.

### 2. The Reverse Proxy (Protecting the Server)
This is the workhorse of system design. A reverse proxy sits in front of one or more *web/application servers*. To the outside world, the reverse proxy *is* the web server. They have absolutely no idea what lies behind it.
*   **Examples:** NGINX, HAProxy, Envoy, Apache.
*   **Use Cases:**
    *   *Security (WAF/DDoS):* It completely hides the IP addresses of your internal servers from the public internet. It can drop malicious traffic before it ever reaches your application code.
    *   *SSL Termination:* It handles the computationally expensive task of decrypting HTTPS traffic, then forwards raw HTTP traffic to your backend servers.
    *   *Static Content Caching:* It can intercept requests for `/images/logo.png` and serve them directly from RAM, without ever waking up your Node.js or Python backend.
    *   *Load Balancing:* Most modern Reverse Proxies also act as Layer 7 Load Balancers.

---

## 🌍 CDNs (Content Delivery Networks)

A CDN is essentially a globally distributed network of massive, highly optimized Reverse Proxies (called "Edge Servers"). Companies like Cloudflare, Akamai, and AWS CloudFront dominate this space.

When building Netflix or Youtube, trying to stream a 5GB 4K video from a data center in Virginia to a user in Tokyo will result in constant buffering.

**How CDNs solve the speed of light:**
1.  Netflix puts a movie on their core S3 bucket (Origin Server) in Virginia.
2.  A user in Tokyo presses "Play".
3.  The request hits an AWS edge server physically located in Tokyo. The edge server checks its cache. It's a "Cache Miss".
4.  The Tokyo edge server requests the movie from Virginia, caches it locally in Tokyo, and serves it to the user.
5.  *The Magic:* When the second, third, and millionth user in Tokyo presses "Play", the Edge Server serves it instantly. The request never crosses the Pacific Ocean again.

---

## ⚡ CDN Caching Models (Push vs. Pull)

When you update a CSS file, how does the CDN know to update it globally?

### 1. The Pull Model (Cache-Aside)
The CDN edge server pulls new content only when the first user requests it (a Cache Miss). If no one requests it, it is never pulled.
*   *Pros:* Zero maintenance. Easy to set up. Only popular content is cached.
*   *Cons:* The first user experiences High Latency.
*   *Invalidation:* How do we update a file? We use "Cache Busting". Instead of updating `logo.png`, we upload a new file `logo_v2.png` to the origin and change our HTML to point to `v2`. The CDN sees a brand new URL, registers a miss, and pulls the new file.

### 2. The Push Model
You (the engineer) actively push content to the CDN edge servers BEFORE users request it. Whenever you update a file, your deployment pipeline runs a script to actively push the file out to 150 global edge locations.
*   *Pros:* The very first user experiences zero latency (100% Cache Hit rate).
*   *Cons:* Very complex to orchestrate. High bandwidth costs pushing terabytes of data to regions that might never actually request that specific file.


---

## Frequently Asked Tricky Interview Questions
**Q: "A user in Tokyo requests a 10MB Video from your New York Origin Server. The CDN Edge in Tokyo doesn't have it (Cache Miss). The Edge requests it from NY. If 5,000 people in Tokyo ask for it simultaneously, won't the CDN Edge send 5,000 requests to NY, destroying your origin server?"**
*Answer:* No. Modern CDNs (like Cloudflare or Akamai) implement **Request Collapsing (Read-Through Caching)**. The Edge node recognizes that it is currently fetching the asset from Origin for User 1. It holds Users 2-5,000 in a wait state for a few milliseconds, finishes downloading the single payload from New York, and then physically distributes it to all 5,000 users simultaneously.

**Q: "If a Reverse Proxy (like NGINX) decrypts SSL traffic to inspect the HTTP headers, doesn't that make the connection between the Proxy and the Internal Application Server totally insecure (Plaintext HTTP)?"**
*Answer:* Yes, this is called **SSL Termination**. If the Proxy and the App Server are in the same private VPC subnet (like AWS Virtual Private Cloud), it's generally considered safe since the traffic is completely isolated from the internet. However, for ultra-high security systems (Banking/Gov), you must use **SSL Passthrough** (where the proxy routes raw TCP packets without seeing the data) or re-encrypt the traffic internally (**mTLS - Mutual TLS**) so traffic remains heavily encrypted even between your own internal servers.
