const fs = require('fs');

const cs02_03 = [
{
    "id": "cs02",
    "title": "Case Study: Distributed Web Crawler (Googlebot)",
    "parent_id": null,
    "order": 19,
    "tags": ["case-study", "web-crawler", "bfs", "distributed"],
    "summary": "Design a highly scalable web crawler capable of downloading and indexing billions of web pages per month while respecting robots.txt and avoiding spider traps.",
    "explanation": {
        "overview": "A web crawler continuously traverses the internet to download web pages for search engines, archives, or data mining. The core algorithm is a distributed Breadth-First Search (BFS). You start with seed URLs, download the pages, extract links, filter out visited URLs, and add new ones to the queue.",
        "how_it_works_internally": "INTERNAL Mechanics: The system relies on a massively distributed URL Frontier (a priority queue). Worker nodes pull URLs from the Frontier, resolve DNS, fetch HTML, parse it, and extract links. A Bloom Filter checks if a newly found URL has already been visited (we can't use a standard hash set for billions of URLs as it would consume terabytes of RAM). Valid, unvisited links are appended back to the Frontier. The parsed HTML content is streamed to an object store (S3) or BigTable for indexing.",
        "step_by_step": [
            {
                "step": 1,
                "title": "URL Frontier Queueing",
                "detail": "The Frontier prioritizes URLs based on PageRank, freshness, and domain limits to avoid DDoSing a specific site (politeness)."
            },
            {
                "step": 2,
                "title": "DNS Resolution & Caching",
                "detail": "Standard DNS lookups take 10-100ms. A crawler making 10,000 requests/sec will bottleneck hard on DNS. We must use a custom, highly cached DNS resolver."
            },
            {
                "step": 3,
                "title": "HTML Fetcher & Parser",
                "detail": "Fetches the page content. A dedicated parser checks for malicious content, spider traps (infinite dynamic links like `/page/1/page/2`), and extracts out-links."
            },
            {
                "step": 4,
                "title": "Content Duplication Check (MinHash)",
                "detail": "30% of the web is duplicate content. We use Simhash/MinHash to generate a document fingerprint. If the fingerprint matches an existing one, we discard the page to save storage."
            }
        ],
        "key_concepts": [
            {
                "term": "Spider Traps",
                "definition": "INTERNAL: Infinite loops created by dynamic web pages (e.g., recursive calendars). Handled by setting a strict max-depth limit on URLs or using ML algorithms to detect repetitive URL patterns."
            },
            {
                "term": "Politeness Mechanism",
                "definition": "Crawlers must never overwhelm a site. The URL Frontier maintains separate queues per domain and ensures a delay (e.g., 5 seconds) between fetches to the same domain."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Distributed Bloom Filter Check",
                "description": "Concrete Python code proving how to check visited URLs without exhausting memory.",
                "code": "import mmh3\nfrom bitarray import bitarray\n\nclass BloomFilter:\n    def __init__(self, size, hash_count):\n        self.size = size\n        self.hash_count = hash_count\n        self.bit_array = bitarray(size)\n        self.bit_array.setall(0)\n        \n    def add(self, item):\n        for i in range(self.hash_count):\n            digest = mmh3.hash(item, i) % self.size\n            self.bit_array[digest] = 1\n            \n    def check(self, item):\n        for i in range(self.hash_count):\n            digest = mmh3.hash(item, i) % self.size\n            if self.bit_array[digest] == 0:\n                return False\n        return True"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Production JDK 21 Virtual Threads demonstrating high-concurrency HTML fetching.",
                "code": "public class CrawlerWorker {\n    public static void executeFetch(List<String> urls) {\n        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {\n            for (String url : urls) {\n                executor.submit(() -> {\n                    // Thread-safe fetch with Virtual Threads allowing 100k+ concurrent connections\n                    String content = HttpClient.fetch(url);\n                    System.out.println(\"Fetched: \" + url);\n                });\n            }\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: BFS vs DFS",
                "description": "Evaluating search algorithms for web traversal.",
                "code": "OPTION Breadth-First (BFS) vs OPTION Depth-First (DFS)\n----------------------------------------------------\nPros BFS: Highly parallelizable, naturally finds shortest paths to high-quality domains.\nCons BFS: Requires massive memory for the frontier queue.\nPros DFS: Low memory overhead.\nCons DFS: Easily gets stuck in infinite deep links / spider traps. (Hence BFS is the industry standard)."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Handling malicious sites and node crashes.",
                "code": "try-catch fallback mechanics:\n1. SSLException / SSLHandshakeException: Malformed certs are ignored and URL marked failed to prevent blocking native workers.\n2. Node Crash: The Frontier queue uses a transactional semantic (visiting = in-flight). If the node fails to ACK within 60 seconds, the URL is pushed back to the 'to-visit' queue."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (Jsoup parser)",
            "default": "Max fetch size = 1MB.",
            "effect": "Modify parameter `Connection.maxBodySize()` to prevent OOM errors from maliciously large 10GB text files.",
            "tradeoff": "Truncating HTML means missing links at the bottom of massive wiki pages, but preserves crawler stability."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Maintaining politeness queues efficiently.",
            "how": "Use Redis Sorted Sets to manage state. The score is the timestamp mapping when a domain is next allowed to be crawled. Workers pop from the top of the sorted set."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Distributed Web Crawler Architecture",
        "description": "Shows the cyclic graph of downloading, parsing, and feeding URLs back to the Frontier.",
        "data": {
            "mermaid_source": "graph TD\n  Seed[Seed URLs] --> Frontier[URL Frontier Queue]\n  Frontier --> |Pop URL| Fetcher[HTML Fetcher Node]\n  Fetcher --> DNS[(DNS Cache)]\n  Fetcher --> Internet((The Web))\n  Internet --> |HTML| Parser[HTML Parser & Extractor]\n  Parser --> DupCheck[Content Dedup / MinHash]\n  DupCheck --> |Unique| Storage[(Document Store S3)]\n  Parser --> |Extract Links| URLFilter[URL Filter & Bloom Filter]\n  URLFilter --> |Unvisited| Frontier\n  style Frontier fill:#ff9900"
        }
    },
    "limitations": [
        "Hidden Web / Deep Web: Standard crawlers cannot parse content behind login walls, complex CAPTCHAs, or heavily rendered client-side React apps. TWEAK: Deploy headless browsers (Puppeteer/Playwright) for highly valuable dynamic targets, though this drops throughput by 100x.",
        "DNS Bottlenecks: OS-level DNS is blocking. TWEAK: Implement an asynchronous DNS client in Java/Python overriding the standard library to batch UDP requests."
    ],
    "technologies_used": [
        {
            "technology": "Kafka",
            "details": "Used as the underlying URL Frontier. Offers exact-once processing semantics, extreme partition scaling, and disk-backed durability so crashing doesn't lose the unvisited queue."
        },
        {
            "technology": "Redis",
            "details": "Used for Politeness Queues, domain backoff timers, and tracking active concurrent worker leases per domain."
        }
    ]
},
{
    "id": "cs03",
    "title": "Case Study: Twitter / News Feed Design",
    "parent_id": null,
    "order": 20,
    "tags": ["case-study", "social-network", "fan-out", "caching"],
    "summary": "Design a highly available news feed supporting hundreds of millions of users, focusing on the hybrid fan-out on write vs fan-out on read architectures.",
    "explanation": {
        "overview": "A News Feed system collects status updates from people you follow and displays them in reverse chronological order. It is an extremely read-heavy system (often 100:1 read-to-write ratio). The core problem is the 'Celebrity Fan-out' issue: when an average user tweets, we can easily push it to their 50 followers. But when a celebrity heavily followed by 100 million people tweets, pushing it to all followers would completely melt the database.",
        "how_it_works_internally": "INTERNAL Mechanics: We use a Hybrid Fan-Out Architecture. Average Users use 'Fan-out on Write' (Push Model). When user A posts, a background worker instantly copies the tweet ID into the pre-computed redis cache timelines of all followers. Reads are O(1). Celebrities use 'Fan-out on Read' (Pull Model). When Justin Bieber tweets, we DO NOT push it. Instead, when a follower opens their app, the system checks the celebrity's recent tweets and merges it into the user's timeline on-the-fly.",
        "step_by_step": [
            {
                "step": 1,
                "title": "API Design",
                "detail": "POST /v1/tweet (body: content, media_ids). GET /v1/feed (query: cursor). We exclusively use cursor-based pagination so that new tweets arriving do not shift the offset window and cause users to see duplicate tweets."
            },
            {
                "step": 2,
                "title": "Data Modeling",
                "detail": "Tweet Table: ID, UserID, Content, CreatedAt. User Relation Table: FollowerID, FolloweeID. Timeline Cache (Redis): Key=UserID, Value=List<TweetID>."
            },
            {
                "step": 3,
                "title": "Handling the Celebrity Problem",
                "detail": "A user is marked as a 'celebrity' when they cross 100,000 followers. The graph database triggers a bit flip. The Fan-out service now ignores them. The Read API is modified to always query the cached list of 'celebrities I follow' and merge their recent tweets via a K-Way Merge algorithm."
            }
        ],
        "key_concepts": [
            {
                "term": "Fan-out on Write (Push)",
                "definition": "INTERNAL: Pre-computing the feed during write time. Pros: Feed loading is instant. Cons: Massive write amplification. A single tweet by someone with 1M followers generates 1M database rows or cache updates."
            },
            {
                "term": "Fan-out on Read (Pull)",
                "definition": "INTERNAL: Computing the feed during read time (when the user requests it). Pros: Minimal storage, saves resources for inactive accounts. Cons: Feed generation is slow (high latency), vulnerable to thundering herds."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: K-Way Feed Merge",
                "description": "Concrete Python code using heaps to merge pre-computed feeds with celebrity pull feeds in O(N log K) time.",
                "code": "import heapq\n\ndef merge_feeds(my_cached_feed, celebrity_feeds):\n    # my_cached_feed is a list of [timestamp, tweet_id]\n    # celebrity_feeds is a list of lists of [timestamp, tweet_id]\n    min_heap = []\n    # Negate timestamp to simulate Max Heap in Python (newest first)\n    for feed in [my_cached_feed] + celebrity_feeds:\n        if feed:\n            heapq.heappush(min_heap, (-feed[0][0], feed[0][1], feed, 0))\n            \n    merged_timeline = []\n    while min_heap and len(merged_timeline) < 20:\n        neg_ts, tweet_id, feed_list, idx = heapq.heappop(min_heap)\n        merged_timeline.append(tweet_id)\n        if idx + 1 < len(feed_list):\n            next_item = feed_list[idx + 1]\n            heapq.heappush(min_heap, (-next_item[0], next_item[1], feed_list, idx + 1))\n    return merged_timeline"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Production Java snippet demonstrating asynchronous Fan-out Worker logic.",
                "code": "public class FanoutWorker {\n    public static void processTweetEvent(TweetEvent event, List<String> followers) {\n        // Submitting to thread pool to fan out asynchronously without blocking the API\n        CompletableFuture.runAsync(() -> {\n            try {\n                redisCluster.pipeline(pipeline -> {\n                    for (String followerId : followers) {\n                        pipeline.lpush(\"feed:\" + followerId, event.getTweetId());\n                        pipeline.ltrim(\"feed:\" + followerId, 0, 999); // Cap feed size\n                    }\n                });\n            } catch (Exception e) {\n                // Handle partial failures via dead letter queue\n            }\n        });\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: WebSockets vs Long Polling",
                "description": "Evaluating how to deliver new tweets live to the frontend.",
                "code": "OPTION WebSockets vs OPTION Server-Sent Events (SSE)\n----------------------------------------------------\nPros WebSockets: Full duplex communication, real-time.\nCons WebSockets: Heavy, requires persistent stateful connections, hard over L7 Load Balancers.\nPros SSE: Native HTTP, easier to load balance, automatic reconnection.\nCons SSE: Unidirectional (server to client only). (SSE is preferred for feeds since clients just read)."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Thundering Herds and Cache Stampedes.",
                "code": "try-catch fallback mechanics:\n1. RedisConnectionFailureException: If the timeline cache dies, users fallback to pulling from the RDBMS, which induces a Thundering Herd. Therefore, we implement robust rate limiting on the fallback path and use a Singleflight request pattern to collapse identical DB queries."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (Kafka Producer)",
            "default": "acks=1",
            "effect": "Modify parameter `acks=all` for financial transactions, but for Twitter feed generation, `acks=1` (leader only) or `acks=0` is preferred for maximum throughput.",
            "tradeoff": "Losing a few feed update events is acceptable in a social network compared to the latency penalty of strict consistency."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Scaling WebSocket connections for real-time live events (Superbowl).",
            "how": "Stateful WebSocket servers maintain user connection state. Instead of saving IP state to a DB, use a Pub/Sub backbone (Redis Pub/Sub). When a tweet arrives, publish it to a Redis channel. The specific Stateful Server subscribed to that user pushes the update instantly."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Twitter Hybrid Fan-Out Architecture",
        "description": "Separation of Push (Normal Users) and Pull (Celebrities).",
        "data": {
            "mermaid_source": "graph TD\n  Client[Mobile Client] --> API[API Gateway]\n  API --> |POST Tweet| WriteSvc[Tweet Write Service]\n  WriteSvc --> DB[(Primary Postgres)]\n  WriteSvc --> Kafka[Kafka Event Stream]\n  Kafka --> Fanout[Fan-out Workers]\n  Fanout --> GraphDB[(Graph DB: Check Followers)]\n  Fanout --> |If Followers < 100k| PushRedis[(User Timeline Redis - PUSH)]\n  \n  API --> |GET Feed| ReadSvc[Feed Aggregator Service]\n  ReadSvc --> PushRedis\n  ReadSvc --> GraphDB2[(Graph DB: Get My Celebrities)]\n  ReadSvc --> PullRedis[(Celebrity Timeline Redis - PULL)]\n  PushRedis -.-> Merge[K-Way Merge Alg]\n  PullRedis -.-> Merge\n  Merge --> Client"
        }
    },
    "limitations": [
        "Inactive Users: Fanning out to dead accounts wastes immense Redis RAM. TWEAK: Only fan-out to Users active in the last 14 days. If an inactive user logs in, synchronously generate their feed.",
        "Timeline Truncation: Storing infinite timelines in memory crashes Redis. TWEAK: Set a strict LTRIM of 500-1000 items per user length. Older tweets require fetching from Cold Storage (Cassandra)."
    ],
    "technologies_used": [
        {
            "technology": "Redis",
            "details": "Acts as the literal timeline. `LPUSH` appends new tweets. `LRANGE 0 20` fetches the first page of the timeline. O(1) performance."
        },
        {
            "technology": "Cassandra",
            "details": "Used as the permanent cold storage for actual tweet content. Scalable infinitely by hashing the TweetID, distributing PBs of text/images seamlessly without manual sharding."
        }
    ]
}
];

cs02_03.forEach(cs => {
    fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/' + cs.id + '_' + cs.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 15) + '.json', JSON.stringify(cs, null, 4));
});
console.log('Successfully generated cs02 and cs03 json files.');
