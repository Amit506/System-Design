# 🐙 Design a Version Control System (GitHub)

**Core Domains:** Cryptographic Hash Trees, Content Addressable Storage, Graph Traversal.  
**Primary Concepts Demonstrated:** The Merkle Tree (DAG), Diff Algorithms, Distributed File Systems (Git LFS), SSH Authentication.

---

## 1. Scope & Requirements
GitHub is unique because it is effectively a massive graphical database of text differences (diffs). Unlike Google Drive which stores binary images, Git explicitly tracks, merges, and resolves human-readable lines of code across millions of interconnected branches.

*   **Traffic Focus:** Spiky Read/Write. (e.g., heavily used during CI/CD deployments and Monday mornings).
*   **Storage Scale:** Terabytes of source code, heavily deduplicated.
*   **Latency constraint:** Not latency-sensitive for humans (a `git push` taking 2 seconds is fine), but CI/CD automation requires high throughput.

---

## 2. API Design & The "Content Addressable" Concept
Git does not store files by their name (`main.py`). It stores files by their cryptographic content hash (SHA-1). 
If Alice and Bob both have a file with the exact same text "print('hello')", Git only stores that text on disk exactly once, under the hash `4b5fa6...`, regardless of what Alice or Bob named the file.

### Core Architecture Commands (The Git Protocol)
*   **HTTP/SSH Server:** Git requires an SSH daemon or HTTP server to negotiate packfiles (the compressed binary format Git uses over the network).
*   **The Object DB:** The core storage layer mapping 40-character SHA-1 hashes to zlib-compressed text blobs.

---

## 3. High-Level Design (HLD) & Data Structures
Git is mathematically a **Directed Acyclic Graph (DAG)**. Or more specifically, a **Merkle Tree**.

*   **Blob (File Content):** The raw text of a file.
*   **Tree (Directory):** A text file containing a list of pointers (SHA-1 hashes) to Blobs and other Trees.
*   **Commit:** A text file containing a pointer to the Root Tree, a pointer to the Parent Commit, the Author, and a Timestamp.

```mermaid
graph TD
    Commit_V2[Commit: 'Added User Auth'] -->|Parent| Commit_V1[Commit: 'Initial App']
    Commit_V2 -->|Points to Root| Tree_Root_V2(Root Directory)
    
    Tree_Root_V2 -->|Contains| Blob_A_New(auth.py : hash(ac3f...))
    Tree_Root_V2 -->|Contains unchanged| Blob_B(main.py : hash(8f9...))
    
    Commit_V1 -->|Points to Root| Tree_Root_V1(Root Directory)
    Tree_Root_V1 -->|Contains| Blob_B
```
**The Magic:** Because `main.py` did not change in Commit V2, Git does not save it again. Tree V2 just points to the exact same Blob Hash from V1. This makes branches incredibly cheap and fast.

---

## 4. GitHub's Backend Architecture (The Routing Layer)
When you run `git clone https://github.com/torvalds/linux.git`, your computer asks GitHub to dynamically calculate and compress a decade of history into a single payload. Given the Linux kernel is massive, this would melt a single server.

GitHub uses a tier of fast proxies that route your request to a cluster of specialized file servers (historically called *Gitaly* or *DStore*).

```mermaid
graph TD
    Developer((Developer: git push)) -->|SSH / HTTPS| LoadBalancer[Global Load Balancer]
    LoadBalancer --> AuthSvc[Authentication (SSH Keys/Tokens)]
    
    AuthSvc --> GitProxy[Git Protocol Router]
    
    GitProxy -->|Consults Routing DB| MySQL[(MySQL Routing Tables)]
    GitProxy -->|Routes to Shard| FileServer_A[(Storage Node: linux.git)]
    
    FileServer_A -->|Update Meta| MySQL
    FileServer_A -->|Trigger Webhook| WebhookSvc[CI/CD Event Bus]
```

---

## 5. Overcoming Scale Limitations

### A. The "Diff" Calculation Bottleneck
When you open a Pull Request with 50 changed files, GitHub must calculate the exact line-by-line differences mathematically on the fly in the browser.
*   **Limitation:** Running the Myers Diff Algorithm on a 10,000-line file takes immense CPU time. If 1,000 users view PRs simultaneously, the Ruby on Rails frontend servers crash.
*   **Solution:** **Asynchronous Pre-computation & Caching.** The moment the `git push` finishes, the network triggers an async background worker (Redis/Sidekiq). The worker pre-calculates the HTML diff views for the entire Pull Request and saves them to a Memcached tier. When you click the PR, the page loads instantly in $<50\text{ms}$.

### B. Large Binary Files (Git LFS)
A Game Developer commits a $500\text{MB}$ `.psd` Photoshop file or a `.mp4`. Because binaries cannot be efficiently "diffed" (a 1-bit change creates an entirely new $500\text{MB}$ file), the Git repository inflates to 100GB in a week, breaking clone times for everyone.
*   **Limitation:** Core Git is designed exclusively for text files.
*   **Solution: Git Large File Storage (Git LFS).** Instead of putting the `$500\text{MB}` file inside Git's core Object DB, Git replaces the large file with a tiny `100 byte` text pointer holding a URL. The physical $500\text{MB}$ video is uploaded directly to a completely separate Object Store pipeline (Amazon S3). When you `git pull`, the Git client reads the text pointer and seamlessly downloads the massive file straight from S3/CDN.

### C. The Repack Spikes
Over time, committing 10,000 small files creates 10,000 tiny physical files on the hard drive, destroying disk I/O performance.
*   **Mitigation:** `git gc` (Garbage Collection). GitHub servers periodically run background jobs to concatenate all these tiny loose objects into one massive compressed `.pack` file with binary delta-compression, slashing disk usage locally. This heavily spikes CPU.
EOF
