const fs = require('fs');
const path = '/Users/211446/Grokking-System-Design/course-content/chapters/ch00_introduction.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.diagram = {
    "type": "mermaid",
    "title": "System Design Interview Flow Overview",
    "description": "Visualizing the 6-step framework for tackling any ambiguous system design interview problem.",
    "data": {
        "mermaid_source": "graph TD\n  S1[1. Understand the Problem & Scope] --> S2[2. Define the API & Data Model]\n  S2 --> S3[3. High Level Design Architecture]\n  S3 --> S4[4. Component Deep Dive]\n  S4 --> S5[5. Identify Bottlenecks & Scale]\n  S5 --> S6[6. Wrap Up & Tradeoffs]\n  \n  S4 -.->|Refine APIs| S2\n  S5 -.->|Add Caching/Sharding| S3\n  \n  style S1 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  style S3 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  style S5 fill:#d4af37,color:#000,stroke:#d4af37,stroke-width:2px\n  \n  classDef default fill:#1a1a1a,stroke:#444,stroke-width:1px,color:#ddd;"
    }
};

fs.writeFileSync(path, JSON.stringify(data, null, 4));
console.log('✅ Successfully updated ch00_introduction.json to use premium Mermaid diagram.');
