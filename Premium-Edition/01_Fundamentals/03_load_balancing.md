# Part 3: Load Balancing Algorithms and Layers

A Load Balancer (LB) is a crucial component in any distributed system. It acts as a traffic cop, sitting in front of your application servers and routing client requests across multiple servers in a cluster. This ensures no single server bears too much demand, improving responsiveness and maximizing availability.

---

## 🚦 Why Do We Need Load Balancers?
1.  **Preventing SPOF (Single Point of Failure):** If you only have one server and it crashes, your entire site is down.
2.  **Horizontal Scaling:** It allows you to add (or remove) servers dynamically based on traffic.
3.  **SSL Termination:** Decrypting SSL/TLS is CPU-intensive. An LB can handle decryption, passing plain HTTP to your internal servers, saving backend CPU cycles.
4.  **Health Checking:** An LB constantly pings backend servers. If a server stops responding, the LB removes it from the routing pool.

---

## 🥞 L4 vs. L7 Load Balancing

Understanding the OSI model is critical for system design. LBs operate at different layers:

### Layer 4 (Transport Layer) Load Balancing
*   **How it works:** It routes traffic based on network data (IP address and TCP port). It doesn't look at the content of the message.
*   **Pros:** Extremely fast. Requires very little CPU because it’s just shuffling packets.
*   **Cons:** "Dumb" routing. It can't route traffic based on what the user is asking for.
*   **Use case:** Massive-scale systems where raw throughput is the priority, or balancing non-HTTP protocols (e.g., database traffic, UDP). AWS Network Load Balancer (NLB) uses L4.

### Layer 7 (Application Layer) Load Balancing
*   **How it works:** It inspects the actual content of the HTTP request (headers, cookies, URL path, payload).
*   **Pros:** "Smart" routing. If a user requests `/images/*`, the LB routes them to servers optimized for serving static media. If they request `/api/*`, it routes to the API servers.
*   **Cons:** Slower than L4. Requires significantly more CPU because it must terminate the TCP connection, read the headers, and then establish a new connection to the backend.
*   **Use case:** Microservices architectures. AWS Application Load Balancer (ALB), Nginx, HAProxy.

---

## 🧮 Common Load Balancing Algorithms

How does the LB actually decide which server gets the next request?

1.  **Round Robin:**
    *   *Mechanism:* Cycles through a list of servers sequentially (A -> B -> C -> A).
    *   *When to use:* Your servers are identical in hardware capacity, and requests are generally uniform in CPU cost.
2.  **Weighted Round Robin:**
    *   *Mechanism:* Similar to above, but you assign "weights" based on server power. (Server A is 2x more powerful than B, so it gets 2 requests for every 1 that B gets).
3.  **Least Connections:**
    *   *Mechanism:* Sends the request to the server with the fewest active connections.
    *   *When to use:* Your system has long-lived connections (e.g., WebSockets, streaming) or variable-length requests.
4.  **IP Hash / Consistent Hashing:**
    *   *Mechanism:* Hashes the client's IP address (or session ID) to determine the server. This guarantees that Client X will *always* connect to Server Y.
    *   *When to use:* You have **stateful** applications where user session data is stored in the server's memory (e.g., an online game state or a shopping cart cache).

---

## ⚔️ Hardware vs. Software Load Balancers

*   **Hardware LBs (F5, Citrix):** Physical appliances you install in a rack. They are incredibly expensive but can handle millions of requests per second with near-zero latency because routing is physically baked into the silicon (ASICs).
*   **Software LBs (Nginx, HAProxy, Envoy):** Installed on standard Linux servers. Much cheaper, highly configurable, and easily dockerized/containerized. This is the industry standard for modern cloud architectures.

---

## 💣 Load Balancing Pitfalls (The Single Point of Failure)

*Interviewer: "You added a Load Balancer. What happens if the Load Balancer itself crashes?"*

If you have one LB, you haven't solved the SPOF problem; you just moved it.
*   **Solution: Active-Passive (Master-Slave) setup.**
    *   You run *two* Load Balancers. One is "Active" and handles all traffic. The other is "Passive" and simply monitors the Active LB via a heartbeat.
    *   If the Active LB stops sending heartbeats, the Passive LB immediately takes over the IP address (using a protocol like VRRP or Keepalived) and begins routing traffic. This is sometimes called "Floating IPs."

### Global Load Balancing (DNS & Anycast)
How do you route a user in Tokyo to an AWS datacenter in Japan, and a user in New York to a datacenter in Virginia?
*   **DNS Resolution (Route 53):** You configure your DNS to return different IP addresses based on the geographic location of the DNS query.
*   **Anycast IP:** A network addressing routing methodology where a single IP address is shared by servers in multiple locations. The networking routers inherently send the packet to the strictly topological "closest" datacenter. (Cloudflare relies heavily on this).
