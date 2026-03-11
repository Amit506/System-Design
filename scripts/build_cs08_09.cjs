const fs = require('fs');

const cs08_09 = [
{
    "id": "cs08",
    "title": "Case Study: Stripe / API Rate Limiter",
    "parent_id": null,
    "order": 25,
    "tags": ["case-study", "rate-limiting", "stripe", "redis", "token-bucket"],
    "summary": "Design a highly available API Rate Limiter and Load Shedder, mirroring Stripe's 4-tier architecture to protect against DDoS attacks while ensuring fair multi-tenant SaaS usage.",
    "explanation": {
        "overview": "An enterprise API Gateway (like Stripe's payment API) cannot afford to crash under thundering herds. Rate Limiting is the first line of defense. The challenge is implementing a global rate limit in a distributed environment (where 100 API Edge nodes process traffic simultaneously) without the Rate Limiter itself becoming a latency bottleneck.",
        "how_it_works_internally": "INTERNAL Mechanics: Stripe does not use a simple single-tier limit. They use a 4-Tier defense: 1) Request Rate Limiter (Token Bucket per user via Redis), 2) Concurrent Request Limiter (limits active threads per tenant), 3) Fleet Usage Load Shedder (reserves 20% of global cluster CPU strictly for high-priority payments, dropping low-priority webhooks if needed), 4) Worker Shedder (drops requests at the container level if local queues back up). The core mechanism is the Token Bucket algorithm, enforced via atomic Lua scripts running inside an in-memory Redis cluster. The API Gateway calls Redis before forwarding the request.",
        "step_by_step": [
            {
                "step": 1,
                "title": "API Gateway Interception",
                "detail": "Client hits `POST /v1/charges`. The API Gateway pauses and extracts the user's API Key."
            },
            {
                "step": 2,
                "title": "Redis Lua Script Execution",
                "detail": "The Gateway fires an atomic Lua script to Redis. The script calculates the time elapsed since the last request, adds appropriate tokens to the user's bucket, and checks if the bucket > 0. If yes, it decrements 1 token and returns True."
            },
            {
                "step": 3,
                "title": "Header Injection",
                "detail": "If True, the Gateway forwards the request. If False, the Gateway returns HTTP 429 (Too Many Requests) immediately, dropping the payload before it ever reaches the backend database. The Gateway includes `X-RateLimit-Remaining` headers."
            },
            {
                "step": 4,
                "title": "Load Shedding",
                "detail": "Even if individual users are within their limits, if global CPU usage spikes > 90%, the 'Fleet Load Shedder' activates, rejecting non-essential APIs (like `GET /v1/balance`) to guarantee that `POST /v1/charges` never fails."
            }
        ],
        "key_concepts": [
            {
                "term": "Token Bucket Algorithm",
                "definition": "INTERNAL: A bucket is assigned a capacity (e.g., 100) and a refill rate (e.g., 10 tokens/sec). Requests cost 1 token. It allows for sudden 'bursts' of traffic (up to 100 instant requests) but strictly enforces the long-term rate."
            },
            {
                "term": "Load Shedding",
                "definition": "While Rate Limiting protects against aggressive users, Load Shedding protects against total system failure. The system mathematically drops lower-priority requests entirely based on global hardware health, rather than per-user quotas."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Token Bucket with Redis Lua",
                "description": "Concrete Python code proving how to implement an atomic Token Bucket check to avoid race conditions.",
                "code": "import redis\nimport time\n\nr = redis.Redis(host='localhost', port=6379, db=0)\n\nLUA_SCRIPT = \"\"\"\nlocal key = KEYS[1]\nlocal limit = tonumber(ARGV[1])\nlocal current = tonumber(redis.call('get', key) or \"0\")\nif current + 1 > limit then\n  return 0\nelse\n  redis.call(\"INCRBY\", key, 1)\n  redis.call(\"EXPIRE\", key, ARGV[2])\n  return 1\nend\n\"\"\"\n\ndef is_allowed(user_id, limit=100, window_sec=60):\n    lua_func = r.register_script(LUA_SCRIPT)\n    result = lua_func(keys=[f\"rate:{user_id}\"], args=[limit, window_sec])\n    return bool(result)"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Production Java snippet utilizing Guava for local node caching before hitting Redis.",
                "code": "public class LocalRateLimiter {\n    // Thread-safe Guava RateLimiter for Concurrent Request Limiting (Tier 2 in Stripe)\n    private static final RateLimiter rateLimiter = RateLimiter.create(100.0); // 100 per sec\n    \n    public boolean checkLimit() {\n        // tryAcquire prevents thread blocking (returns false instantly if bucket is empty)\n        if (rateLimiter.tryAcquire()) {\n            return true;\n        } else {\n            throw new RateLimitExceededException(\"HTTP 429 Too Many Requests\");\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Algorithms",
                "description": "Evaluating rate limiter algorithms.",
                "code": "OPTION Token Bucket vs OPTION Sliding Window Log\n------------------------------------------------\nPros Token Bucket: Extremely memory efficient (stores 2 integers per user), allows bursts.\nCons Token Bucket: Tricky to tune the refill rate optimally.\nPros Sliding Window: 100% perfectly accurate rolling window limits.\nCons Sliding Window: Horrendous memory footprint (must store timestamp for EVERY single request), impossible to scale for 10M active users."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "What happens if the Rate Limiter dies?",
                "code": "try-catch fallback mechanics:\n1. RedisTimeoutException: If the Redis cluster powering the Rate Limiter fails entirely, the API Gateway must 'Fail Open'. Dropping all payments because the limiter broke is unacceptable. We emit a high-priority alert and temporarily allow all traffic to pass through un-limited.\n2. Clock Drift: NTP sync failures between API gateways can cause race conditions if relying on timestamps. Solved by exclusively using Redis Server Time."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (API Gateway Timeout)",
            "default": "Timeout = 50ms",
            "effect": "Modify parameter `rate_limiter_timeout_ms=10`.",
            "tradeoff": "The rate limiter check happens on EVERY API call. If Redis responds slowly, setting a strict 10ms timeout ensures the API doesn't slow down, but guarantees some traffic bypasses the limit via the 'fail open' catch."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Reducing Redis CPU load under planetary scale.",
            "how": "Use Local Memory + Weak Consistency. Instead of the API Gateway hitting Redis for every single request, the API gateway batches checks locally in stateful memory for 1 second, then syncs to Redis asynchronously. This allows single users to exceed limits by brief margins, but reduces network I/O by 99%."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Stripe Multi-Tier Rate Limiting Architecture",
        "description": "Edge Limiting vs Load Shedding.",
        "data": {
            "mermaid_source": "graph TD\n  Client[Client Payload] --> Edge[API Gateway / Edge]\n  Edge --> |1. Check Limit| Redis[(Redis Token Bucket)]\n  Redis -.-> |Deny| 429[HTTP 429 Response]\n  Redis -.-> |Allow| Shedder[Fleet Load Shedder]\n  \n  Shedder --> |Global CPU > 90%| PriorityCheck{Is Critical?}\n  PriorityCheck --> |No| 503[HTTP 503 Service Unavailable]\n  PriorityCheck --> |Yes| Backend[Payment Processing Microservice]"
        }
    },
    "limitations": [
        "Distributed Race Conditions: If a user fires 100 identical requests across 100 API edge nodes in the same millisecond, simple Redis 'GET then SET' logic will fail and allow all 100 through. TWEAK: Rate limits MUST execute atomically via Redis `INCR` or embedded Lua Scripts.",
        "Thundering Load on Retry: Returning generic HTTP 429 causes naive clients to retry instantly, creating a DDoSer out of a friendly client. TWEAK: Mandate exponential backoff, and return specific `Retry-After: 30` HTTP headers."
    ],
    "technologies_used": [
        {
            "technology": "Redis Lua Scripting",
            "details": "Redis executes Lua scripts entirely atomically. No other script or command can execute while a Lua script is running, providing a perfect distributed lock mechanism for rate limit counters without relying on slow distributed mutexes."
        },
        {
            "technology": "Envoy Proxy",
            "details": "Often used as the Edge API gateway. Envoy has built-in Global Rate Limiting extensions that interface directly with Redis out of the box."
        }
    ]
},
{
    "id": "cs09",
    "title": "Case Study: Distributed Cache (Redis / Memcached)",
    "parent_id": null,
    "order": 26,
    "tags": ["case-study", "caching", "redis", "memcached", "high-availability"],
    "summary": "Design a highly available distributed caching tier capable of servicing 10 million reads per second with sub-millisecond latency, featuring sharding, replication, and cache eviction.",
    "explanation": {
        "overview": "A Distributed Cache is the backbone of modern web architecture. Databases cannot handle 10 million reads per second, but a fleet of RAM-based caching servers can. The challenge is designing the cache to act as a unified, logical cluster so massive datasets can be sharded (partitioned) across hundreds of cheap nodes, while ensuring that if a node explodes, the data isn't lost and the application doesn't crash.",
        "how_it_works_internally": "INTERNAL Mechanics: The system fundamentally relies on Consistent Hashing or algorithmic sharding (like Redis Cluster's 16,384 Hash Slots). When the App Server tries to fetch `user:item123`, it hashes the key using CRC16 modulo 16384, determining exactly which physical Node holds that data. To ensure High Availability, each Master Node has synchronous or asynchronous Replicas. If Master Node A dies, Redis Sentinel or a Gossip protocol detects the failure, and automatically promotes Replica A1 to become the new Master.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Cache Aside Patter Initiation",
                "detail": "App server queries the cache for `User:1`. Cache returns a Miss. App server queries the massive Postgres DB, gets the result, writes it to the Distributed Cache with a TTL (Time To Live), and returns it to the user."
            },
            {
                "step": 2,
                "title": "Data Partitioning (Sharding)",
                "detail": "To store 10 Terabytes of hot cache in physical servers that only have 128GB of RAM, the dataset is hashed and spread out smoothly across ~100 Master nodes."
            },
            {
                "step": 3,
                "title": "Data Eviction (LRU)",
                "detail": "Cache memory isn't infinite. Once the node hits 128GB, it executes Least Recently Used (LRU) algorithms to selectively delete the oldest, least accessed keys to make room for new DB reads."
            },
            {
                "step": 4,
                "title": "Persistence",
                "detail": "While mostly in memory, Redis specifically streams operations to an Append-Only File (AOF) on disk. If the entire cluster power cycles, it can painfully, but successfully, rebuild state from disk."
            }
        ],
        "key_concepts": [
            {
                "term": "Thundering Herd / Cache Stampede",
                "definition": "INTERNAL: A catastrophic event where a highly viewed viral key (e.g., 'Superbowl Score') expires. In that exact millisecond, 50,000 App Servers experience a cache miss and ALL instantly slam the database simultaneously, crashing the database."
            },
            {
                "term": "Consistent Hashing",
                "definition": "A distributed hashing scheme that avoids complete key reshuffling when a node is added or removed. It maps nodes and keys onto a ring, ensuring minimal data movement during scaling events."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Preventing Cache Stampedes",
                "description": "Concrete Python code utilizing singleflight / caching mutex locks to prevent the database from melting on expiration.",
                "code": "import redis\nimport time\n\nr = redis.Redis(host='localhost', port=6379, db=0)\n\ndef fetch_user_data(user_id):\n    val = r.get(f\"user:{user_id}\")\n    if val:\n        return val\n        \n    # Cache Miss: Acquire extremely short-lived lock (Mutex)\n    lock_key = f\"lock:user:{user_id}\"\n    if r.set(lock_key, \"1\", ex=5, nx=True):\n        # We got the lock! Query the slow database\n        db_val = slow_database_query(user_id)\n        # Write back to cache with 1 hour TTL\n        r.set(f\"user:{user_id}\", db_val, ex=3600)\n        r.delete(lock_key)\n        return db_val\n    else:\n        # Someone else is querying the DB. Wait briefly and retry cache.\n        time.sleep(0.05)\n        return fetch_user_data(user_id)"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Production JDK implementation of a Consistent Hashing Ring.",
                "code": "public class ConsistentHash<T> {\n    // Thread-safe Treemap mimicking the hash ring\n    private final ConcurrentSkipListMap<Integer, T> circle = new ConcurrentSkipListMap<>();\n    \n    public void addNode(T node, int virtualNodes) {\n        for (int i = 0; i < virtualNodes; i++) {\n            circle.put(hash(node.toString() + i), node);\n        }\n    }\n    \n    public T getNode(String key) {\n        if (circle.isEmpty()) return null;\n        int hash = hash(key);\n        if (!circle.containsKey(hash)) {\n            SortedMap<Integer, T> tailMap = circle.tailMap(hash);\n            hash = tailMap.isEmpty() ? circle.firstKey() : tailMap.firstKey();\n        }\n        return circle.get(hash);\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Memcached vs Redis",
                "description": "Evaluating which caching technology to adopt.",
                "code": "OPTION Memcached vs OPTION Redis\n--------------------------------\nPros Memcached: Exceptionally simple, massively multi-threaded string processing.\nCons Memcached: Only supports basic strings, entirely ephemeral (volatile), no replication.\nPros Redis: Rich data structures (Lists, Bitmaps, Sorted Sets), disk persistence, built-in clustering.\nCons Redis: Single threaded (bottlenecks on massive CPU-bound ops), requires careful memory management."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Cache Partitions and Hot Keys.",
                "code": "try-catch fallback mechanics:\n1. HotKeyException: Justin Bieber's user profile causes massive CPU spikes on Node 45 (because hashing always routes his ID specifically to Node 45). We catch latency alerts and mitigate by introducing 'Local Node Caching' (Guava) inside the App Server itself to shield the Redis Node.\n2. Split Brain: Network divides master and replica. Mitigated by Redis Sentinel requiring a strict Quorum (minimum 3 Sentinel nodes) to verify a master failure before promoting a replica."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (Redis Eviction Policies)",
            "default": "maxmemory-policy noeviction (Cache throws OOM errors when full).",
            "effect": "Modify parameter `maxmemory-policy allkeys-lru` to force the cache to intelligently drop the stalest key-value pairs.",
            "tradeoff": "LRU requires Redis to compute the 'idle time' of every accessed key, adding slight CPU overhead to every single read."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Handling massive write-heavy analytical states.",
            "how": "Use Write-Behind (Write-Back) Caching. Instead of App Servers writing to the DB and then Cache, they write exclusively to the Cache (very fast). The Cache maintains the dirty state and asynchronously flushes batches of updates to the DB every 5 minutes."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Distributed Caching Master-Replica Architecture",
        "description": "Shows Consistent Hashing Ring routing traffic to Shard Clusters.",
        "data": {
            "mermaid_source": "graph TD\n  App[App Server Fleet] --> Router[Consistent Hash Router]\n  \n  subgraph \"Shard 1 (Keys A-F)\"\n    Router --> M1[Master Node 1]\n    M1 -.-> |Async Copy| R1[Replica Node 1]\n  end\n  \n  subgraph \"Shard 2 (Keys G-P)\"\n    Router --> M2[Master Node 2]\n    M2 -.-> |Async Copy| R2[Replica Node 2]\n  end\n  \n  subgraph \"Shard 3 (Keys Q-Z)\"\n    Router --> M3[Master Node 3]\n    M3 -.-> |Async Copy| R3[Replica Node 3]\n  end\n  \n  Sentinel((Sentinel Cluster)) --> M1\n  Sentinel --> M2\n  Sentinel --> M3"
        }
    },
    "limitations": [
        "Single-Thread Bottleneck: Redis processes commands on a single thread. Executing an O(N) command like `KEYS *` loops the entire dataset, blocking every other client's request. TWEAK: Completely disable risky commands in prod config via `rename-command KEYS \"\"` and use `SCAN` instead.",
        "Replication Lag: Cache reads from a replica inherently receive stale data due to async replication delays. TWEAK: For financial primitives, strictly route reads to the Master node."
    ],
    "technologies_used": [
        {
            "technology": "Redis Cluster",
            "details": "The industry standard for distributed caching. It abstracts away consistent hashing rings by simply assigning 16,384 slots across the network. If you need to add servers, Cluster resharding moves slots gracefully without taking the cache offline."
        },
        {
            "technology": "Memcached",
            "details": "The legacy multithreaded caching system. Excellent for pure HTML string caching where you want bare-metal CPU multi-processing, but lacking modern high-availability clustering."
        }
    ]
}
];

cs08_09.forEach(cs => {
    fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/' + cs.id + '_' + cs.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 15) + '.json', JSON.stringify(cs, null, 4));
});
console.log('Successfully generated cs08 and cs09 json files.');
