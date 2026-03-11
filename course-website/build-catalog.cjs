const fs = require('fs');
const path = require('path');

const chaptersDir = path.join(__dirname, '..', 'course-content', 'chapters');
const chapters = [];

if (fs.existsSync(chaptersDir)) {
    const files = fs.readdirSync(chaptersDir)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    files.forEach(file => {
        try {
            const content = JSON.parse(fs.readFileSync(path.join(chaptersDir, file), 'utf8'));
            chapters.push(content);
        } catch (err) {
            console.error(`Error parsing ${file}:`, err.message);
        }
    });
}

const catalog = { chapters };
const targetFile = path.join(__dirname, 'src', 'catalog.json');
fs.writeFileSync(targetFile, JSON.stringify(catalog, null, 2));
console.log(`✅ Built catalog with ${chapters.length} chapters.`);
