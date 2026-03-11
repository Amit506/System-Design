const fs = require("fs");

const ch10_data = [
    {
        "id": "ch10",
        "chapter": 11,
        "section": "Core Data Pipeline",
        "title": "Message Queues, Streams & Event-Driven Patterns (ULTRA DEEP-DIVE)",
        "tags": [
            "kafka",
            "rabbitmq",
            "sqs",
            "queues",
            "streams",
            "messaging"
        ],
        "summary": "The ultimate FAANG guide to asynchronous communication. Mastering the architectural tradeoffs between Log-Based Streams (Kafka) vs Smart-Broker Queues (RabbitMQ), including exactly-once semantics, partition scaling, and Dead Letter Queues.",
        "explanation": {
            "overview": "Synchronous HTTP REST calls fail at scale. If Service A calls Service B, and B is down, A fails. This tight coupling creates cascading failures. Message Queues introduce Event-Driven Architecture (EDA). By placing a Broker between producers and consumers, we achieve Temporal Decoupling (producer and consumer don't need to be alive at the same time), Load Leveling (absorbing 10,000 requests/sec and processing them at 500 requests/sec), and Fan-out (one event triggering 5 different microservices independently).",
            "how_it_works_internally": "INTERNAL Mechanics: Not all queues are built the same. RabbitMQ is a 'Smart Broker, Dumb Consumer' model using AMQP. It actively pushes messages to consumers and deletes them from RAM the millisecond they are acknowledged. Apache Kafka is a 'Dumb Broker, Smart Consumer' model. Kafka is literally just a distributed, append-only disk log. It doesn't push; consumers PULL data. Kafka never deletes messages upon read; it retains the commit log for a configurable time (e.g., 7 days). Consumers simply track a numeric pointer (an Offset) indicating where they are in the log. This enables profound capabilities like Event Replay and infinite horizontal partitions.",
            "step_by_step": [
                {
                    "step": 1,
                    "title": "Idempotent Production",
                    "detail": "Producer sends an event to the queue. If a network blip occurs and the ACK is lost, the producer retries. To prevent duplicate messages in the queue, advanced systems enable `enable.idempotence=true` (Kafka assigns sequence IDs to deduplicate retries)."
                },
                {
                    "step": 2,
                    "title": "Partition Routing",
                    "detail": "Kafka does not have a single 'queue'. A Topic is split into Partitions (e.g., 50 partitions). The Producer hashes the routing key (`User_ID: 123`) to guarantee that all events for User 123 ALWAYS land in Partition 4 in exact chronological order."
                },
                {
                    "step": 3,
                    "title": "Parallel Consumption",
                    "detail": "A Consumer Group with 50 worker instances connects to the Topic. The Broker automatically assigns exactly 1 partition to each worker. They pull and process events in parallel."
                },
                {
                    "step": 4,
                    "title": "Offset Commitment & DLQs",
                    "detail": "Worker successfully processes the data and commits its new Offset. If the worker encounters a corrupt JSON payload causing a persistent exception, it catches the error and moves the bad message to a Dead Letter Queue (DLQ) to prevent a total pipeline blockage (Poison Pill)."
                }
            ],
            "key_concepts": [
                {
                    "term": "Log-Based Event Streaming (Kafka)",
                    "definition": "INTERNAL: An immutable, distributed array stored continuously on disk. High throughput is achieved via OS Page Caches and Zero-Copy network transfers (`sendfile()` system calls). Disks are utilized sequentially, allowing normal HDDs to write at gigabits per second."
                },
                {
                    "term": "Exactly-Once Semantics (EOS)",
                    "definition": "The ability to guarantee that a message is processed precisely once, even if servers explode. Kafka natively achieves this using internal Transaction Coordinators, where reading an offset, calculating a state, and writing an output exist within an atomic commit phase."
                }
            ],
            "examples": [
                {
                    "title": "Python Implementation Snippet: Kafka Producer with Strong Acks",
                    "description": "Concrete Python snippet demonstrating how to configure a producer for zero data loss in financial systems.",
                    "code": "from confluent_kafka import Producer\n\n# FAANG Production Configs\nconf = {\n    'bootstrap.servers': 'kafka.internal:9092',\n    'acks': 'all',  # Wait for leader AND all In-Sync Replicas (ISR) to acknowledge\n    'enable.idempotence': True,  # Prevent duplicates on network retry storms\n    'compression.type': 'snappy', # Trade minimal CPU for massive Network I/O wins\n    'linger.ms': 5, # Wait 5ms before putting packet on network to encourage batching\n    'batch.size': 32768 # Max size of the batch\n}\n\nproducer = Producer(conf)\n\ndef delivery_callback(err, msg):\n    if err:\n        print(f'Loss of data detected: {err}')\n    else:\n        print(f'Event written to Partition {msg.partition()} at Offset {msg.offset()}')\n\n# The key guarantees ordering. All orders for User 123 stream sequentially.\nproducer.produce('financial-ledger', key='User_123', value='{\"cmd\":\"withdraw\"}', callback=delivery_callback)\nproducer.flush()"
                },
                {
                    "title": "Java Implementation Snippet: RabbitMQ Dead Letter Routing",
                    "description": "Configuring exchanges to handle 'Poison Pill' messages cleanly.",
                    "code": "@Bean\npublic Queue mainQueue() {\n    return QueueBuilder.durable(\"ecommerce.orders\")\n        .withArgument(\"x-dead-letter-exchange\", \"dlx.exchange\") // Route failures here\n        .withArgument(\"x-dead-letter-routing-key\", \"dlq.orders\")\n        // Drop message after 3 retries from DLX\n        .withArgument(\"x-message-ttl\", 60000) \n        .build();\n}\n\n@RabbitListener(queues = \"ecommerce.orders\")\npublic void processOrder(Message msg, Channel channel) throws IOException {\n    try {\n        process(msg);\n        channel.basicAck(msg.getMessageProperties().getDeliveryTag(), false);\n    } catch (FatalException e) {\n        // basicReject with requeue=false triggers the Dead Letter Exchange routing\n        channel.basicReject(msg.getMessageProperties().getDeliveryTag(), false);\n    }\n}"
                },
                {
                    "title": "Decision Matrix & Tradeoffs: The Big Three",
                    "description": "Evaluating Kafka vs RabbitMQ vs Amazon SQS.",
                    "code": "OPTION Apache Kafka vs OPTION RabbitMQ vs OPTION Amazon SQS\n-----------------------------------------------------------\nPros Kafka: Infinite scale (100M+ msg/sec). Perfect for Big Data, Event Sourcing, and Stream Analytics. Messages can be replayed from the past.\nCons Kafka: Astronomically difficult to configure and operate on bare metal. Overkill for simple tasks.\nPros RabbitMQ: Extremely flexible routing (Fanout, Topic matching, Headers). Built-in UI. Lightweight.\nCons RabbitMQ: If a queue gets too large (millions of unread messages), RAM fills up and the cluster forcefully throttles publishers, bringing down the system.\nPros SQS: Serverless. Literally zero maintenance. Infinite horizontal scale automatically.\nCons SQS: Extremely basic. No strict ordering unless using FIFO queues (which drastically cut maximum throughput to 3,000 msg/sec). High cost at scale."
                },
                {
                    "title": "Failure Modes & Exceptions: Consumer Group Lag",
                    "description": "Handling situations where producers outpace consumers.",
                    "code": "try-catch fallback mechanics:\nProblem: The 'Consumer Lag' metric explodes. A Kafka topic is receiving 10,000 msgs/sec, but consumers only process 1,000. Data is piling up. \nFaang Tweak: DO NOT manually commit offsets before processing a slow message just to 'clear the lag' (guarantees data loss on crash). INSTEAD, increase the Partition Count on the topic from 10 to 50, and boot 40 new Kubernetes Pods for the Consumer Group. Kafka scales exactly and only by Partition Count. If you have 10 partitions, you cannot have 11 consumers (the 11th will sit idle)."
                }
            ]
        },
        "configurable_params": [
            {
                "name": "Topic Retention Policy",
                "default": "log.retention.hours=168 (7 days)",
                "effect": "Modify parameter `log.retention.bytes=1000000000` (1 GB).",
                "tradeoff": "You can base retention on time OR size restrictions. Using time ensures downstream analytics pipelines have 7 full days to replay data if they crash. Enforcing a size limit protects the physical hard drives from 100% capacity crashes during unexpected viral bursts, but risks permanently deleting unread data."
            }
        ],
        "advanced_tweaks": [
            {
                "technique": "Log Compaction",
                "when_to_use": "Building an In-Memory State Cache from a Kafka Log.",
                "how": "Instead of Kafka deleting all messages after 7 days, configure `cleanup.policy=compact`. Kafka will continually scan the partition on disk in the background, keeping only the LATEST message for a given 'Key'. If the topic tracks 'User Addresses', Kafka deletes the historical move-ins and keeps only the current address. A new caching service can boot up, read the topic from offset 0, and perfectly reconstruct the current State of the World into RAM without downloading terabytes of dead historical updates."
            }
        ],
        "tradeoffs": {
            "pros": [
                "Decouples monolithic services",
                "Absorbs spiky unpredictable traffic",
                "Allows asynchronous retries"
            ],
            "cons": [
                "Drastically increases system complexity and observability requirements",
                "Introduces Eventual Consistency (Users might not see their own updates instantly)",
                "Message ordering pitfalls"
            ],
            "when_to_use": "Offloading heavy tasks (sending emails, video transcoding, PDF generation), Microservice Event Choreography, Financial Ledgers.",
            "when_to_avoid": "When the user UI absolutely strictly requires a synchronous response instantly (e.g., 'Is my password correct?')."
        },
        "common_mistakes": [
            "Unbalanced Partitions: Using a bad hashing key (e.g., Date) where 90% of traffic goes to Partition 1, melting Node A, while Nodes B and C sit at 0% CPU.",
            "Committing offsets asynchronously before actually writing the database update, leading to silent data loss.",
            "Neglecting the Dead Letter Queue: A poison JSON payload crashes the consumer, consumer reboots, pulls the exact same message, crashes again... freezing the entire partition forever."
        ],
        "interview_questions": [
            {
                "q": "How do you guarantee strict global ordering of messages across a system processing 100,000 req/sec?",
                "a": "You don't. Strict global ordering requires a single partition, completely eliminating concurrent scaling capability. Instead, you design for 'Partial Ordering' using Partition Keys. You only enforce order for a specific User ID or Document ID by hashing it so it predictably lands in the same isolated partition. Different users are processed out-of-order in parallel."
            },
            {
                "q": "In an e-commerce checkout, how do you prevent charging a user's credit card twice if the payment service times out?",
                "a": "Implement Idempotent Consumers. The queue payload must contain a globally unique UUID. The payment consumer first checks a fast Redis cache (or Postgres unique constraint): `SETNX uuid 1`. If it returns false, the message is a duplicate retry, so the consumer simply ACKs it and silently drops it."
            }
        ],
        "diagram": {
            "type": "mermaid",
            "title": "Advanced Kafka Scalability Architecture",
            "description": "Producers distributing to Partitions, and Consumer Groups parallelizing the workload.",
            "data": {
                "mermaid_source": "graph TD\n  ProdA[Producer App A] -->|Key: id_123| P1[Topic A - Partition 1 - Broker X]\n  ProdA -->|Key: id_999| P2[Topic A - Partition 2 - Broker Y]\n  ProdB[Producer App B] -->|Key: id_404| P3[Topic A - Partition 3 - Broker Z]\n  \n  P1 --> C1[Consumer JVM 1]\n  P2 --> C2[Consumer JVM 2]\n  P3 --> C3[Consumer JVM 3]\n  \n  C1 --> |Upsert| DB[(PostgreSQL)]\n  C2 --> |Upsert| DB\n  C3 --> |Upsert| DB\n  \n  subgraph \"Consumer Group A\"\n    C1; C2; C3\n  end\n  \n  P1 -.-> |Replay Data| OAP[Real-Time Analytics Flink System]\n  P2 -.-> OAP"
            }
        },
        "related_topics": [
            {
                "id": "ch11",
                "title": "Concurrency Control",
                "relationship": "Provides mechanisms for idempotent handlers"
            },
            {
                "id": "ch13",
                "title": "Resiliency",
                "relationship": "DLQs, Retry policies, and Circuit Breakers"
            }
        ],
        "references": [
            {
                "title": "Kafka's Log-centric Architecture",
                "url": "https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying"
            }
        ]
    }
];

ch10_data.forEach(cs => {
    fs.writeFileSync("/Users/211446/Grokking-System-Design/course-content/chapters/" + cs.id + "_message_queues.json", JSON.stringify(cs, null, 4));
});
console.log("Successfully generated deep dive ch10 json file.");
