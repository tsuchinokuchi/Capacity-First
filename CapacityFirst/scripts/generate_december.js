const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../スケジュール/2025/12');
const templateContent = `## 今日のスケジュール

\`\`\`button
name 次の日に移動
type command
action QuickAdd: タスク移動
\`\`\`

\`\`\`button
name 容量チェック
type command
action QuickAdd: 容量チェック
\`\`\`

---

`;

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

for (let i = 1; i <= 31; i++) {
    const day = i.toString().padStart(2, '0');
    const fileName = `2025-12-${day}.md`;
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, templateContent, 'utf8');
    console.log(`Created: ${fileName}`);
}
