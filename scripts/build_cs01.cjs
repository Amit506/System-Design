const fs = require('fs');

const cs01 = {
    "id": "cs01",
    "title": "Case Study: Design a URL Shortener (TinyURL)",
    "parent_id": null,
    "order": 18,
    "tags": ["case-study", "url-shortener", "base62", "hashing"],
    "summary": "A deep dive into designing a scalable URL shortener like TinyURL or bit.ly, focusing on highly available reads, low latency redirects, and distributed unique ID generation.",
    "explanation": {
        "overview": "A URL shortener is a classic system design interview question. It tests your ability to translate simple functional requirements ('given a long URL, return a short one') into a distributed system that handles massive read-heavy traffic, predictable storage growth, and collision-free ID generation. The system involves an API gateway, a distributed key-value store or RDBMS, a caching layer, and an offline ID generation service.",
        "how_it_works_internally": "INTERNAL Mechanics: The system fundamentally acts as a massive hash map. When a user submits a long URL, we assign it a unique auto-incrementing integer ID. We convert this integer to Base62 (A-Z, a-z, 0-9) to create a short 7-character string. For example, ID 125 transforms to 'cb'. The short URL is returned. When a user clicks the short URL, the request hits a Load Balancer, checks an in-memory Cache (Redis/Memcached). If there's a cache miss, it hits the primary Database, reconstructs the long URL, caches it, and returns an HTTP 301 or 302 redirect. To ensure scalability, we pre-generate IDs using a dedicated ZooKeeper-backed Key Generation Service (KGS) so Web Servers never block waiting for an ID.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Requirements & Estimation",
                "detail": "Assume 100M URLs generated per month, 10:1 read-to-write ratio (1B reads/month). At 500 bytes per URL stored for 10 years: 100M * 12 * 10 * 500 = 6TB payload. The scale fits in a standard RDBMS, but NoSQL scales writes easier. 1B reads/mo = ~400 QPS average, ~2K peak QPS. Memory footprint for 20% hot URLs: 200M * 500 bytes = 100GB, easily fitting in a Redis cluster."
            },
            {
                "step": 2,
                "title": "API Design",
                "detail": "POST /api/v1/data/shorten (body: {long_url: string, custom_alias: opt<string>}) -> returns {short_url: string}. GET /api/v1/{short_url} -> throws HTTP 301 (Permanent Redirect - caches long term) or HTTP 302 (Temporary Redirect - allows tracking analytics)."
            },
            {
                "step": 3,
                "title": "Database Schema & Primary Key",
                "detail": "Table `url_mapping`: Hash (Base62 string) [PK], Long_URL [Varchar 2048], User_ID, Creation_Date, Expiration_Date. We use a secondary index on Long_URL to prevent duplicate insertions."
            },
            {
                "step": 4,
                "title": "ID Generation & Base62 Encoding",
                "detail": "Using MD5 hash leads to collisions. Using an auto-incrementing DB ID causes write bottlenecks. Instead, a Key Generation Service (KGS) pre-computes Base62 strings and stores them in a DB. Application servers grab a chunk of 1,000 keys into memory. They assign keys instantly without DB locking."
            }
        ],
        "key_concepts": [
            {
                "term": "Base62 Encoding",
                "definition": "INTERNAL: Converting a base-10 integer to base-62 (26 lowercase, 26 uppercase, 10 digits). A 7-character base62 string yields 62^7 = 3.5 trillion unique keys, enough for decades of usage."
            },
            {
                "term": "HTTP 301 vs 302 Redirect",
                "definition": "301 is Permanent: browser caches the redirect forever, saving server load but destroying analytics tracking. 302 is Temporary: browser hits server every time, higher load, perfect analytics."
            },
            {
                "term": "Key Generation Service (KGS)",
                "definition": "A standalone service that pre-computes unique keys and hands them out to web servers in chunks (e.g., 1,000 at a time). This eliminates database contention and network round-trips for ID creation."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Base62 Encoder",
                "description": "Concrete Python code proving how to implement Base62 encoding from a persistent chunk ID.",
                "code": "def to_base62(num):\n    alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'\n    if num == 0:\n        return alphabet[0]\n    arr = []\n    base = len(alphabet)\n    while num:\n        num, rem = divmod(num, base)\n        arr.append(alphabet[rem])\n    arr.reverse()\n    return ''.join(arr)\n\nprint(to_base62(125)) # Output: '21'"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "A production-grade Java code example demonstrating KGS thread-safety for fetching chunked keys.",
                "code": "public class KeyGenerationService {\n    // Thread-safe chunk cache utilizing concurrent queue\n    private static final ConcurrentLinkedQueue<String> keyCache = new ConcurrentLinkedQueue<>();\n    \n    public static String getNextKey() {\n        String key = keyCache.poll();\n        if (key == null) {\n            // Database exception handling omitted for brevity\n            replenishCacheFromDB();\n        }\n        return key;\n    }\n}"
            },
            {
                "title": "Real-World FAANG Architecture Case Study: Uber/Stripe Shorteners",
                "description": "Companies like Uber use internal URL shorteners for rider SMS updates.",
                "code": "Architecture Flow:\n1. Client -> Route 53 DNS -> AWS API Gateway -> Application Server.\n2. App Server checks local L1 Cache (Guava) -> Redis L2 Cache.\n3. Cache Miss: Query Cassandra by Base62 partition key.\n4. KGS utilizes ZooKeeper to maintain ranges, preventing multiple servers from claiming the same ID chunk."
            },
            {
                "title": "Decision Matrix & Tradeoffs: DB Choices",
                "description": "How to evaluate options during a system design interview.",
                "code": "OPTION A (MySQL) vs OPTION B (Cassandra)\n----------------------------------------\nPros MySQL: ACID compliance, built-in auto-increment.\nCons MySQL: Harder to scale horizontally for massive read throughput.\nPros Cassandra: Easy horizontal scaling, highly available.\nCons Cassandra: Eventual consistency, no auto-increment (requires KGS)."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Catastrophic failures and how state is preserved.",
                "code": "try-catch fallback mechanics:\n1. ExecutionTimeoutException in Redis: Fallback to primary Cassandra DB. Trigger circuit breaker if DB latency spikes over 200ms.\n2. KGS Server Dies: If the KGS node crashes, the ~1000 keys in its memory are lost permanently. This is acceptable since we have 3.5 trillion keys. ZooKeeper assigns a new block to the newly spawned KGS node."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (Memcached LRU)",
            "default": "LRU (Least Recently Used) cache eviction.",
            "effect": "Modify parameter `maxmemory-policy allkeys-lru` in Redis config to ensure old, unclicked links are evicted first.",
            "tradeoff": "LRU is heavily CPU intensive on high churn. Using LFU (Least Frequently Used) might better preserve viral links."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "When moving from monolithic shorteners to stateless Kubernetes pods.",
            "how": "Make web tier entirely stateless. Store user session and click-tracking state asynchronously via Kafka queues. Key chunks are kept in memory (stateful), but since losing a chunk is acceptable, the node itself behaves practically stateless for scaling purposes."
        },
        {
            "technique": "Bloom Filter",
            "when_to_use": "Preventing malicious bot lookups for non-existent URLs.",
            "how": "Before querying the database for a short URL, check an in-memory Bloom Filter. If it returns false, the URL definitely doesn't exist, instantly saving a DB lookup."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "URL Shortener Distributed Architecture Diagram",
        "description": "Complete architecture featuring separated Read/Write paths, KGS, and Caching.",
        "data": {
            "mermaid_source": "graph TD\n  Client[Client Browser / App] --> LB[Load Balancer]\n  \n  subgraph \"Read Path (Fast)\"\n    LB -->|GET /short| WebRead[Read Servers]\n    WebRead --> Cache[(Redis Cache)]\n    WebRead --> DB[(NoSQL / DB)]\n  end\n  \n  subgraph \"Write Path\"\n    LB -->|POST /api/shorten| WebWrite[Write Servers]\n    WebWrite --> DB\n    KGS[Key Generation Service] -->|Assigns Chunks| WebWrite\n    ZK((ZooKeeper)) -->|Manages Ranges| KGS\n  end\n  \n  DB --> Analytics[Kafka Async Logging]"
        }
    },
    "limitations": [
        "Predictability Hack: If an attacker knows your KGS assigns keys sequentially, they can easily scrape all your URLs. TWEEK/FIX: Add a random shuffling step inside the chunk so keys are distributed non-sequentially.",
        "Custom Aliases: A custom alias ('/mybrand') bypasses the KGS and requires a direct database check for uniqueness, creating a potential race condition. TWEEK: Use an atomic `INSERT IF NOT EXISTS` or Redis exact-lock."
    ],
    "technologies_used": [
        {
            "technology": "Apache ZooKeeper",
            "details": "A centralized service for maintaining configuration information and naming. Here, it reliably coordinates which chunk of IDs (e.g., 1M to 2M) belongs to which KGS application server, ensuring absolutely zero collisions in distributed environments."
        },
        {
            "technology": "Redis",
            "details": "An in-memory data structure store used as a database, cache, and message broker. Because URL shortening relies exclusively on random reads for small items (<1KB), Redis provides sub-millisecond lookup times."
        },
        {
            "technology": "Cassandra / DynamoDB",
            "details": "A distributed NoSQL database designed to handle large amounts of data across many commodity servers. Ideal for URL shorteners because the data model is a simple Key-Value mapping, and NoSQL excels at massive horizontal write/read scaling without complex JOIN requirements."
        }
    ],
    "references": [
        {
            "title": "System Design Interview: Design a URL Shortener",
            "url": "https://www.youtube.com/watch?v=JQDHz72OA3c"
        }
    ]
};

fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/cs01_url_shortener.json', JSON.stringify(cs01, null, 4));
console.log('Successfully generated cs01_url_shortener.json');
