const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.resolve(__dirname, '../スケジュール');

const OLD_BLOCK = `\`\`\`button
name 次の日に移動
type command
action QuickAdd: タスク移動
\`\`\``;

const NEW_BLOCK = `\`\`\`button
name 日付変更
type command
action QuickAdd: タスク移動
\`\`\`

\`\`\`button
name タスク削除
type command
action QuickAdd: タスク削除
\`\`\``;

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walk(filepath, callback);
        } else if (stats.isFile() && file.endsWith('.md')) {
            callback(filepath);
        }
    });
}

console.log(`Scanning directory: ${TARGET_DIR}`);
let updatedCount = 0;
let errorCount = 0;

try {
    if (!fs.existsSync(TARGET_DIR)) {
        console.error(`Target directory not found: ${TARGET_DIR}`);
        process.exit(1);
    }

    walk(TARGET_DIR, (filepath) => {
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            // Normalize line endings for reliable matching if needed, but usually exact match works best 
            // if we are careful. Let's try simple replacement first.

            if (content.includes(OLD_BLOCK)) {
                const newContent = content.replace(OLD_BLOCK, NEW_BLOCK);
                fs.writeFileSync(filepath, newContent, 'utf8');
                console.log(`Updated: ${filepath}`);
                updatedCount++;
            }
        } catch (err) {
            console.error(`Error processing ${filepath}: ${err.message}`);
            errorCount++;
        }
    });

    console.log(`\nComplete.`);
    console.log(`Updated: ${updatedCount} files.`);
    console.log(`Errors: ${errorCount} files.`);

} catch (err) {
    console.error(`Fatal error: ${err.message}`);
}
