# 📁 プロジェクト管理

プロジェクト（最大1ヶ月の期間）を管理します。

## プロジェクトファイルの構造

各プロジェクトは個別のファイルとして作成します。

### ファイル名
`プロジェクト名.md`

### ファイル内容の構造

```markdown
# プロジェクト名

## 概要
プロジェクトの説明

## 期間
- 開始: YYYY-MM-DD
- 終了: YYYY-MM-DD（最大1ヶ月）

## 進捗
- [ ] 0%完了

## サブタスク（1階層まで）

### サブタスク1
- [ ] タスク1 #ジャンル ⏱️ 60 📅 YYYY-MM-DD
- [ ] タスク2 #ジャンル ⏱️ 60 📅 YYYY-MM-DD

### サブタスク2
- [ ] タスク3 #ジャンル ⏱️ 60 📅 YYYY-MM-DD
```

## プロジェクト一覧

```dataviewjs
// 新しいプロジェクト作成ボタン
const container = dv.container;
const buttonContainer = document.createElement('div');
buttonContainer.style.marginBottom = '15px';
buttonContainer.style.display = 'flex';
buttonContainer.style.gap = '10px';
buttonContainer.style.flexWrap = 'wrap';

const createButton = document.createElement('button');
createButton.textContent = '➕ 新しいプロジェクトを作成';
createButton.className = 'mod-cta';
createButton.style.padding = '10px 20px';
createButton.style.cursor = 'pointer';
createButton.style.fontSize = '16px';
createButton.style.touchAction = 'manipulation';
createButton.onclick = async () => {
  try {
    const commands = app.commands.commands;
    const commandId = Object.keys(commands).find(key => 
      key.includes('quickadd') && commands[key].name && commands[key].name.includes('プロジェクト作成')
    );
    
    if (commandId) {
      await app.commands.executeCommandById(commandId);
      // ビューを更新
      setTimeout(() => {
        app.commands.executeCommandById('dataview:refresh-views');
      }, 1000);
    } else {
      const command = Object.values(commands).find(cmd => cmd.name === 'QuickAdd: プロジェクト作成');
      if (command) {
        await app.commands.executeCommandById(command.id);
        setTimeout(() => {
          app.commands.executeCommandById('dataview:refresh-views');
        }, 1000);
      } else {
        new Notice('「プロジェクト作成」コマンドが見つかりません。QuickAddの設定を確認してください。');
      }
    }
  } catch (error) {
    new Notice('エラー: ' + error.message);
    console.error(error);
  }
};

buttonContainer.appendChild(createButton);
container.appendChild(buttonContainer);

// プロジェクト一覧を表示
const projectPath = "03.ツェッテルカステン/030.データベース/タスク管理/プロジェクト";
const projectFiles = dv.pages(`"${projectPath}"`)
  .where(p => p.file.name !== "README" && p.file.name !== "プロジェクトテンプレート")
  .sort(p => p.file.mtime, 'desc');

if (projectFiles.length === 0) {
  dv.paragraph("_プロジェクトはまだありません_");
} else {
  dv.paragraph(`**${projectFiles.length}件のプロジェクト**`);
  
  for (const project of projectFiles) {
    const projectName = project.file.name.replace('.md', '');
    const modifiedTime = moment(project.file.mtime);
    const modifiedTimeStr = modifiedTime.format("YYYY-MM-DD HH:mm");
    
    // プロジェクトファイルから期間を抽出
    let projectInfo = "";
    try {
      const content = await dv.io.load(project.file.path);
      if (content) {
        const startMatch = content.match(/開始:\s*(\d{4}-\d{2}-\d{2})/);
        const endMatch = content.match(/終了:\s*(\d{4}-\d{2}-\d{2})/);
        
        if (startMatch && endMatch) {
          const startDate = moment(startMatch[1]);
          const endDate = moment(endMatch[1]);
          const today = moment().startOf('day');
          
          let status = "";
          if (endDate.isBefore(today)) {
            status = " 🔴終了";
          } else if (startDate.isAfter(today)) {
            status = " 🔵予定";
          } else {
            status = " 🟢進行中";
          }
          
          projectInfo = ` (${startMatch[1]} 〜 ${endMatch[1]}${status})`;
        }
      }
    } catch (error) {
      console.error(`プロジェクト ${project.file.name} の読み込みエラー:`, error);
    }
    
    dv.paragraph(`- [[${project.file.path}|${projectName}]]${projectInfo} - 更新: ${modifiedTimeStr}`);
  }
}
```
