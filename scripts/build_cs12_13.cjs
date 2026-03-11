const fs = require('fs');

const cs12_13 = [
{
    "id": "cs12",
    "title": "Case Study: Dropbox / File Sync & Backup",
    "parent_id": null,
    "order": 29,
    "tags": ["case-study", "dropbox", "sync", "chunking", "deduplication"],
    "summary": "Design a globally distributed cloud file synchronization service like Dropbox or Google Drive that handles offline capability, conflict resolution, and minimizes bandwidth via block-level chunking.",
    "explanation": {
        "overview": "Designing a cloud storage system primarily used for continuous background syncing is drastically different from standard API design. Users change files constantly, offline and online. If a user modifies a single typo in a 1GB presentation, uploading the entire 1GB file again is an architectural failure. The system must utilize 'Block-Level Delta Synchronization' to only upload the exact bytes that changed, while robustly handling split-brain conflict resolution when multiple devices edit the same file offline.",
        "how_it_works_internally": "INTERNAL Mechanics: The architecture separates the Metadata Service from the Block Storage Service (Magic Pocket). When a user drops a 12MB file into their local Dropbox folder, the Desktop Client immediately splits it into three 4MB chunks. The client calculates the SHA-256 hash of each chunk and asks the Metadata Server, 'Do you already have these hashes?'. This allows for Global Deduplication. If a chunk already exists (even uploaded by another user), the upload is skipped entirely. If the chunks are new, they are uploaded securely to Block Storage. The Metadata Server then updates the Namespace and pushes a WebSocket notification to the user's other devices to pull the new chunks.",
        "step_by_step": [
            {
                "step": 1,
                "title": "File Watcher & Chunking",
                "detail": "The OS file watcher detects a save event. The desktop daemon splits the file into fixed 4MB payload chunks and calculates their SHA-256 hashes."
            },
            {
                "step": 2,
                "title": "Metadata Pre-Flight",
                "detail": "The client sends the list of hashes to the Metadata Server. The server acknowledges which hashes it lacks, preventing redundant uploads (Deduplication)."
            },
            {
                "step": 3,
                "title": "Block Storage Upload",
                "detail": "Client uploads missing 4MB chunks directly to the dumb storage plane (S3 or Custom 'Magic Pocket' nodes). Storage nodes verify the hash, ensuring no data corruption in transit."
            },
            {
                "step": 4,
                "title": "Namespace Commit & Sync",
                "detail": "Client tells Metadata Server 'Chunks uploaded successfully'. Metadata Server binds the chunk hashes to the `file.pptx` manifest and pushes an event to other connected clients via long-polling or WebSockets."
            }
        ],
        "key_concepts": [
            {
                "term": "Block-Level Delta Synchronization (rsync)",
                "definition": "INTERNAL: Instead of transferring an entire file, the system only transfers the specific 4MB blocks/chunks that were altered. If you append data to the end of a log file, only the final block is transmitted."
            },
            {
                "term": "Global Deduplication",
                "definition": "Because files are addressed by the hash of their contents rather than their ID, if 100,000 users upload the exact same 50MB viral video, Dropbox physically stores the 50MB exactly once, and simply creates 100,000 microscopic metadata pointers to it."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Chunk Hashing & Deduplication",
                "description": "Concrete Python logic proving how a client breaks a file into chunks and calculates integrity hashes.",
                "code": "import hashlib\nimport os\n\nCHUNK_SIZE = 4 * 1024 * 1024  # 4MB\n\ndef process_file_for_upload(filepath):\n    chunk_hashes = []\n    with open(filepath, 'rb') as f:\n        while True:\n            chunk = f.read(CHUNK_SIZE)\n            if not chunk:\n                break\n            # Calculate strict SHA-256 for deterministic global deduplication\n            chunk_hash = hashlib.sha256(chunk).hexdigest()\n            chunk_hashes.append(chunk_hash)\n            \n            # In reality, conditionally upload chunk only if server requests it\n            upload_chunk_if_missing(chunk_hash, chunk)\n            \n    # Commit the file manifest to the Metadata DB\n    commit_manifest(os.path.basename(filepath), chunk_hashes)\n    return chunk_hashes"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Desktop daemon pushing concurrent chunks effectively.",
                "code": "public class SyncDaemon {\n    // Bounded thread pool prevents the background sync from destroying the user's internet connection\n    private final ExecutorService uploadPool = Executors.newFixedThreadPool(4);\n    \n    public void syncFile(List<Chunk> missingChunks) {\n        List<CompletableFuture<Void>> futures = missingChunks.stream()\n            .map(chunk -> CompletableFuture.runAsync(() -> storageClient.put(chunk), uploadPool))\n            .collect(Collectors.toList());\n            \n        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))\n            .thenRun(() -> metadataClient.commitManifest(manifest));\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Chunking Algorithms",
                "description": "Evaluating Fixed vs Content-Defined.",
                "code": "OPTION Fixed-Size Chunking (4MB) vs OPTION Content-Defined Chunking (CDC)\n-------------------------------------------------------------------------\nPros Fixed-Size: Extremely fast, minimal CPU cost to index a file.\nCons Fixed-Size: If a user inserts 1 byte at the START of a file, every subsequent 4MB chunk shifts, completely breaking deduplication and forcing a full re-upload.\nPros CDC (Rabin Fingerprints): Dynamically identifies boundaries based on content, not byte offset. A 1-byte insert only ruins a single chunk.\nCons CDC: Computationally heavy, heavily draining laptop battery life. (Dropbox originally used fixed, later transitioned to advanced CDC methodologies)."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Handling split-brain edits.",
                "code": "try-catch fallback mechanics:\n1. ConflictResolutionException: Alice edits 'Draft.txt' offline. Bob edits it online. Alice reconnects. The Metadata Server enforces Strict Version Vectors for the manifest state. It detects Alice is uploading against Version 5, but the server is at Version 6. The server rejects Alice's manifest. Alice's client automatically creates a 'Draft (Alice's conflicted copy).txt' rather than overwriting Bob's work or asking a confusing UI question.\n2. Incomplete Uploads: A chunk upload fails. The Metadata Server holds the manifest lock in a 'Pending' state. A sweeping Garbage Collector deletes orphaned chunks after 24 hours."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (SQLite SQLiteConfig)",
            "default": "PRAGMA synchronous = NORMAL",
            "effect": "Modify parameter `PRAGMA synchronous = FULL` on the local desktop client's tracking database.",
            "tradeoff": "Setting it to FULL guarantees the SQLite OS-level file watcher state is never lost during a kernel panic, but massive I/O overhead destroys solid state drive life spans. NORMAL is the preferred tradeoff."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Handling massive concurrent file modifications in large folders.",
            "how": "Use Message queues (Kafka). When a team of 1,000 people has the same shared folder, one edit requires firing 1,000 notifications. Doing this synchronously blocks the Metadata Server. The Metadata Server commits the DB row and fires a single async payload to Kafka. A fleet of Notification Workers consumes Kafka and executes the massive WebSocket fan-out."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Dropbox Synchronization Architecture",
        "description": "Decoupled Metadata DB and Block Storage with sync queues.",
        "data": {
            "mermaid_source": "graph TD\n  Client[Desktop Client] <--> |Check Hashes & Manifests| MetaAPI[Metadata API]\n  Client <--> |Upload / Download 4MB Blocks| BlockAPI[Block Storage API]\n  \n  MetaAPI --> MetaDB[(Metadata DB / Vitess)]\n  MetaDB --> |Trigger Update| Kafka[Notification Queue]\n  Kafka --> Notify[Notification Workers]\n  Notify -.-> |WebSocket Ping| OtherClient[Other Synced Devices]\n  \n  BlockAPI --> S3[(Magic Pocket Object Storage)]"
        }
    },
    "limitations": [
        "Massive Small File Penalty: Uploading 10,000 tiny Javascript `node_modules` files causes 10,000 costly HTTPS handshakes and Metadata locking operations, drastically slowing sync (often taking longer than a single 10GB file). TWEAK: The client batches small file manifests into a single HTTP transaction and packs multiple small files into a single 4MB physical block.",
        "Latency during Conflict: Two users editing the exact same text document will conflict relentlessly. TWEAK: Dropbox is not Google Docs. It operates on Eventual Consistency and entire-file / block replacement. It is strictly meant for asynchronous file storage, not real-time concurrent operational transformation."
    ],
    "technologies_used": [
        {
            "technology": "SQLite (Client Side)",
            "details": "The desktop client relies heavily on a local SQLite database to maintain the mapping of file paths to block hashes. This allows the client to instantly know if a file changed without rescanning the entire 100GB hard drive."
        },
        {
            "technology": "Cassandra / Vitess",
            "details": "Used for the massive Metadata Storage layer depending on the era of Dropbox's architecture. Requires immense scale to map billions of chunk hashes to billions of files."
        }
    ]
},
{
    "id": "cs13",
    "title": "Case Study: Top K / Trending Topics",
    "parent_id": null,
    "order": 30,
    "tags": ["case-study", "top-k", "heavy-hitters", "streaming", "count-min-sketch"],
    "summary": "Design a real-time 'Trending Topics' or 'Heavy Hitters' system capable of monitoring an infinite stream of 100,000 events per second and instantly identifying the Top 100 most frequent items using probabilistic data structures.",
    "explanation": {
        "overview": "Finding the Top 10 most viewed videos of the month is easy: just run a slow SQL `GROUP BY` query overnight. But finding the most viral hashtags on Twitter right *now* from a firehose of 100,000 tweets per second is extremely hard. Holding a hash map in RAM for every single distinct word tweeted globally will instantly exhaust all memory (O(N) space). We must use Approximate Space-Saving Algorithms to trade a highly acceptable 1% margin of error for a 99% reduction in RAM usage.",
        "how_it_works_internally": "INTERNAL Mechanics: The industry-standard architecture pairs Apache Kafka Stream Processors with a Count-Min Sketch (CMS). A CMS is a probabilistic 2D array of integers. When a hashtag arrives, it is passed through 'd' different hash functions, which output 'd' column indices. The counters at those indices in the array are incremented. Because the width of the array is fixed, hash collisions occur. To estimate the frequency of a hashtag, we hash it again and return the *minimum* value of those collided counters, ensuring we never underestimate, only slightly overestimate. Finally, each stream processor maintains a local Min-Heap of the top 100 items it has seen. A central aggregator periodically merges these heaps to present the final global dashboard.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Stream Ingestion",
                "detail": "Events (e.g., 'Video_Watched_ID:555') hit API Gateways and are thrown into a partitioned Kafka Topic instantly, ensuring zero data loss during traffic spikes."
            },
            {
                "step": 2,
                "title": "Probabilistic Counting",
                "detail": "Stream Processors (Flink/Spark) pull events. Instead of a `dict[id] += 1` (which OOMs), the ID is fed into the Count-Min Sketch matrix, incrementing the hashed buckets."
            },
            {
                "step": 3,
                "title": "Local Top K Heap",
                "detail": "Every time the CMS is updated, the processor asks the CMS for the estimated count. If the count is larger than the smallest item in the processor's local Top K Min-Heap (size 100), the heap is updated."
            },
            {
                "step": 4,
                "title": "Global Aggregation",
                "detail": "Every 5 seconds, all 50 Stream Processors flush their local Top 100 heaps to a central Redis instance, which reduces them down to the true Global Top 100."
            }
        ],
        "key_concepts": [
            {
                "term": "Count-Min Sketch (CMS)",
                "definition": "INTERNAL: A probabilistic data structure serving as a frequency table of events in a stream. It uses predefined RAM (e.g., 2MB) regardless of whether there are 1 thousand or 10 billion distinct items. Errors are strictly overestimations caused by hash collisions."
            },
            {
                "term": "Min-Heap Data Structure",
                "definition": "A binary tree where the smallest element is always at the root. Perfect for tracking the 'Top K'. If an item's count exceeds the root (the smallest of the 'winners'), we pop the root and insert the new item in O(log K) time."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Count Min Sketch Matrix",
                "description": "Concrete Python implementation of the CMS update and query logic.",
                "code": "import mmh3 # MurmurHash3 for fast non-cryptographic hashing\n\nclass CountMinSketch:\n    def __init__(self, width, depth):\n        self.width = width\n        self.depth = depth\n        # Initialize 2D array of zeroes\n        self.table = [[0] * width for _ in range(depth)]\n\n    def add(self, item):\n        for i in range(self.depth):\n            # Use the hash seed 'i' to simulate distinct independent hash functions\n            col = mmh3.hash(str(item), i) % self.width\n            self.table[i][col] += 1\n\n    def estimate(self, item):\n        min_count = float('inf')\n        for i in range(self.depth):\n            col = mmh3.hash(str(item), i) % self.width\n            min_count = min(min_count, self.table[i][col])\n        return min_count"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Java PriorityQueue (Min-Heap) for O(log K) sliding top-K tracking.",
                "code": "public class TopKTracker {\n    private final int k;\n    // PriorityQueue defaults to Min-Heap in Java\n    private final PriorityQueue<Item> minHeap = new PriorityQueue<>(Comparator.comparingInt(Item::getCount));\n    \n    public synchronized void updateTopK(String id, int estimatedCount) {\n        // Check if item already in heap and update (complex in standard PriorityQueue, but conceptually required)\n        if (minHeap.size() < k) {\n            minHeap.offer(new Item(id, estimatedCount));\n        } else if (estimatedCount > minHeap.peek().getCount()) {\n            minHeap.poll(); // Remove smallest of the winners\n            minHeap.offer(new Item(id, estimatedCount));\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Exact vs Approximate Counting",
                "description": "Evaluating precision metrics.",
                "code": "OPTION Lossless Hash Map vs OPTION Count-Min Sketch\n---------------------------------------------------\nPros Hash Map: 100% mathematical accuracy. \nCons Hash Map: Memory scales O(N) with distinct items. To track IPs hitting a global load balancer, 4 billion IPv4 addresses ruins the RAM.\nPros Sketch: Memory scales O(1). You can track 4 billion IPs using exactly 2MB of RAM.\nCons Sketch: Will occasionally declare something a 'Heavy Hitter' because its hash unluckily collided with Justin Bieber's viral hashtag."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Sliding Window Expirations",
                "code": "try-catch fallback mechanics:\n1. Stale Trend Exception: A CMS only goes up. If an event is popular on Monday, it stays in the CMS forever, preventing Tuesday's trends from surfacing. Mitigated by using a 'Sliding Window'. We instantiate 1 empty CMS perfectly on the hour (e.g., 2:00PM CMS, 3:00PM CMS). To get the trend for the last hour, we read the active CMS. At 4:00 PM, we delete the 2:00 PM CMS from memory entirely."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (CMS Dimensions)",
            "default": "Depth (d) = 5, Width (w) = 2000.",
            "effect": "Modify parameter Depth (number of hash functions) to reduce the probability of error. Modify factor Width to reduce the maximum magnitude of the error.",
            "tradeoff": "Increasing the width demands linearly more memory. Increasing depth demands more memory AND linearly increases the CPU hashing overhead for every single event processed natively."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Offloading processing from database entirely.",
            "how": "Use MapReduce / Lambda Architecture. The Count-Min Sketch is the 'Speed Layer' providing instantaneous approximations for the UI. Simultaneously, all events drop into S3/Hadoop. A nightly MapReduce job computes the 100% mathematically accurate counts (The 'Batch Layer') and overwrites the UI database, correcting any probabilistic drift."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Top-K Trending / Heavy Hitters Architecture",
        "description": "Kafka Stream Processors backed by Probabilistic Sketches.",
        "data": {
            "mermaid_source": "graph TD\n  Events[100k events/sec] --> API[API Gateway]\n  API --> Kafka[(Kafka Log Topic)]\n  \n  Kafka --> F1[Flink Processor 1]\n  Kafka --> F2[Flink Processor 2]\n  \n  F1 --> CMS1[(Count-Min Sketch 1)]\n  F1 --> Heap1[Local Min-Heap 1]\n  F2 --> CMS2[(Count-Min Sketch 2)]\n  F2 --> Heap2[Local Min-Heap 2]\n  \n  Heap1 -.-> |Push Top 100| Redis[Redis Global Aggregator]\n  Heap2 -.-> |Push Top 100| Redis\n  \n  Redis --> UI[Trending Dashboard]"
        }
    },
    "limitations": [
        "Distributed Merging: If you stream route event A to Flink Node 1, and event A again to Flink Node 2, neither local heap might break the threshold for A, so it never reaches the global aggregator despite being a global heavy hitter. TWEAK: The Kafka partition MUST be consistently routed by `Hash(Event_ID)`. All instances of Event A must process on the exact same Flink Node.",
        "Absolute Disregard for the Tail: A CMS is entirely useless at estimating the count of rare items (the long tail), because collisions from heavy hitters will drown them out completely. TWEAK: Do not use CMS for auditing, billing, or precise user analytics."
    ],
    "technologies_used": [
        {
            "technology": "Apache Flink / Spark Streaming",
            "details": "State-of-the-art stream processing engines built to consume Kafka logs, apply windowing logic, and manage state in-memory distributed across thousands of worker JVMs."
        },
        {
            "technology": "Redis API (ZREVRANGE)",
            "details": "Redis Sorted Sets (ZSET) are the perfect data structure for the central aggregator. Stream nodes push their local heaps to Redis using `ZINCRBY`. The UI queries the global top hits instantly using `ZREVRANGE`."
        }
    ]
}
];

cs12_13.forEach(cs => {
    fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/' + cs.id + '_' + cs.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 15) + '.json', JSON.stringify(cs, null, 4));
});
console.log('Successfully generated cs12 and cs13 json files.');
