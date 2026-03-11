const fs = require('fs');

const cs04_05 = [
{
    "id": "cs04",
    "title": "Case Study: WhatsApp / Chat Application",
    "parent_id": null,
    "order": 21,
    "tags": ["case-study", "chat", "websockets", "real-time"],
    "summary": "Design a global, end-to-end encrypted messaging service like WhatsApp or Facebook Messenger handling 50 billion messages a day with sub-second delivery latency.",
    "explanation": {
        "overview": "A messaging application like WhatsApp requires persistent, bidirectional communication between the client and the server. Unlike standard REST APIs where the client always initiates a pull request, chat apps must push messages to receivers instantly. The core technologies involved are WebSockets, Session Servers to track which user is connected to which node, and Message Queues to handle offline user delivery.",
        "how_it_works_internally": "INTERNAL Mechanics: When User A opens WhatsApp, they establish a stateful WebSocket connection to a Chat Server. A 'Session Service' (backed by Redis) records that 'User A is on Chat Server #44'. When User A sends a message to User B, Chat Server #44 queries the Session Service to find User B. If User B is connected to Chat Server #89, the message is routed directly to Server #89 via a Pub/Sub queue, which instantly pushes it via WebSocket to User B. If User B is offline, the message is queued in Cassandra until they reconnect.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Connection Establishment",
                "detail": "Client negotiates a TLS WebSocket connection with the API Gateway, which routes them to a continuously running Chat Server node."
            },
            {
                "step": 2,
                "title": "Routing Messages",
                "detail": "The Chat Server looks up the recipient's current active TCP connection in the global Session Store (Redis KV store)."
            },
            {
                "step": 3,
                "title": "Delivering & Acknowledging",
                "detail": "Message sent to recipient. Once received, an 'Ack' (double-tick) is routed back to the sender using the same infrastructure."
            },
            {
                "step": 4,
                "title": "Offline Handling",
                "detail": "If recipient is offline, the message is stored in NoSQL (Cassandra). When the user connects, their client pulls pending messages and deletes them from the server (ephemeral storage)."
            }
        ],
        "key_concepts": [
            {
                "term": "WebSockets",
                "definition": "INTERNAL: A protocol providing full-duplex communication channels over a single TCP connection. Once established, both client and server can send frames simultaneously without HTTP header overhead."
            },
            {
                "term": "End-to-End Encryption (E2EE)",
                "definition": "The server never sees plaintext messages. The sender encrypts the payload using the receiver's public key (Signal Protocol). The server only routes the encrypted blob."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: WebSocket Server",
                "description": "Concrete Python code using Asyncio and WebSockets for high-concurrency connections.",
                "code": "import asyncio\nimport websockets\n\nconnected_users = {}\n\nasync def chat_handler(websocket, path):\n    user_id = path.strip('/')\n    connected_users[user_id] = websocket\n    try:\n        async for message in websocket:\n            # Parse recipient from payload (simplified)\n            target_id, payload = message.split(':', 1)\n            if target_id in connected_users:\n                # Push to target\n                await connected_users[target_id].send(f\"From {user_id}: {payload}\")\n            else:\n                # Offline handling: save to DB\n                pass\n    finally:\n        del connected_users[user_id]"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Java Netty implementation for zero-copy TCP WebSocket routing.",
                "code": "public class ChatServerHandler extends SimpleChannelInboundHandler<TextWebSocketFrame> {\n    // Thread-safe channel map\n    private static final Map<String, Channel> channels = new ConcurrentHashMap<>();\n    \n    @Override\n    protected void channelRead0(ChannelHandlerContext ctx, TextWebSocketFrame frame) {\n        String msg = frame.text();\n        String receiverId = extractReceiver(msg);\n        Channel target = channels.get(receiverId);\n        \n        if (target != null && target.isActive()) {\n            target.writeAndFlush(new TextWebSocketFrame(msg));\n        }\n    }\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: WebSockets vs Long Polling",
                "description": "Evaluating protocols for real-time delivery.",
                "code": "OPTION WebSockets vs OPTION Long Polling\n----------------------------------------\nPros WebSockets: True bidirectional flow, very low latency (ms), low overhead per message.\nCons WebSockets: Hard to scale load balancers (sticky sessions required), harder to deploy seamlessly.\nPros Long Polling: Uses standard HTTP infrastructure, easy to proxy.\nCons Long Polling: Header overhead (auth cookies) sent repeatedly, higher latency."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Handling broken pipes and missing ACKs.",
                "code": "try-catch fallback mechanics:\n1. BrokenPipeException or TimeoutException: Client lost 4G connection. Server explicitly removes them from the Redis Session Store. In-flight messages are routed to the Cassandra Offline Queue.\n2. Server Crash: 50,000 WebSockets drop instantly. Clients execute exponential backoff to reconnect, preventing a thundering herd DDOS on the remaining infrastructure."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (OS TCP Stack)",
            "default": "Linux default limits `fs.file-max` heavily limit open sockets.",
            "effect": "Modify parameter `ulimit -n 1000000` to allow a single WhatsApp server to hold 1 million simultaneous TCP connections. Also modify `net.ipv4.tcp_rmem` (TCP buffers) to use minimal memory per connection.",
            "tradeoff": "Shrinking buffers allows millions of connections but penalizes high-bandwidth payloads like video transfers."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Handling WebSocket termination at scale.",
            "how": "Stateful Connections. Unlike standard REST apps, Chat Servers hold state (the open TCP socket). To scale this safely, the API Gateway uses Consistent Hashing by UserID to route returning clients to the same server if a connection drops."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "WhatsApp Architecture Diagram",
        "description": "Real-time message routing and offline queueing.",
        "data": {
            "mermaid_source": "graph TD\n  Alice[Alice Client] <-->|WebSocket| CS1[Chat Server 1]\n  Bob[Bob Client] <-->|WebSocket| CS2[Chat Server 2]\n  \n  CS1 --> Session[(Redis Session DB)]\n  CS2 --> Session\n  \n  CS1 --> |Publishes Bob's Msg| Kafka[(Message Queue)]\n  Kafka --> |Consumes Bob's Msg| CS2\n  \n  CS1 --> |If Bob Offline| OfflineDB[(Cassandra Offline DB)]\n  Bob --> |Syncs on connect| OfflineDB"
        }
    },
    "limitations": [
        "Group Chats: In a 256-person group, one message requires 256 outbound WebSocket writes. If 1,000 groups chat simultaneously, it causes explosive fan-out latency. TWEAK: Implement a dedicated Group Message Dispatch service built on Erlang/Elixir (WhatsApp's actual tech stack) designed for microscopic thread concurrency.",
        "Media Transfer: Pushing a 50MB video through WebSockets blocks the single thread parsing it. TWEAK: Upload videos via standard REST HTTP to S3, and only push the S3 URL (metadata thumbnail) over the WebSocket."
    ],
    "technologies_used": [
        {
            "technology": "Erlang",
            "details": "WhatsApp's original core architecture was built on Erlang (and FreeBSD) because Erlang's lightweight processes and Actor model allow millions of concurrent chat sessions per single physical server."
        },
        {
            "technology": "Cassandra",
            "details": "Used for offline message queueing. It handles ultra-fast writes (when the sender transmits) and ultra-fast deletes (when the receiver downloads). Cassandra relies on log-structured merge trees perfectly suited for this workload."
        }
    ]
},
{
    "id": "cs05",
    "title": "Case Study: Ticketmaster / Flash Sale Booking",
    "parent_id": null,
    "order": 22,
    "tags": ["case-study", "booking", "concurrency", "locking", "transactions"],
    "summary": "Design a ticketing system capable of handling extreme, sudden spikes in traffic (e.g., Taylor Swift concert) while preventing double-booking and ensuring fair access.",
    "explanation": {
        "overview": "Ticketing, flash-sales, and hotel booking systems are uniquely difficult. Unlike a social network where eventual consistency is acceptable, selling a limited physical asset (a specific seat) requires strict transactional consistency (ACID). If two users click 'Buy Seat 5A' at the exact same millisecond, only one must succeed. This is a battle against the flash-crowd thundering herd.",
        "how_it_works_internally": "INTERNAL Mechanics: The system leverages a massive, asynchronous queuing system (Virtual Waiting Room) before users ever reach the booking page to protect the database. When a user selects a seat, the system issues a Distributed Lock (via Redis) or relies on pessimistic database row locks (e.g., `SELECT FOR UPDATE`). Once locked, the user has 5 minutes to complete payment. If payment succeeds, the seat state changes to 'SOLD'. If the timer expires or the payment fails, the lock is released, and the seat becomes 'AVAILABLE' again. This relies on TTL (Time-To-Live) keys in Redis or a background chron job in SQL.",
        "step_by_step": [
            {
                "step": 1,
                "title": "Virtual Waiting Room",
                "detail": "Requests pour in at 1M QPS. They hit an Edge CDN layer and are funneled into a Kafka queue. Users receive a WebSocket polling token showing their place in line. This converts a 1M QPS DDoS storm into a controlled 5,000 QPS trickle to the booking servers."
            },
            {
                "step": 2,
                "title": "Seat Reservation (Locking)",
                "detail": "User selects Seat 1A. Application attempts to execute an atomic operation in Redis: `SETNX seat:1A user_123 EX 300`. If successful, the seat is locked for 300 seconds (5 mins)."
            },
            {
                "step": 3,
                "title": "Payment Processing",
                "detail": "User inputs credit card. System posts to Stripe. To prevent dropped connections ruining the transaction, a Transactional Outbox pattern ensures the 'Payment Intent' event is durably committed before responding."
            },
            {
                "step": 4,
                "title": "Finalization",
                "detail": "Stripe webhook confirms payment. Booking service changes Postgres row `status='SOLD'` and deletes the temporary Redis lock."
            }
        ],
        "key_concepts": [
            {
                "term": "Distributed Locking (Mutex)",
                "definition": "INTERNAL: Ensuring only one process across a distributed fleet of servers can mutate a specific resource. Usually implemented via Redis `SETNX` or ZooKeeper ephemeral nodes."
            },
            {
                "term": "Pessimistic vs Optimistic Locking",
                "definition": "Pessimistic: Locking the database row before reading it (`SELECT ... FOR UPDATE`), entirely preventing other reads. Optimistic: Reading a row with a version number (V1), making changes, and updating ONLY IF the version hasn't changed (`UPDATE ... WHERE version=1`). Flash sales strictly require Pessimistic Locking to avoid massive retry storms."
            }
        ],
        "examples": [
            {
                "title": "Python Implementation Snippet: Redis Lock TTL",
                "description": "Concrete Python code proving how to implement a safe expiration lock for a seat reservation.",
                "code": "import redis\nimport time\n\nr = redis.Redis(host='localhost', port=6379, db=0)\n\ndef reserve_seat(seat_id, user_id):\n    lock_key = f\"lock:seat:{seat_id}\"\n    # SETNX (Set if Not eXists) with a 5 minute expiration (300 sec)\n    acquired = r.set(lock_key, user_id, ex=300, nx=True)\n    \n    if acquired:\n        print(f\"Success! Seat {seat_id} reserved for {user_id}. Please pay within 5 mins.\")\n        return True\n    else:\n        print(f\"Failed. Seat {seat_id} is currently held by someone else.\")\n        return False"
            },
            {
                "title": "Java Implementation Snippet & Concurrency",
                "description": "Java Spring Boot JDBC snippet demonstrating pessimistic row locks.",
                "code": "public class TicketRepository {\n    @Transactional\n    @Query(\"SELECT t FROM Ticket t WHERE t.id = :id AND t.status = 'AVAILABLE' FOR UPDATE SKIP LOCKED\")\n    public Optional<Ticket> lockAvailableTicket(@Param(\"id\") Long id);\n    // SKIP LOCKED is critical here. If 10,000 threads ask for tickets, they won't queue up blocking on one row.\n}"
            },
            {
                "title": "Decision Matrix & Tradeoffs: Locking Strategies",
                "description": "Evaluating how to prevent double booking.",
                "code": "OPTION DB Pessimistic Lock vs OPTION Redis SETNX Lock\n-----------------------------------------------------\nPros DB Lock: Guaranteed absolute consistency, ACID compliant, no split-brain.\nCons DB Lock: Extremely slow under high contention, can cause connection pool exhaustion.\nPros Redis Lock: Extremely fast, high throughput.\nCons Redis Lock: Vulnerable to Redis cluster failovers (master dies before replicating lock), requiring complex Redlock algorithms."
            },
            {
                "title": "Failure Modes & Exception Handling",
                "description": "Payment timeouts and Zombie Locks.",
                "code": "try-catch fallback mechanics:\n1. PaymentTimeoutException: User closes browser mid-payment. The Redis TTL expires naturally after 5 minutes restoring the seat. \n2. DoubleChargeException: Server crashes right after Stripe replies. We must use an Idempotency Key (UUID generated by client at checkout) so submitting the retry doesn't charge the card twice."
            }
        ]
    },
    "configurable_params": [
        {
            "name": "Library Configuration Parameters (HikariCP DB Pools)",
            "default": "maximumPoolSize = 10",
            "effect": "Modify parameter `maximumPoolSize = 500` and `connectionTimeout = 1000ms`. Flash sales exhaust DB connections instantly.",
            "tradeoff": "Increasing the pool size allows more concurrent queries, but if maxed out, thousands of Tomcat threads block, crashing the web server via thread starvation."
        }
    ],
    "advanced_tweaks": [
        {
            "technique": "State Management Techniques",
            "when_to_use": "Handling complex multi-step checkout flows.",
            "how": "Use the Saga Pattern. Instead of a massive distributed 2-Phase Commit (2PC) spanning the Booking Service and the Payment Service, emit events: Seat_Reserved -> Payment_Initiated -> Payment_Failed -> Seat_Released. State machines track the Saga progression."
        }
    ],
    "diagram": {
        "type": "mermaid",
        "title": "Ticketmaster Flash Sale Architecture",
        "description": "Virtual Waiting Room and Redis Locked Checkout Flow.",
        "data": {
            "mermaid_source": "graph TD\n  Users[1 Million Users] --> Edge[Edge / WAF]\n  Edge --> WaitingRoom[Virtual Waiting Room / Kafka Queue]\n  WaitingRoom --> |Trickle 5k QPS| BookingAPI[Booking Servers]\n  BookingAPI --> Redis[(Redis: SETNX Lock)]\n  Redis -.-> |Lock Acquired| PG[(PostgreSQL: Commit Order)]\n  PG --> Stripe((Stripe Payments))\n  Redis -.-> |Lock Failed| FailMsg[Return 'Seat Taken']\n  \n  style WaitingRoom fill:#ff9900\n  style Redis fill:#ff4d4d"
        }
    },
    "limitations": [
        "Scalping Bots: Bots can bypass waiting rooms and scrape seats in 50ms. TWEAK: Enforce strict CAPTCHA at the edge, device fingerprinting, and require pre-registered Verified Fan accounts tied to phone numbers.",
        "Hot Partitions: If everyone is querying a single concert ID in PostgreSQL, the B-Tree index becomes a hot partition. TWEAK: Pre-warm a Redis cluster with the inventory mapping and route all 'Is Available?' queries to Redis. Only hit Postgres when the checkout button is actually clicked."
    ],
    "technologies_used": [
        {
            "technology": "PostgreSQL `SKIP LOCKED`",
            "details": "A database feature allowing concurrent transactions to skip over rows already locked by other transactions. Perfect for finding the 'next available general admission ticket' without halting the entire database."
        },
        {
            "technology": "Kafka & Virtual Waiting Rooms",
            "details": "Using something like AWS SQS or Kafka to buffer incoming requests. A reverse proxy (Nginx or Cloudflare Worker) checks the queue depth. If the system is at max capacity, it returns an HTML holding page instead of routing to the API."
        }
    ]
}
];

cs04_05.forEach(cs => {
    fs.writeFileSync('/Users/211446/Grokking-System-Design/course-content/chapters/' + cs.id + '_' + cs.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 15) + '.json', JSON.stringify(cs, null, 4));
});
console.log('Successfully generated cs04 and cs05 json files.');
