const fs = require('fs');

const cs14_15 = [
{
    "id": "cs14",
    "title": "Case Study: Ad Click Aggregator",
    "parent_id": null,
    "order": 31,
    "tags": ["case-study", "system-design", "kafka", "flink", "streaming", "analytics"],
    "summary": "Design a globally distributed advertising click aggregator tracking billions of events per day, guaranteeing 'exactly-once' processing semantics for accurate financial billing.",
    "explanation": {
        "overview": "Advertising systems (like Google Ads or Facebook Ads) generate revenue based on clicks. If a system double-counts a click, the advertiser is wrongfully billed. If it misses a click, the platform loses money. The system must ingest 100,000 clicks per second, deduplicate spam/retries, aggregate the totals by campaign in real-time within 1-minute tumbling windows, and flush to a database without losing a single cent during a sudden datacenter crash.",
        "how_it_works_internally": "INTERNAL Mechanics: The system relies on the 'Lambda Architecture' or pure 'Streaming Architecture' utilizing Apache Kafka and Apache Flink. When a user clicks an ad, a lightweight stateless API Gateway drops the `{click_id, ad_id, timestamp}` into a Kafka Topic. Kafka acts as an indestructible append-only buffer. A cluster of Flink Stream Processors consumes this topic. Flink uses a massive in-memory State Store to track `click_ids` to deduplicate retries. It groups the clicks into 1-minute 'Tumbling Windows' grouped by `ad_id`. After the minute passes, Flink writes the aggregated sum (`ad_id: 50 -> 504 clicks`) to a fast NoSQL database like Cassandra or ClickHouse for the advertiser dashboard to query.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Ingestion & Buffering",
                "detail": "Client clicks Ad. API Gateway immediately pushes the event to Kafka and returns HTTP 200 OK to the client. The synchronous work is over."
            },
            {
                "step": 2,
                "title": "Deduplication (Exactly-Once)",
                "detail": "Flink consumes the Kafka message. It checks a Bloom Filter or memory state: 'Have I seen this `click_id` in the last 10 minutes?'. If yes, drop it to prevent double-billing."
            },
            {
                "step": 3,
                "title": "Windowed Aggregation",
                "detail": "Flink holds the allowed clicks in memory, bucketed by minute (09:00 to 09:01). It simply increments the counter for the respective `campaign_id`."
            },
            {
                "step": 4,
                "title": "Database Flush",
                "detail": "When the 09:01 watermark passes, Flink executes an Upsert (Update or Insert) into Cassandra `UPDATE campaign_stats SET clicks = clicks + 50 WHERE campaign_id = 123`."
            }
        ],
        "key_concepts": [
            {
                "term": "Exactly-Once Semantics",
                "definition": "INTERNAL: The holy grail of distributed stream processing. Even if a Flink worker crashes mid-calculation and restarts, the system mathematically guarantees that every original Kafka message affects the final database state exactly one time, never zero, never twice. Managed via Two-Phase Commits distributed across Kafka and the DB."
            },
            {
                "term": "Tumbling vs Sliding Windows",
                "definition": "Tumbling Windows: Fixed, non-overlapping chunks of time (e.g., 1:00 to 1:05, 1:05 to 1:10). Sliding Windows: Overlapping chunks (e.g., last 5 minutes, updated every 1 minute). Ad aggregators primarily use Tumbling windows for clean billing increments."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Kafka Producer Ingestion",
                "description": "Concrete Python snippet demonstrating high-throughput async Kafka production.",
                "code": "from kafka import KafkaProducer\nimport json\n\n# Configure producer with strong acks for financial data\nproducer = KafkaProducer(\n    bootstrap_servers=['kafka1:9092'],\n    value_serializer=lambda v: json.dumps(v).encode('utf-8'),\n    acks='all',  # Wait for leader & replicas to confirm receipt\n    retries=5\n)\n\ndef track_click(click_id, ad_id, user_id):\n    event = {'click_id': click_id, 'ad_id': ad_id, 'user_id': user_id}\n    # Asynchronous send to avoid blocking the API gateway\n    future = producer.send('ad-clicks-topic', key=str(ad_id).encode(), value=event)\n    # Callbacks handle failures\n    future.add_errback(alert_on_failure)"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Production Java Flink Windowing snippet.",
                "code": "public class AdClickAggregator {\n    public static void main(String[] args) {\n        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();\n        \n        DataStream<AdClickEvent> stream = env.addSource(new FlinkKafkaConsumer<>(\"clicks\", ...));\n        \n        stream\n            .keyBy(AdClickEvent::getCampaignId)\n            // 1-minute tumbling window based on event timestamps\n            .window(TumblingEventTimeWindows.of(Time.minutes(1)))\n            .aggregate(new ClickCountAggregator())\n            .addSink(new CassandraSink());\n            \n        env.execute(\"Ad Click Aggregation Job\");\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Storage Databases",
                "description": "Evaluating where to store the final aggregated metrics.",
                "code": "OPTION Cassandra vs OPTION ClickHouse/Druid\n-------------------------------------------\nPros Cassandra: Perfect for extremely high write-throughput (Updates/Upserts). Linearly scalable.\nCons Cassandra: Fails at complex analytical GROUP BY queries (e.g., 'Show me clicks by age demographic across all campaigns').\nPros ClickHouse/Druid: Columnar OLAP databases designed specifically for sub-second analytical dashboard queries.\nCons ClickHouse/Druid: More complex to administrate, less forgiving with continuous microscopic row updates."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Handling delayed messages and bot storms.",
                "code": "try-catch fallback mechanics:\n1. LateDataException: A user clicks an ad on a subway train, loses perfectly internet, and the phone sends the click 3 hours later. The 09:00 Flink window has already closed and flushed to the database. Mitigated by configuring 'Allowed Lateness' in Flink. The window is kept alive in memory for a grace period, and emits late-update corrections to Cassandra if a delayed packet arrives.\n2. Malicious Bot Net: 10 million clicks originate from an AWS server farm in 1 second testing vulnerabilities. Flink detects the IP rate-limit violation mid-stream, routes the click IDs to a Dead Letter Queue (DLQ) for auditing, and strips them from the aggregation pipeline before they hit the billing database."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (Kafka Partitions)",
            "default": "num.partitions = 1",
            "effect": "Modify parameter `num.partitions = 200` on the Ad Clicks topic.",
            "tradeoff": "A single Kafka partition is bound to a single physical disk and a single Flink worker thread, capping throughput. Increasing partitions to 200 allows 200 Flink workers to process the stream perfectly in parallel, maximizing CPU utilization across the cluster."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Recovering Flink state after a hardware explosion.",
            "how": "Use Distributed Checkpointing. Every 10 seconds, Flink pauses the stream for an instant and saves the exact memory state of its internal variables (including current window counts and processed Kafka Offsets) directly to cold Amazon S3. If the server explodes, a new server boots, downloads the S3 checkpoint, winds Kafka exactly back to the saved offset, and resumes identically."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Ad Click Streaming Workflow",
        "description": "Decoupling API Gateways from stateful stream processors.",
        "data": {
            "mermaid_source": "graph TD\n  Client --> |Click Ad| API[API Gateway]\n  API --> |Append Event| Kafka[(Kafka 'clicks' Topic)]\n  Kafka --> Flink1[Flink Stream Processor]\n  Kafka --> Flink2[Flink Stream Processor]\n  \n  Flink1 <--> State[(RocksDB Local State)]\n  Flink2 <--> State\n  \n  Flink1 --> |Window 1-Min Flush| DB[(Cassandra/ClickHouse)]\n  Flink2 --> |Window 1-Min Flush| DB\n  \n  DB --> Dashboard[Advertiser Analytics UI]"
        }
    },
    "limitations": [
        "Consumer Group Lag: If traffic spikes 10x, and Flink processors can't keep up, Kafka buffers the delay. The Dashboard stops showing real-time data and shows 5-minute delayed data. TWEAK: Set up auto-scaling on the Flink consumer group based on the 'Kafka Consumer Lag' JMX metric.",
        "Deduplication Memory limits: Keeping 1 billion distinct Click IDs in RAM to check for duplicates is impossible. TWEAK: Flink uses RocksDB (a local on-disk embedded database) to spill the deduplication set seamlessly to NVMe SSDs, trading slight latency for infinite state size."
    ],
    "technologies_used": [
        {
            "technology": "Apache Flink",
            "details": "The industry standard for stateful stream processing. Unlike Apache Spark (which uses micro-batches), Flink processes data event-by-event natively, providing true low-latency streaming and profound fault-tolerance mechanisms."
        },
        {
            "technology": "ClickHouse",
            "details": "An immensely fast open-source column-oriented database management system. It allows generating analytical data reports in real-time, often used as the final sink for the ad dashboards."
        }
    ]
},
{
    "id": "cs15",
    "title": "Case Study: Robinhood / Stock Trading Platform",
    "parent_id": null,
    "order": 32,
    "tags": ["case-study", "robinhood", "brokerage", "sharding", "microservices"],
    "summary": "Design a high-frequency trading brokerage platform like Robinhood that handles massive retail volume spikes, stringent ACID financial transactions, and real-time market data matching.",
    "explanation": {
        "overview": "A financial brokerage is the ultimate test of ACID compliance and system elasticity. Unlike a social network where missing a post is acceptable, dropping a $50,000 Apple stock trade due to a server crash is a regulatory catastrophe. Because markets open at 9:30 AM EST, the system experiences vertical traffic spikes instantly. To survive this, modern brokerages transition from monoliths to massively sharded Microservices architectures running natively on Kubernetes.",
        "how_it_works_internally": "INTERNAL Mechanics: Robinhood handles insane load spikes by vertically and horizontally Sharding its database. Rather than one massive PostgreSQL database holding 10 million users, the userbase is sharded across 100 independent PostgreSQL databases (100k users per shard). When User 7749 tries to buy Tesla stock, the 'Routing Layer' directs the API call exclusively to Shard #7. An 'Aggregation Layer' is used when internal services need global data across all shards. For real-time stock ticking, the system consumes the Firehose from the NASDAQ/NYSE exchanges via high-throughput UDP/TCP streams, dumps it into Kafka, and fans it out to millions of mobile WebSocket clients via an in-memory Redis replication layer.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Market Data Streaming",
                "detail": "Market Maker exchange feeds stream raw pricing. The Pricing Microservice converts this proprietary format into JSON, drops it into Kafka, which pushes it to local Websocket servers connected to user apps."
            },
            {
                "step": 2,
                "title": "Order Placement & Routing",
                "detail": "User hits 'Buy 100 TSLA'. The API Gateway asks the Routing Service 'Where does User XYZ live?'. The router proxies the trade request to Application Cluster #7 connected to PostgreSQL Shard #7."
            },
            {
                "step": 3,
                "title": "ACID Transaction Validation",
                "detail": "The Trade Service on Cluster #7 opens a strongly consistent Postgres transaction. It verifies `buying_power >= cost`. If valid, it locks the funds, records the Pending Trade, and commits the row."
            },
            {
                "step": 4,
                "title": "Execution and Clearing",
                "detail": "The Pending Trade is placed on an outbound Kafka Execution Queue. A FIX (Financial Information eXchange) Protocol Gateway consumes the Queue and submits it to Citadel/Virtu (Market Makers). When the fill confirms, the state transitions to Executed."
            }
        ],
        "key_concepts": [
            {
                "term": "Database / Application Sharding",
                "definition": "INTERNAL: Dividing your users up into isolated buckets. If Shard 4 goes completely offline due to hardware failure, 95% of your users (on other shards) can still trade perfectly fine. It isolates blast radiuses."
            },
            {
                "term": "FIX Protocol",
                "definition": "The legacy, but ubiquitous, electronic communications protocol initiated in 1992 for real-time exchange of information related to the securities transactions and markets. Your internal APIs speak JSON/REST, but to talk to the New York Stock Exchange, you must translate to FIX."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Shard Routing",
                "description": "Concrete Python logic proving how a stateless gateway dynamically routes traffic to the correct isolated database shard.",
                "code": "import hashlib\n\nNUM_SHARDS = 100\n\ndef get_shard_connection_string(user_id):\n    # Consistent hashing to determine shard bucket\n    shard_id = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % NUM_SHARDS\n    return f\"postgres://user:pass@db-shard-{shard_id}.internal:5432/brokerage\"\n\ndef execute_trade(user_id, symbol, quantity, price):\n    # Connect strictly to the user's isolated database\n    db = db_connect(get_shard_connection_string(user_id))\n    \n    with db.transaction():\n        user = db.query(\"SELECT buying_power FROM accounts WHERE id = ? FOR UPDATE\", user_id)\n        cost = quantity * price\n        if user.buying_power >= cost:\n            db.execute(\"UPDATE accounts SET buying_power = buying_power - ?\", cost)\n            db.execute(\"INSERT INTO orders (user_id, symbol) VALUES (?, ?)\", user_id, symbol)\n            return True\n        return False"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Java High-Frequency WebSockets for blazing fast price ticker fan-out.",
                "code": "public class MarketDataFanout {\n    // In-memory Concurrent cache of latest prices\n    private final Map<String, Double> latestPrices = new ConcurrentHashMap<>();\n    // Map of Ticker Symbol to List of connected Client WebSockets\n    private final Map<String, Set<Session>> subscribers = new ConcurrentHashMap<>();\n    \n    @KafkaListener(topics = \"NYSE-Prices\")\n    public void onNewPrice(PriceTick tick) {\n        // O(1) Memory Update\n        latestPrices.put(tick.getSymbol(), tick.getPrice());\n        \n        // Async Fan-out to 100,000 users watching TSLA\n        Set<Session> watchers = subscribers.get(tick.getSymbol());\n        if(watchers != null) {\n            watchers.parallelStream().forEach(session -> {\n                session.getAsyncRemote().sendObject(tick);\n            });\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Scale Out Strategies",
                "description": "Evaluating Monolithic DBs vs Sharding.",
                "code": "OPTION Vertical Scaling (Big Iron Server) vs OPTION Horizontal Sharding\n-----------------------------------------------------------------------\nPros Vertical Scaling: No complex routing layer. Foreign keys and JOINs work perfectly across the entire dataset. Transactional integrity is trivial.\nCons Vertical Scaling: You physically cannot buy a server massive enough to process 1 million trades a second. The database CPU hits 100% and crashes.\nPros Sharding: Literally infinite scale. Add 10 more shards, get 10% more capacity. Extremely isolated failures.\nCons Sharding: 'Aggregation' becomes a nightmare. An internal admin query like `SELECT SUM(deposits) FROM all_users` requires hitting 100 different databases and merging the results in memory."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Outbound execution failures.",
                "code": "try-catch fallback mechanics:\n1. ExecutionGatewayTimeout: The user's trade commits to Postgres, but the FIX Gateway to the Market Maker times out. The system MUST NOT refund the user automatically. The trade state enters 'Indeterminate'. A manual reconciliation background job queries the external Market Maker via API 1 minute later to confirm if the trade filled or was rejected, and mathematically heals the user's Postgres ledger respectively.\n2. Container OOM (Out of Memory): During the GameStop (GME) trading frenzy, the number of incoming WebSockets maxed out the RAM of the Kubernetes Pods. The Pods crash. Kubernetes instantly boots 50 new Pods, and the Route53 DNS load balancer automatically redirects reconnecting mobile clients to the new, healthy Pods."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (Postgres Row Locks)",
            "default": "Non-blocking MVCC read.",
            "effect": "Modify parameter by suffixing specific trading queries with `FOR UPDATE`.",
            "tradeoff": "Reading a user's cash balance normally allows concurrent access. When validating a trade, using `SELECT ... FOR UPDATE` locks that specific database row preventing any other concurrent trade thread from bypassing insufficient funds checks. It sacrifices speed for perfect ACID isolation."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Handling massive concurrent reads of immutable market data.",
            "how": "Use Pub/Sub Memory Routing. Do not let 10 million mobile phones open an HTTP connection querying a database for the current price of Apple every second. The database will melt. Connect all 10 million phones to stateless WebSocket API Gateways. The Gateways subscribe to a Redis Pub/Sub channel `price_updates:AAPL`. The database is never queried. The price pushes from the Exchange, to Redis, to the Gateway, to the RAM of the mobile app in 10 milliseconds."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "High-Frequency Sharded Trading Architecture",
        "description": "Shows the Routing Layer pointing to isolated App/DB shards.",
        "data": {
            "mermaid_source": "graph TD\n  Client[Mobile Client] --> API[API Gateway / Router]\n  \n  API --> |User 112| Shard1[App Cluster 1]\n  API --> |User 559| Shard2[App Cluster 2]\n  \n  Shard1 --> DB1[(Postgres Shard #1)]\n  Shard2 --> DB2[(Postgres Shard #2)]\n  \n  Shard1 --> |Place Trade| Kafka[(Kafka Execution Queue)]\n  Shard2 --> |Place Trade| Kafka\n  \n  Kafka --> FIX[FIX Protocol Gateway]\n  FIX <--> |TCP| Market[Citadel / Exchanges]"
        }
    },
    "limitations": [
        "Cross-Shard Transactions: If User 112 (Shard 1) wants to transfer money P2P instantly to User 559 (Shard 2), a standard simple SQL transaction cannot span two physical databases. TWEAK: Implement distributed transaction patterns like Two-Phase Commit (2PC) or the Saga Pattern, emitting events and compensating actions if one side fails.",
        "Market Open Spikes: At 9:30 AM exactly, traffic spikes 100x over baseline. Kubernetes Horizontal Pod Autoscalers (HPA) take ~3 minutes to provision new servers, meaning the system crashes before the hardware arrives. TWEAK: Predictive Scheduled Scaling. Robinhood forcefully provisions 500 blank servers at 9:00 AM, holding them idle, to absorb the 9:30 AM shockwave natively."
    ],
    "technologies_used": [
        {
            "technology": "PostgreSQL (Sharded)",
            "details": "The ultimate gold standard for ACID relational data. By placing a subset of users in their own isolated PostgreSQL clusters, Robinhood circumvents the natural vertical scaling limits of SQL while retaining all safety guarantees."
        },
        {
            "technology": "Kafka & Zookeeper",
            "details": "Used extensively by Robinhood for decoupled asynchronous communications. When a trade executes, 50 different microservices (Billing, Notifications, Risk, Fraud, Analytics) need to know. The Trade Service simply drops exactly 1 event into Kafka, and all 50 services read it simultaneously."
        }
    ]
}
];

cs14_15.forEach(cs => {
    fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/' + cs.id + '_' + cs.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 15) + '.json', JSON.stringify(cs, null, 4));
});
console.log('Successfully generated cs14 and cs15 json files.');
