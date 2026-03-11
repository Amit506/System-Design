const fs = require('fs');

const cs10_11 = [
{
    "id": "cs10",
    "title": "Case Study: Google Docs / Collaborative Editing",
    "parent_id": null,
    "order": 27,
    "tags": ["case-study", "collaboration", "websockets", "ot", "crdt"],
    "summary": "Design a real-time collaborative text editor like Google Docs or Figma where 50 users can type the exact same document simultaneously without cursor jumping, overwriting, or state conflicts.",
    "explanation": {
        "overview": "Standard stateless web applications rely on \"Last Writer Wins\" (LWW) database rows. If Alice and Bob edit a wiki page at the same time and hit save, one overwrites the other. In a real-time collaborative editor, this is unacceptable. Every keystroke is an event. To resolve concurrent conflicts globally without locking the document, we must use complex distributed algorithms: Operational Transformation (OT) or Conflict-Free Replicated Data Types (CRDTs).",
        "how_it_works_internally": "INTERNAL Mechanics: Google Docs uses Operational Transformation (OT) via a centralized server. When Alice types 'A' at index 5, and Bob simultaneously types 'B' at index 5, both clients optimisticallly apply their edit instantly (Zero Latency UI) and send the operations over WebSockets to the Collaboration Server. The Server acts as the ultimate source of truth. It receives Alice's edit first (Revision 10), applies it, then receives Bob's edit (originally intended for Revision 9). The server mathematically transforms Bob's edit against Alice's, determining Bob's 'B' should actually go to index 6. The server broadcasts the transformed 'B' back to all clients. Clients update their local states, achieving Eventual Convergence.",
        "step_by_step": [
            {
                "step": 1,
                "title": "WebSocket Connection",
                "detail": "Clients open a persistent WebSocket to the Collaboration Server. The server sends the current document state and Version ID (e.g., V100)."
            },
            {
                "step": 2,
                "title": "Optimistic Local Edit",
                "detail": "Alice presses 'X'. The client immediately renders 'X' locally (Intention Preservation) and queues an operation `[Retain 5, Insert 'X', Retain 10]` to send to the server."
            },
            {
                "step": 3,
                "title": "Operational Transformation (Server-Side)",
                "detail": "Server receives concurrent edits from Alice and Bob. It serializes them, transforms the indices geometrically so they don't overwrite each other, and updates the canonical document."
            },
            {
                "step": 4,
                "title": "Broadcast and Acknowledge",
                "detail": "Server broadcasts the transformed operations to everyone else, and sends an 'Acknowledge' back to the original authors."
            }
        ],
        "key_concepts": [
            {
                "term": "Operational Transformation (OT)",
                "definition": "INTERNAL: An algorithm prioritizing a centralized server as the sequencer of truth. It relies on mathematical transformation functions (e.g., `Transform(OpA, OpB)`) to resolve index shifting when concurrent inserts happen."
            },
            {
                "term": "CRDT (Conflict-Free Replicated Data Types)",
                "definition": "The modern alternative to OT (used by Figma and local-first apps). Instead of relying on a central server to transform indices, every single character is assigned a fractional, infinitely divisible mathematical ID (e.g., between 1 and 2 is 1.5). Edits never conflict because IDs are globally unique, allowing true Peer-to-Peer synchronization."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Pure OT Transformation Logic",
                "description": "Concrete Python snippet demonstrating how an OT server resolves a concurrent insert collision.",
                "code": "def transform_insert_insert(op1, op2):\n    # Both try to insert at the same time.\n    if op1.index < op2.index:\n        # Op1 happened earlier in the string. \n        # Op2 needs to be pushed to the right.\n        return Insert(op2.index + len(op1.text), op2.text)\n    elif op1.index > op2.index:\n        # Op1 happened later. Op2 stays where it is.\n        return op2\n    else:\n        # Exact same index. Tie-breaker via arbitrary UUID prioritization.\n        if op1.client_id < op2.client_id:\n            return Insert(op2.index + len(op1.text), op2.text)\n        else:\n            return op2"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Production Java WebSocket broadcasting.",
                "code": "public class CollaborationServer {\n    // Thread-safe map of active document sessions\n    private final Map<String, DocumentSession> sessions = new ConcurrentHashMap<>();\n    \n    @OnMessage\n    public void onOperation(Session client, String docId, Operation op) {\n        DocumentSession doc = sessions.get(docId);\n        synchronized(doc) {\n            // 1. Transform op against history since client's last known version\n            Operation transformed = doc.getOTEngine().transform(op);\n            // 2. Apply to server copy\n            doc.apply(transformed);\n            // 3. Broadcast to all OTHER clients\n            doc.broadcastExcept(client, transformed);\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: OT vs CRDT",
                "description": "Evaluating which collaborative algorithm to use.",
                "code": "OPTION Operational Transformation (OT) vs OPTION CRDT\n-----------------------------------------------------\nPros OT: Reaps the benefits of a central database. Document state is extremely small in memory (just the raw text). \nCons OT: High network coupling. If the server is slow, the client queues up edits, eventually grinding to a halt.\nPros CRDT: True offline-first capability. Disconnect for 3 hours, reconnect, and flawlessly merge. P2P capable.\nCons CRDT: Memory footprint is massive. A 10KB text file might take 100MB of RAM to track the CRDT tombstone metadata for every character."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Handling WebSocket disconnects.",
                "code": "try-catch fallback mechanics:\n1. SplitBrainException: Client loses internet on airplane while typing. The local buffer stores the pending operations. Upon reconnecting 5 hours later, the client must fetch the server's entire history (potentially 5,000 revisions) and run the transform logic locally against its massive buffer before it can safely send its delayed edits.\n2. Server Memory Exhaustion: An OT server holds the entire document in RAM. If 1,000 users open a 500-page doc, the node OOMs. Mitigate by dynamically offloading inactive sections of the document to Redis caching."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (WebSocket Buffering)",
            "default": "Send every keystroke instantly.",
            "effect": "Modify parameter `batch_latency_ms=500` to buffer edits client-side.",
            "tradeoff": "Sending every keystroke generates 100 WebSocket frames per second per user. Batching keystrokes every 500ms drastically reduces server CPU and network overhead, but increases the probability of concurrent index conflicts requiring complex transformations."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Scaling the collaboration server globally.",
            "how": "Use Session Affinity (Sticky Sessions). Unlike stateless HTTP, OT strictly requires all users editing 'Doc Alpha' to be routed to the EXACT same physical server process. Use the API Gateway's Consistent Hashing ring, keyed by `document_id`. If the server crashes, all clients disconnect, the hash ring routes them to a new server, which pulls the latest snapshot from the DB."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Google Docs / OT Architecture Diagram",
        "description": "WebSockets, Transforms, and Sticky Session Routing.",
        "data": {
            "mermaid_source": "graph TD\n  Alice[Alice App] -->|WebSocket (doc123)| LB[Load Balancer]\n  Bob[Bob App] -->|WebSocket (doc123)| LB\n  Charlie[Charlie App] -->|WebSocket (doc999)| LB\n  \n  LB -->|Hash doc123| OT1[OT Server Node 1]\n  LB -->|Hash doc999| OT2[OT Server Node 2]\n  \n  OT1 --> Redis[Redis Cache (Recent Revisions)]\n  OT2 --> Redis\n  \n  Redis -.-> |Periodic Snapshot| S3[(S3 Object Storage)]\n  \n  style OT1 fill:#ff9900\n  style OT2 fill:#ff9900"
        }
    },
    "limitations": [
        "Cursor Tracking Overhead: Broadcasting the mouse cursor position of 50 users at 60fps melts the server. TWEAK: Decouple cursor tracking from document saving. Cursors use an impermanent Redis Pub/Sub channel and drop packets aggressively, as eventual consistency for a mouse location is irrelevant.",
        "Snapshot Sizes: Saving the complete history of every keystroke for 5 years creates a database table billions of rows long. TWEAK: The system rolls up operational history every 10 minutes into a flat 'Snapshot', dropping the raw granular operations to cold storage (S3) while keeping only recent operations in active memory."
    ],
    "technologies_used": [
        {
            "technology": "ShareJS / Txtype",
            "details": "Open source libraries implementing the incredibly difficult mathematical logic behind Operational Transformation string indexing."
        },
        {
            "technology": "Yjs / Automerge",
            "details": "The industry-standard open source libraries for implementing CRDTs instead of OT, gaining massive popularity in modern local-first applications."
        }
    ]
},
{
    "id": "cs11",
    "title": "Case Study: Amazon S3 / Object Storage",
    "parent_id": null,
    "order": 28,
    "tags": ["case-study", "storage", "cloud", "s3", "blob"],
    "summary": "Design a globally distributed Object Storage system like Amazon S3 providing 11-nines (99.999999999%) durability, unlimited scale, and strong read-after-write consistency.",
    "explanation": {
        "overview": "Unlike Block Storage (EBS) or File Storage (EFS), Object Storage does not use a directory tree or block addresses. It is a massive, flat key-value store optimized for immutable unstructured data (videos, images, backups). The fundamental system design challenge of S3 is providing 11-nines of durability. This requires extreme geo-replication, background data-scrubbing, and decoupling the Metadata namespace from the actual Data payload.",
        "how_it_works_internally": "INTERNAL Mechanics: S3 is split into the Namespace Storage (Metadata) and Object Storage (Data). When you upload `video.mp4`, the API Gateway hashes the file to verify integrity. It contacts the Namespace Service (backed by a highly consistent database like DynamoDB) to register the Object ID. The actual 5GB file is then split into chunks and pushed to the Data Service. The Data Service does not use standard RAID replication. It uses Reed-Solomon Erasure Coding, splitting the file into blocks + parity blocks distributed across dozens of physical racks in multiple Availability Zones. This allows the system to lose entire data centers without losing a single bit of your data.",
        "step_by_step": [
            {
                "step": 1,
                "title": "API Gateway Validation",
                "detail": "Client initiates a PUT request. The gateway authenticates IAM credentials, checks bucket quotas, and receives the payload stream."
            },
            {
                "step": 2,
                "title": "Metadata Registration",
                "detail": "The key (`mybucket/video.mp4`) is saved in the Namespace database, establishing an exclusive write lock to enforce strong read-after-write consistency (added to S3 in 2020)."
            },
            {
                "step": 3,
                "title": "Erasure Coding & Partitioning",
                "detail": "The 5GB file is sliced into 10 data blocks, and mathematically processed to create 4 parity blocks. These 14 blocks are sprayed across 14 different servers in 3 Availability Zones."
            },
            {
                "step": 4,
                "title": "Background Scrubbing",
                "detail": "Hard drives rot. Constantly running 'Scrubber' processes read random blocks, calculate checksums, and if bit-rot is detected, use the parity blocks to seamlessly reconstruct and heal the data on a new drive."
            }
        ],
        "key_concepts": [
            {
                "term": "Erasure Coding",
                "definition": "INTERNAL: A mathematical method (e.g., Reed-Solomon) of data protection. Instead of keeping 3 full copies of a 10GB file (30GB total), Erasure Coding splits it into 10 pieces and adds 4 parity pieces (total 14GB). Any 10 pieces can reconstruct the file, saving 50% storage costs while providing superior durability to 3x replication."
            },
            {
                "term": "Strong vs Eventual Consistency",
                "definition": "Historically S3 was eventually consistent (you could upload a file, list the bucket instantly, and not see it). In 2020, S3 was re-architected to use cache-coherence protocols to guarantee strong consistency on all PUTs and GETs without a latency penalty."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Multi-Part Upload Coordination",
                "description": "Concrete Python logic demonstrating how the backend orchestrates a 50GB file upload by accepting parallel chunks.",
                "code": "import hashlib\n\nactive_uploads = {} # Maps UploadID to received parts\n\ndef initiate_multipart_upload(object_key):\n    upload_id = generate_uuid()\n    active_uploads[upload_id] = {\"key\": object_key, \"parts\": []}\n    return upload_id\n    \ndef upload_part(upload_id, part_num, byte_data):\n    # Save physically to data nodes (Mocked)\n    etag = write_to_storage_nodes(byte_data)\n    active_uploads[upload_id][\"parts\"].append({\"num\": part_num, \"etag\": etag})\n    \ndef complete_multipart_upload(upload_id):\n    parts = active_uploads[upload_id][\"parts\"]\n    parts.sort(key=lambda x: x[\"num\"])\n    \n    # Verify contiguous parts exist and generate final master hash\n    master_hash = hashlib.md5(b\"\".join(p[\"etag\"] for p in parts)).hexdigest()\n    \n    # Finalize in Metadata DB to make it visible to GET requests\n    commit_to_namespace_db(active_uploads[upload_id][\"key\"], master_hash)\n    return True"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Java concurrent file downloader leveraging byte-range fetches.",
                "code": "public class ParallelS3Downloader {\n    // Speed up downloads by pulling 5 parts of the file simultaneously from S3\n    public void downloadInParallel(String objectKey, int totalSize) {\n        ExecutorService pool = Executors.newFixedThreadPool(5);\n        int chunkSize = totalSize / 5;\n        \n        for (int i = 0; i < 5; i++) {\n            final int start = i * chunkSize;\n            final int end = (i == 4) ? totalSize : (start + chunkSize - 1);\n            pool.submit(() -> {\n                GetObjectRequest req = new GetObjectRequest(\"bucket\", objectKey)\n                        .withRange(start, end);\n                s3Client.getObject(req);\n            });\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Storage Backends",
                "description": "Evaluating replication vs erasure coding.",
                "code": "OPTION 3x Blob Replication vs OPTION Erasure Coding (10/4)\n----------------------------------------------------------\nPros 3x Replication: Extremely fast CPU processing (just raw network copy), instantaneous reconstruction.\nCons 3x Replication: Horrendously expensive at the Exabyte scale (200% storage overhead).\nPros Erasure Coding: Extremely cheap (1.4x storage overhead), superior mathematical resilience to simultaneous multi-drive failure.\nCons Erasure Coding: Highly CPU intensive to calculate parity matrices. Reconstructing a missing block requires pulling data over the network from 10 different nodes, causing latency latency during degraded states."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Handling bit-rot and simultaneous AZ loss.",
                "code": "try-catch fallback mechanics:\n1. ChecksumMismatchException: Upon downloading a chunk, the client hashes it. If the hash doesn't match the Metadata Database, silent bit-rot occurred on the hard drive. The S3 Gateway instantly discards the corrupted block, pulls a parity block from another rack, reconstructs the data in memory, returns it to the user, and triggers an asynchronous self-healing job on the degraded disk.\n2. Total Node Failure: S3 doesn't 'repair a disk'. When a 10TB disk dies, S3 doesn't write 10TB back to an empty disk on the same box (which takes days). It sprays the 10TB of lost parity pieces across 10,000 different disks in the cluster, completing the 'array rebuild' in minutes to minimize the vulnerability window."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (S3 Storage Classes)",
            "default": "S3 Standard (High redundancy, sub-millisecond access)",
            "effect": "Modify parameter to `S3 Glacier Deep Archive`.",
            "tradeoff": "Glacier reduces storage costs by 95%. However, data retrieval shifts from milliseconds to 12 hours. Glacier physically writes the chunks to incredibly dense, slow tape-drives or spin-down hard disks, and powers down the server racks. Retrieval requires robotic arms to mount the tapes, hence the delay."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Handling massive concurrent uploads of the same key.",
            "how": "Multi-Version Concurrency Control (MVCC) / Versioning. S3 does not physically overwrite objects. An 'overwrite' actually writes an entirely new object under the hood, with a new UUID. The Metadata DB simply re-points the user's `key.txt` to the new UUID, and marks the old UUID as a 'historical version' or deletes it asynchronously via garbage collection. This achieves lock-free massive concurrent writes."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Object Storage Architecture (Amazon S3)",
        "description": "Namespace Decoupling and Erasure Coded Data Nodes.",
        "data": {
            "mermaid_source": "graph TD\n  Client --> |PUT /img.png| API[API Gateway]\n  API --> |Verify Auth| IAM((IAM Service))\n  API --> |Commit Lock| Namespace[(Metadata DB Cluster)]\n  API --> |Stream Bytes| DataPlane[Data Placement Engine]\n  \n  DataPlane --> |Calculate Parity| EC{Erasure Coder}\n  \n  EC --> |D1| Node1[Storage Rack AZ1]\n  EC --> |D2| Node2[Storage Rack AZ1]\n  EC --> |D3| Node3[Storage Rack AZ2]\n  EC --> |P1| Node4[Storage Rack AZ3]\n  \n  style Namespace fill:#ff9900\n  style EC fill:#4d4dff"
        }
    },
    "limitations": [
        "Small File Penalty: Storing 1 billion 1KB JSON files severely stresses the Namespace Database (Metadata IOPS) while wasting Data Node capacity (due to OS sector sizes). TWEAK: Batching proxies. App servers should compact 10,000 JSON files into a single 10MB Parquet block before uploading to S3.",
        "List Objects Latency: The Metadata Database is a flat key-value store, not a filesystem tree. Running `aws s3 ls` essentially executes a slow string prefix scan across millions of keys. TWEAK: Maintain a parallel relational index (Amazon Macie or external DB) if you require complex querying or 'folder' traversals."
    ],
    "technologies_used": [
        {
            "technology": "Ceph / MinIO",
            "details": "The industry standard open-source equivalents to Amazon S3. They implement the exact same architecture principles (RADOS clusters, Erasure Coded pools) but can be run on bare-metal hardware."
        },
        {
            "technology": "Reed-Solomon Codes",
            "details": "The complex algebraic matrix math used originally in NASA deep-space probes and CDs to handle errors. Used in S3 to allow a file to suffer multiple simultaneous data center disk explosions without losing a single bit."
        }
    ]
}
];

cs10_11.forEach(cs => {
    fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/' + cs.id + '_' + cs.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 15) + '.json', JSON.stringify(cs, null, 4));
});
console.log('Successfully generated cs10 and cs11 json files.');
