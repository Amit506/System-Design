const fs = require('fs');
const path = require('path');

const premiumDiagrams = {
    "ch01_oop_lld.json": {
        "title": "Low-Level Design Patterns",
        "description": "Visualizing the relationship between Factories, Singletons, and Strategy Patterns.",
        "mermaid_source": "classDiagram\n  class System {\n    +process()\n  }\n  class Factory {\n    +create() Object\n  }\n  class Singleton {\n    -instance\n    +getInstance()\n  }\n  class Strategy {\n    <<interface>>\n    +execute()\n  }\n  class ConcreteStrategyA\n  class ConcreteStrategyB\n  \n  System --> Factory : Uses\n  System --> Singleton : Access\n  System --> Strategy : Delegates\n  Strategy <|.. ConcreteStrategyA\n  Strategy <|.. ConcreteStrategyB\n  \n  style System fill:#d4af37,stroke:#000,stroke-width:2px,color:#000\n  style Strategy fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd"
    },
    "ch02_distributed_systems.json": {
        "title": "Distributed Systems Characteristics",
        "description": "Fault tolerance and horizontal scalability across multiple data centers.",
        "mermaid_source": "graph TD\n  LB[Global Load Balancer] --> DC1[Data Center US-East]\n  LB --> DC2[Data Center EU-West]\n  LB --> DC3[Data Center AP-South]\n  \n  subgraph DC1\n    API1[API Cluster] --> DB1[(Primary DB)]\n  end\n  subgraph DC2\n    API2[API Cluster] --> DB2[(Replica DB)]\n  end\n  subgraph DC3\n    API3[API Cluster] --> DB3[(Replica DB)]\n  end\n  \n  DB1 -.->|Async Replication| DB2\n  DB1 -.->|Async Replication| DB3\n  \n  style LB fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  style DB1 fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd"
    },
    "ch03_networking.json": {
        "title": "OSI Model & Protocols",
        "description": "How TCP/IP and WebSockets traverse the networking stack.",
        "mermaid_source": "graph LR\n  App[Layer 7: Application <br> HTTP/WebSocket] --> Trans[Layer 4: Transport <br> TCP/UDP]\n  Trans --> Net[Layer 3: Network <br> IP/Routing]\n  Net --> Link[Layer 2: Data Link <br> MAC/Ethernet]\n  \n  App2[Layer 7: Application] --> Trans2[Layer 4: Transport]\n  Trans2 --> Net2[Layer 3: Network]\n  Net2 --> Link2[Layer 2: Data Link]\n  \n  Link <--> |Physical Fiber/Wire| Link2\n  \n  style App fill:#d4af37,color:#000,stroke:#000,stroke-width:2px\n  style App2 fill:#d4af37,color:#000,stroke:#000,stroke-width:2px"
    },
    "ch04_load_balancing.json": {
        "title": "L4 vs L7 Load Balancing",
        "description": "Differentiating routing based on IPs vs HTTP Headers.",
        "mermaid_source": "graph TD\n  Client --> L4[Layer 4 LB: Network Router]\n  L4 --> |TCP Hash| L7_1[Layer 7 LB: Nginx/HAProxy]\n  L4 --> |TCP Hash| L7_2[Layer 7 LB: Nginx/HAProxy]\n  \n  L7_1 --> |Path /api/*| App1[API Service]\n  L7_1 --> |Path /img/*| CDN[Static Files / CDN]\n  \n  L7_2 --> |Path /api/*| App2[API Service]\n  L7_2 --> |Header Auth| Secure[Auth Service]\n  \n  style L4 fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd\n  style L7_1 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  style L7_2 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px"
    },
    "ch05_databases.json": {
        "title": "SQL vs NoSQL Architecture",
        "description": "Relational constraints vs Key-Value Distributed hashing.",
        "mermaid_source": "graph TD\n  App --> Routing{Data Type?}\n  Routing -->|ACID / Transactions| SQL[(PostgreSQL Master)]\n  Routing -->|High Volume / Scale| NoSQL[(Cassandra Ring)]\n  \n  SQL --> SQL_Rep1[(Read Replica 1)]\n  SQL --> SQL_Rep2[(Read Replica 2)]\n  \n  NoSQL --> N_Node1[Cassandra Node A]\n  NoSQL --> N_Node2[Cassandra Node B]\n  NoSQL --> N_Node3[Cassandra Node C]\n  \n  N_Node1 -.-> |Gossip| N_Node2\n  N_Node2 -.-> |Gossip| N_Node3\n  \n  style SQL fill:#d4af37,color:#000,stroke:#000,stroke-width:2px\n  style NoSQL fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd"
    },
    "ch06_indexing.json": {
        "title": "B-Tree vs Hash Indexing",
        "description": "Internal database structures for rapid lookups.",
        "mermaid_source": "graph TD\n  Query[SQL: SELECT * WHERE id = 50] --> Engine[DB Engine]\n  Engine --> BTree[B-Tree Root Node 1-100]\n  BTree --> L[Left Node 1-50]\n  BTree --> R[Right Node 51-100]\n  L --> Leaf[Leaf Page: Row 50 Data]\n  \n  Query2[NoSQL: GET key] --> Hash[Hash Function]\n  Hash --> Bucket[Memory Bucket O1]\n  Bucket --> SSD[SSD Block]\n  \n  style BTree fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  style Leaf fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd\n  style Hash fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px"
    },
    "ch08_sharding.json": {
        "title": "Consistent Hashing Ring",
        "description": "Virtual Nodes on a ring minimizing data movement when scaling.",
        "mermaid_source": "graph circular\n  R((Hash Ring 0 - 360))\n  R --> N1[Node A]\n  R --> N2[Node B]\n  R --> N3[Node C]\n  \n  User1[User 123 Hash: 40] --> N1\n  User2[User 999 Hash: 160] --> N2\n  User3[User 404 Hash: 300] --> N3\n  \n  N1 -.-> |Replicates to| N2\n  N2 -.-> |Replicates to| N3\n  N3 -.-> |Replicates to| N1\n  \n  style R fill:#1a1a1a,stroke:#d4af37,stroke-width:3px,color:#ddd\n  style N1 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px"
    },
    "ch09_cap_consensus.json": {
        "title": "CAP Theorem Tradeoffs",
        "description": "Network Partitions force a choice between Availability and Consistency.",
        "mermaid_source": "graph TD\n  Client1 --> NodeA[Node A - US]\n  Client2 --> NodeB[Node B - EU]\n  \n  NodeA -.-x |Network Partition Destroyed| NodeB\n  \n  NodeA --> CP{Choose Consistency?}\n  CP --> |Yes| Error[Return 500 Error to Client 1]\n  \n  NodeB --> AP{Choose Availability?}\n  AP --> |Yes| Stale[Return Stale Data to Client 2]\n  \n  style NodeA fill:#d4af37,color:#000,stroke:#000,stroke-width:2px\n  style CP fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd\n  style Error stroke:#ff4444,stroke-width:3px"
    },
    "ch11_concurrency.json": {
        "title": "Concurrency & Distributed Locks",
        "description": "Preventing Race Conditions across Distributed Workers via Redis SETNX.",
        "mermaid_source": "sequenceDiagram\n  participant W1 as Worker 1\n  participant R as Redis Cluster\n  participant W2 as Worker 2\n  \n  W1->>R: SETNX lock:ticket 1 EX 10s\n  R-->>W1: OK (Acquired)\n  W2->>R: SETNX lock:ticket 1 EX 10s\n  R-->>W2: FAIL (Locked)\n  W1->>W1: Process Payment\n  W1->>R: DEL lock:ticket\n  W2->>R: Retry SETNX...\n  R-->>W2: OK (Acquired)\n  \n  rect rgb(40, 40, 40)\n    note right of R: Critical Section Protected\n  end"
    },
    "ch12_rate_limiting.json": {
        "title": "Token Bucket Architecture",
        "description": "Multi-tier rate limiting executing within distributed Redis Lua scripts.",
        "mermaid_source": "graph TD\n  Req[Incoming API Request] --> MW[Rate Limit Middleware]\n  MW --> |Eval Lua Script| Redis[(Redis Token Buckets)]\n  \n  Redis --> |Check IP Bucket| B1{Tokens > 0?}\n  Redis --> |Check User Bucket| B2{Tokens > 0?}\n  \n  B1 --> |Yes| B2\n  B1 --> |No| 429[HTTP 429 Too Many Requests]\n  B2 --> |No| 429\n  B2 --> |Yes| Decrement[Decrement Tokens]\n  Decrement --> 200[Pass Request to API]\n  \n  style Redis fill:#d4af37,color:#000,stroke:#000,stroke-width:2px\n  style 429 fill:#1a1a1a,stroke:#ff4444,stroke-width:2px,color:#ddd"
    },
    "ch13_resiliency.json": {
        "title": "Circuit Breaker Pattern",
        "description": "Failing fast to prevent cascading system collapse.",
        "mermaid_source": "stateDiagram-v2\n  [*] --> Closed: Service Healthy\n  Closed --> Open: Errors > Threshold (e.g. 50%)\n  Open --> HalfOpen: Timeout Elapsed (30s)\n  HalfOpen --> Closed: Success (Ping passes)\n  HalfOpen --> Open: Failure (Still broken)\n  \n  note left of Closed\n    Pass Requests Normally\n  end note\n  note right of Open\n    Fail Fast! (Return 503 Instantly)\n  end note\n  note right of HalfOpen\n    Let 1 request through to test\n  end note"
    },
    "ch14_algorithms.json": {
        "title": "Geospatial Quad-Trees",
        "description": "Splitting 2D geographic space into searchable quadrants.",
        "mermaid_source": "graph TD\n  Root[Global Map Node] --> NW[North-West Quadrant]\n  Root --> NE[North-East Quadrant]\n  Root --> SW[South-West Quadrant]\n  Root --> SE[South-East Quadrant]\n  \n  NE --> C{Cap Exceeded? (>100 cars)}\n  C --> |Yes| Split[Split into 4 deeper sub-quadrants]\n  Split --> NE_NW[NE->NW]\n  Split --> NE_NE[NE->NE]\n  \n  style Root fill:#d4af37,color:#000,stroke:#000,stroke-width:2px\n  style Split fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd"
    },
    "ch15_service_discovery.json": {
        "title": "Service Discovery & Registration",
        "description": "Consul/ZooKeeper dynamically updating routing tables.",
        "mermaid_source": "sequenceDiagram\n  participant S as Microservice Instance\n  participant SD as Service Registry (Consul)\n  participant G as API Gateway\n  \n  S->>SD: 1. Register (IP: 10.0.0.5, Port: 8080)\n  SD-->>S: OK + Health Check Init\n  G->>SD: 2. Watch for changes\n  S->>SD: 3. Ping (Heartbeat)\n  \n  note over S,SD: If Service Crashes, Heartbeats Stop\n  S-xSD: JVM Crash\n  SD->>G: 4. Unregister 10.0.0.5\n  G->>G: 5. Remove from LB Table"
    },
    "ch16_devops.json": {
        "title": "CI/CD Deployment Pipelines",
        "description": "Blue/Green and Canary Deployment architectures.",
        "mermaid_source": "graph LR\n  Git[Git Push] --> Build[CI Server: Build Docker]\n  Build --> Test[Run Unit/Int Tests]\n  Test --> Registry[Push to ECR/DockerHub]\n  \n  Registry --> Deploy{Deployment Strategy}\n  Deploy --> |Blue/Green| BG[Spin up V2 Cluster, Swap LB instantly]\n  Deploy --> |Canary| C[Route 5% Traffic to V2, Monitor Error Rates]\n  C --> |If Healthy| 100P[Scale up to 100%]\n  C --> |If Broken| Rollback[Scale down to 0%, Restore V1]\n  \n  style Deploy fill:#d4af37,color:#000,stroke:#000,stroke-width:2px\n  style C fill:#1a1a1a,stroke:#d4af37,stroke-width:2px,color:#ddd"
    },
    "ch17_disaster_recovery.json": {
        "title": "Disaster Recovery (RTO / RPO)",
        "description": "Active-Passive Data Center failover procedures.",
        "mermaid_source": "graph TD\n  Route53[DNS Level Routing] --> |99% Traffic| Primary[Active Region: US-East]\n  Route53 --> |1% Health Check Traffic| Secondary[Passive Region: US-West]\n  \n  subgraph Primary\n    App1[App Cluster] --> DB1[(Primary Database)]\n  end\n  subgraph Secondary\n    App2[Standby Cluster - Scaled Down] --> DB2[(Read Replica)]\n  end\n  \n  DB1 -.-> |Replication Delay: 5 seconds| DB2\n  \n  Primary -.-x |METEOR STRIKE| App1\n  Route53 --> |Failover Detected| Secondary\n  Secondary --> ScaleUp[Trigger Auto-Scaling]\n  DB2 --> Promote[Promote DB2 to Write-Master]\n  \n  style Primary stroke:#ff4444,stroke-width:3px\n  style Route53 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px"
    }
};

const dir = '/Users/211446/Grokking-System-Design/course-content/chapters/';

for (const [filename, diagramData] of Object.entries(premiumDiagrams)) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
        const fileData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        fileData.diagram = {
            "type": "mermaid",
            "title": diagramData.title,
            "description": diagramData.description,
            "data": {
                "mermaid_source": diagramData.mermaid_source
            }
        };
        fs.writeFileSync(fullPath, JSON.stringify(fileData, null, 4));
        console.log(`✅ Upgraded ${filename} with Ultra-Premium Mermaid syntax.`);
    }
}
