const fs = require('fs');

if (fs.existsSync('/Users/211446/Grokking-System-Design/course-content/chapters/ch10_messaging.json')) {
    fs.unlinkSync('/Users/211446/Grokking-System-Design/course-content/chapters/ch10_messaging.json');
    console.log('Removed deprecated ch10_messaging.json.');
}

const ch07path = '/Users/211446/Grokking-System-Design/course-content/chapters/ch07_caching.json';
if (fs.existsSync(ch07path)) {
    const ch07data = JSON.parse(fs.readFileSync(ch07path, 'utf8'));

    ch07data.diagram = {
        "type": "mermaid",
        "title": "Distributed Caching Strategies",
        "description": "Visualizing Cache-Aside, Write-Through, and Read-Through patterns with Redis clusters.",
        "data": {
            "mermaid_source": "graph TD\n  Client --> API[API Gateway]\n  API --> Read[Read Request]\n  API --> Write[Write Request]\n  \n  Read --> Cache{Is in Cache?}\n  Cache -->|Cache Hit| API\n  Cache -->|Cache Miss| DB[(Primary Database)]\n  DB -.->|Populate Cache| Cache\n  \n  Write --> CacheWrite[Write to Cache]\n  CacheWrite --> DBWrite[Write to DB]\n  \n  style Cache fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  style DB fill:#1a1a1a,stroke:#444,stroke-width:1px,color:#ddd;"
        }
    };

    fs.writeFileSync(ch07path, JSON.stringify(ch07data, null, 4));
    console.log('Successfully updated ch07_caching.json to use premium Mermaid diagram.');
}
