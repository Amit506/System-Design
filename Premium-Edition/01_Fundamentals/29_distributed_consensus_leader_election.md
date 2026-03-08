# 🗳️ Distributed Consensus & Leader Election

**Core Focus:** Paxos, Raft, ZooKeeper (ZAB), Split-Brain, Fencing Tokens.

---

## 1. The Core Problem: Who makes the rules?
In a massive distributed cluster of 100 database nodes, if 5 users try to book the exact same airplane seat at the exact same millisecond, the cluster must mathematically agree on *which* user clicked first. If they don't agree, double-booking occurs. 

To solve this, clusters elect a **Leader**. All writes (mutations) must go through the Leader. The Leader dictates the chronological order of operations and dictates changes to the Followers. But how do 100 blind machines agree on who the leader is?

## 2. Distributed Consensus Algorithms
Consensus is the process of agreeing on a single data value across distributed processes, even if some of those processes fail or network links drop.

### A. Paxos (The Academic Standard)
Developed by Leslie Lamport, Paxos is the foundational, mathematically proven consensus protocol. It is notoriously difficult to understand and implement in code, often taking engineers years to get right (e.g., Google Spanner uses Paxos).

### B. Raft (The Industry Standard)
Created specifically to be "understandable", Raft is used by almost every modern distributed system (etcd used by Kubernetes, Consul, CockroachDB).
*   **Leader Election:** Nodes start as *Followers*. If a follower hears nothing from a leader for a randomized timeout ($150$-$300\text{ms}$), it becomes a *Candidate* and requests votes. If it gets a majority (Quorum), it becomes the *Leader*.
*   **Log Replication:** When a client sends a Write to the Leader, the Leader appends it to its log. It then sends the log to all Followers. Only when a *majority* of followers acknowledge they wrote the log does the Leader *Commit* the write and return `Success` to the client.

## 3. Quorums: The Magic Math of Consensus
A cluster cannot function without a strict majority. 
*   In a 3-node cluster, 2 nodes is a quorum. It can survive 1 failure.
*   In a 5-node cluster, 3 nodes is a quorum. It can survive 2 failures.
*(Always use an **odd** number of nodes to prevent 50/50 election ties).*

## 4. The Split-Brain Problem & Fencing Tokens
If a network cable is cut, halving a datacenter, Node A cannot talk to Node B. Both might assume the other side is dead, and both might declare themselves the Leader. Now you have two Leaders accepting writes independently, corrupting your data entirely.
**Solution: Fencing Tokens.**
When a node becomes Leader, it gets a monotonically increasing token (e.g., `Leader_Term_5`). 
If the network splits, the old Leader (Term 5) is isolated. The healthy 3 nodes elect a new Leader (`Term_6`). If the old zombie Leader wakes up and tries to write data to the Storage Layer saying "I am Term 5", the Storage Layer rejects the write because it has already seen writes from `Term_6`.

---

## Frequently Asked Tricky Interview Questions
**Q: "If a Raft cluster has 4 nodes, what happens if exactly 2 nodes die in a fire?"**
*Answer:* The cluster completely halts and refuses all Write traffic (and often Read traffic, depending on configuration). A 4-node cluster requires $3$ votes to achieve a majority ($N/2 + 1$). Since only 2 nodes are alive, it is mathematically impossible to achieve a quorum. This is why you **never** deploy consensus clusters in even numbers. A 3-node cluster survives 1 death. A 4-node cluster *also* only safely survives 1 death, meaning the 4th node adds zero extra fault tolerance while adding network overhead.

**Q: "Why does Kubernetes use `etcd` (Raft) instead of just storing cluster state in a standard MySQL database?"**
*Answer:* If Kubernetes stored its state in MySQL, the MySQL server would be a catastrophic Single Point of Failure (SPOF). But if you put MySQL in a Master-Slave setup, you need an external tool to decide when to promote the Slave if the Master dies. `etcd` uses Raft to natively, internally, and mathematically guarantee that the cluster survives failures seamlessly and self-elects new leaders in $<500\text{ms}$, ensuring the container orchestration brain is functionally indestructible.
