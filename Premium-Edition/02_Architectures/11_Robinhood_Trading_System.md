# 📈 Design a Trading System (Robinhood / High-Frequency Trading)

**Core Domains:** Extremely Low Latency, State Machines, Market Order Matching.  
**Primary Concepts Demonstrated:** Order Matching Engines, UDP/Multicast Networking, FPGA Hardware Accel, Audit Trails.

---

## 1. Scope & Requirements
A stock exchange or trading system operates under entirely different constraints than typical web applications. A 100-millisecond delay on Twitter is invisible. A 100-millisecond delay in an Order Matching Engine could cost a hedge fund millions of dollars due to arbitrage or price slippage.

*   **Traffic Focus:** Extreme Low Latency, High Throughput Writes.
*   **Throughput:** Millions of orders per second at market open (9:30 AM EST).
*   **Latency constraint:** $<10\text{ms}$ for retail (Robinhood), $<10\text{μs}$ (microseconds) for High-Frequency Trading (HFT).

---

## 2. API Design & The Order Book
The core of any trading system is the **Order Book**. It is a real-time list of all people wanting to buy (Bids) and all people wanting to sell (Asks) at various price points.

### Order Types
1.  **Market Order:** "Buy 100 shares of Apple (AAPL) right now at whatever the lowest Ask price is." (Executes instantly, price is unpredictable).
2.  **Limit Order:** "Buy 100 shares of AAPL, but only if the price drops to $\$150.00$ or lower." (Sits on the Order Book indefinitely).

If Alice places a Market Order to buy, the system scans the "Asks" side of the book, matches her with the lowest seller (Bob), executes the trade, and removes Bob's shares from the book.

---

## 3. High-Level Design (HLD): The Matching Engine
Relational databases (SQL) are far too slow for an Order Matching Engine. Disk I/O (even NVMe SSDs) takes milliseconds. The Order Engine must live entirely in **RAM**.

```mermaid
graph TD
    Trader((Retail App)) -->|TLS/TCP WebSocket| API_Gateway[Broker API Gateway]
    API_Gateway -->|Submit Order| RiskCheck[Pre-Trade Risk Validator]
    
    RiskCheck -->|Validates Funds| OrderQueue[Sequencer+Memory Queue]
    
    OrderQueue -->|Deterministic Order| MatchingEngine[(In-Memory Matching Engine)]
    
    MatchingEngine -->|Trade Executed| PostTrade[Post-Trade Clearing & Settlement DB]
    MatchingEngine -->|UDP Multicast| MarketData[Market Data Feed (Ticker)]
    
    MarketData -->|Distributes Prices| API_Gateway
```

---

## 4. Addressing Severe System Bottlenecks

### A. The Matching Engine Algorithm
The Matching Engine structure is rarely an array or linked list. 
*   **Data Structure Limit:** Scanning a random array of 1 Million Limit Orders to find the cheapest Ask price takes $O(N)$ time. This is too slow.
*   **Solution: The Price-Time Priority Queue (Red-Black Trees).** The engine ranks orders first by Price (highest Bid wins), then by Time (first to submit wins). Using balanced binary trees or massive fixed-length arrays allows $O(\log N)$ or even $O(1)$ insertions and immediate $O(1)$ highest-price retrieval. 

### B. High-Frequency Trading (HFT) Limitations
When you need microsecond precision, the Linux Kernel is your enemy. 
*   **Hardware Bottleneck:** When a normal Linux server receives a packet from the network card, an interrupt is thrown, the CPU context-switches space, copies the packet from Kernel Space to User Space, and passes it to the Java/Python app. This process takes 50+ microseconds.
*   **Mitigation:** 
    1.  **Kernel Bypass (e.g., Solarflare / DPDK):** The application reads the packet directly off the network card hardware, bypassing the OS entirely.
    2.  **FPGA (Field-Programmable Gate Array):** Instead of running software code in a CPU, HFT firms burn the matching algorithm directly into physical silicon pathways. Code executes at the speed of light with virtually zero variance.

### C. Disaster Recovery for In-Memory Systems
If the Matching Engine holds the entirety of the stock market in RAM, what happens if the power supply physically explodes?
*   **Limitation:** You lose the entire state of the active stock market. You cannot wait to run a disk flush every 5 minutes.
*   **Solution:** **Event Sourcing & Replicated State Machines.**
    *   Before the order touches the RAM Engine, the `Sequencer` persists the raw command (`Buy 100 AAPL`) to a redundant append-only disk log (via **Kafka or specialized low-latency rings** like Aeron).
    *   If the primary RAM Engine dies, the backup RAM engine immediately replays the log from sequence 0. Because the state machine is deterministic, restoring state only takes milliseconds of replay.

---

## 5. Low-Level Design (LLD): UDP Market Data Feeds
When Apple stock drops from $\$150$ to $\$149$, you must alert 500,000 algorithmic trading bots and 5 Million retail users globally simultaneously.
*   **Limitation:** Sending 5 Million individual TCP/WebSocket streams from exactly one Matching Engine output will crash the server CPU and flood the outbound network pipe.
*   **Solution:** **UDP Multicast.** The Matching Engine fires *exactly one* UDP packet containing the price update into the local network switch. The network switch hardware replicates the packet across all downstream subnetworks.
    *   UDP Multicast is incredibly fast, but "fire and forget" (unreliable). If a client drops a packet, it doesn't request a re-transmit; it ignores the missed tick and relies on the Sequence ID to know it missed a split-second quote.


---

## 6. Frequently Asked Hard Interview Questions
**Q: How do you handle Stock Splits? If someone placed a Limit Order to buy AAPL at $100 yesterday, and today AAPL executes a 4-to-1 split, their order is suddenly mathematically invalid.**
*Answer:* Stock Splits are heavy corporate actions that typically occur when the market is physically closed (Overnight/Weekends). The Exchange halts all incoming endpoints. A massive Batch Job aggressively sweeps the entire in-memory Order Book, multiplying the quantity of all resting orders by 4, and dividing the limit price constraint by 4. Only after the batch job guarantees $100\%$ completion does the system open for Pre-Market trading.

**Q: Order Cancellations vs Execution race condition. A user clicks "Cancel Order", but the execution engine matched them a microsecond prior. What is the truth?**
*Answer:* The Matching Engine Sequencer log is the absolute definitive source of truth based on the exact monotonic arrival time. If the `Execution_Match` packet entered the Sequencer before the `Cancel_Request` packet, the matching engine processes the trade, and then processes the cancellation (resulting in a rejection: "Order already executed"). The UI must gracefully handle this by notifying the user that the cancellation was too late due to market volatility.
