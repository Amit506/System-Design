const fs = require('fs');
const path = require('path');

const catalog = {
    fundamentals: [],
    architectures: []
};

// Process files and preserve exact order by alphanumeric sorting
function readDir(dirPath, category) {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);

    // Sort numerically so "01_" comes before "10_"
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    files.forEach(file => {
        if (file.endsWith('.md')) {
            const content = fs.readFileSync(path.join(dirPath, file), 'utf8');

            // Extract title from filename (e.g., "01_fundamentals.md" -> "Fundamentals")
            // Remove leading numbers and underscores
            let title = file.replace('.md', '');
            const parts = title.split('_');
            if (!isNaN(parts[0])) {
                parts.shift();
            }
            title = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

            catalog[category].push({
                id: file.replace('.md', ''),
                title: title || file.replace('.md', ''),
                content: content
            });
        }
    });
}

readDir(path.join(__dirname, '../Premium-Edition/01_Fundamentals'), 'fundamentals');
readDir(path.join(__dirname, '../Premium-Edition/02_Architectures'), 'architectures');

const targetFile = path.join(__dirname, 'src', 'catalog.json');
fs.writeFileSync(targetFile, JSON.stringify(catalog, null, 2));
console.log(`Successfully built catalog with ${catalog.fundamentals.length} fundamentals and ${catalog.architectures.length} architectures.`);
