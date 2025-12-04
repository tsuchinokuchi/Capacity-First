// QuickAdd User Script: プロジェクト作成
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  const path = require('path');
  const basePath = app.vault.adapter.basePath;
  const configPath = path.join(basePath, 'scripts', 'config.js');
  const Config = require(configPath);
  const { PATHS, FILES } = Config;

  const PROJECT_PATH = PATHS.PROJECT;
  const TEMPLATE_PATH = `${PATHS.PROJECT}/プロジェクトテンプレート.md`;

  try {
    // 1. プロジェクト名を入力
    const projectName = await quickAddApi.inputPrompt(
      "プロジェクト名を入力してください"
    );
    if (!projectName || !projectName.trim()) {
      new Notice("プロジェクト名が入力されていません");
      return;
    }

    // 2. 概要を入力（オプション）
    const description = await quickAddApi.inputPrompt(
      "プロジェクトの概要を入力してください（空白可）",
      ""
    );

    // Helper to parse date flexibly
    const parseDate = (input) => {
      if (!input) return null;
      let s = input.trim();
      // Normalize: Full-width to half-width
      s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      // Normalize: Separators to hyphen
      s = s.replace(/[－／．]/g, '-').replace(/[./]/g, '-');

      // Handle MM-DD (e.g., 12-31, 1-1) -> Prepend Current Year
      if (/^\d{1,2}-\d{1,2}$/.test(s)) {
        s = `${moment().year()}-${s}`;
      }

      // Parse with Moment (allow loose parsing for YYYY-M-D etc)
      const d = moment(s, ["YYYY-MM-DD", "YYYY-M-D"], false);
      return d.isValid() ? d : null;
    };

    // 3. 開始日を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const startDateInput = await quickAddApi.inputPrompt(
      "開始日を入力してください (YYYY-MM-DD または MM-DD) - 空白の場合は今日",
      today
    );

    let startDate = today;
    if (startDateInput && startDateInput.trim()) {
      const dateObj = parseDate(startDateInput);
      if (!dateObj || !dateObj.isValid()) {
        new Notice(`無効な開始日形式です: ${startDateInput}\nYYYY-MM-DD形式で入力してください`);
        return;
      }
      startDate = dateObj.format("YYYY-MM-DD");
    }
    const startMoment = moment(startDate, "YYYY-MM-DD");

    // 4. 終了日を入力（デフォルト: 開始日から1ヶ月後）
    const defaultEndDate = moment(startMoment).add(1, 'month').format("YYYY-MM-DD");
    const endDateInput = await quickAddApi.inputPrompt(
      "終了日を入力してください (YYYY-MM-DD または MM-DD) - 空白の場合は開始日から1ヶ月後",
      defaultEndDate
    );

    let endDate = defaultEndDate;
    if (endDateInput && endDateInput.trim()) {
      const dateObj = parseDate(endDateInput);
      if (!dateObj || !dateObj.isValid()) {
        new Notice(`無効な終了日形式です: ${endDateInput}\nYYYY-MM-DD形式で入力してください`);
        return;
      }
      endDate = dateObj.format("YYYY-MM-DD");
    }
    const endMoment = moment(endDate, "YYYY-MM-DD");

    // 終了日が開始日より後かチェック
    if (endMoment.isBefore(startMoment)) {
      new Notice("終了日は開始日より後である必要があります");
      return;
    }

    // 5. ファイル名を作成（既存チェック）
    const fileName = `${projectName}.md`;
    const filePath = `${PROJECT_PATH}/${fileName}`;
    const existingFile = app.vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      const shouldOverwrite = await quickAddApi.yesNoPrompt(
        `「${projectName}」という名前のプロジェクトが既に存在します。\n上書きしますか？`
      );
      if (!shouldOverwrite) {
        new Notice("プロジェクトの作成をキャンセルしました");
        return;
      }
    }

    // 6. テンプレートを読み込む
    let templateContent = "";
    try {
      const templateFile = app.vault.getAbstractFileByPath(TEMPLATE_PATH);
      if (templateFile) {
        templateContent = await app.vault.read(templateFile);
      }
    } catch (error) {
      console.warn("テンプレートの読み込みに失敗しました。デフォルトテンプレートを使用します。", error);
    }

    // 7. テンプレートが読み込めなかった場合はデフォルトを使用
    if (!templateContent || templateContent.trim() === "") {
      templateContent = `# プロジェクト名

## 概要
プロジェクトの説明を記入してください。

## 期間
- 開始: YYYY-MM-DD
- 終了: YYYY-MM-DD（最大1ヶ月）

## 進捗
- [ ] 0%完了

## サブタスク（1階層まで）

\`\`\`dataviewjs
// --- Styles ---
const container = dv.container;
container.innerHTML = "";
const style = document.createElement('style');
style.textContent = \`
    .project-btn-container {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    .project-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        opacity: 0.9;
    }
    .project-btn:hover {
        opacity: 1;
    }
    .project-btn.purple {
        background-color: #8e44ad; /* Purple */
    }
    .project-btn.blue {
        background-color: #2980b9; /* Blue */
    }
    .project-btn.dark {
        background-color: #34495e; /* Dark Grey */
    }
\`;
container.appendChild(style);

const btnContainer = container.createDiv({ cls: "project-btn-container" });

// --- Helper: QuickAdd API ---
const getQuickAdd = () => {
    const plugin = app.plugins.plugins.quickadd;
    if (!plugin || !plugin.api) {
        new Notice('❌ QuickAddプラグインが見つかりません');
        return null;
    }
    return plugin.api;
};

// --- Button 1: Create This Month's Version (Purple) ---
const createVersionBtn = btnContainer.createEl("button", { cls: "project-btn purple", text: "📅 今月バージョンを作成" });
createVersionBtn.onclick = async () => {
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    const currentName = activeFile.basename;
    // Remove existing date suffix if present (e.g., _2025-11)
    const baseName = currentName.replace(/_\\d{4}-\\d{2}$/, "");
    const newName = \`\${baseName}_\${moment().format("YYYY-MM")}\`;
    const newPath = \`\${activeFile.parent.path}/\${newName}.md\`;

    if (app.vault.getAbstractFileByPath(newPath)) {
        new Notice(\`❌ ファイルが既に存在します: \${newName}\`);
        return;
    }

    const content = await app.vault.read(activeFile);
    // 1. Uncheck all tasks
    let newContent = content.replace(/- \\[x\\]/g, "- [ ]");
    // 2. Remove dates (📅 YYYY-MM-DD and ⏰ YYYY-MM-DD)
    newContent = newContent.replace(/ 📅 \\d{4}-\\d{2}-\\d{2}/g, "");
    newContent = newContent.replace(/ ⏰ \\d{4}-\\d{2}-\\d{2}/g, "");
    // 3. Update Title (optional, if H1 matches filename)
    newContent = newContent.replace(new RegExp(\`# \${currentName}\`), \`# \${newName}\`);

    await app.vault.create(newPath, newContent);
    new Notice(\`✅ 作成完了: \${newName}\`);
    await app.workspace.openLinkText(newPath, "", true);
};

// --- Button 2: Add Subtask (Blue) ---
const addSubtaskBtn = btnContainer.createEl("button", { cls: "project-btn blue", text: "➕ サブタスク追加" });
addSubtaskBtn.onclick = async () => {
    const api = getQuickAdd();
    if (!api) return;

    // Reuse existing logic via command or inline
    // Using the logic from previous template but simplified/inline here for reliability
    
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    // 1. Task Name
    const taskName = await api.inputPrompt("タスク名を入力してください");
    if (!taskName) return;

    // 2. Genre (Load from file if possible, else default)
    const genres = ["デスクワーク", "売場作業", "顧客対応", "定型作業", "学習", "健康", "趣味", "その他プライベート"];
    const selectedGenre = await api.suggester(genres, genres, "カテゴリ（ジャンル）を選択");
    if (!selectedGenre) return;

    // 3. Duration
    const duration = await api.inputPrompt("所要時間（分）", "60");
    if (!duration) return;

    // 4. Date
    const today = moment().format("YYYY-MM-DD");
    const dateInput = await api.inputPrompt("実施日 (YYYY-MM-DD or MM-DD)", today);
    if (!dateInput) return;
    
    const dateObj = moment(dateInput.trim(), ["YYYY-MM-DD", "MM-DD"], true);
    if (!dateObj.isValid()) { new Notice("無効な日付"); return; }
    const dateStr = dateObj.format("YYYY-MM-DD");

    // 5. Category
    const content = await app.vault.read(activeFile);
    const subtaskMatches = Array.from(content.matchAll(/^### (.+)$/gm)).map(m => m[1]).filter(s => !['概要','期間','進捗','サブタスク（1階層まで）','メモ'].includes(s));
    
    let category = "新規カテゴリ";
    if (subtaskMatches.length > 0) {
        category = await api.suggester([...subtaskMatches, "新規カテゴリ"], [...subtaskMatches, "新規カテゴリ"], "サブタスクカテゴリを選択");
    }
    if (!category) return;
    if (category === "新規カテゴリ") {
        category = await api.inputPrompt("新規カテゴリ名");
        if (!category) return;
    }

    // 6. Create Task Line
    const taskLine = \`- [ ] \${taskName} #\${selectedGenre} ⏱️ \${duration} 📅 \${dateStr} 🔗 \${activeFile.basename}\`;

    // 7. Insert into file
    // Simplified insertion logic: append to category or create category
    let newContent = content;
    const catHeader = \`### \${category}\`;
    if (newContent.includes(catHeader)) {
        // Append to end of category (rough heuristic: before next header or end of file)
        const parts = newContent.split(catHeader);
        const after = parts[1];
        const nextHeaderIdx = after.search(/\\n###? /);
        if (nextHeaderIdx === -1) {
            newContent = parts[0] + catHeader + after + "\\n" + taskLine;
        } else {
            newContent = parts[0] + catHeader + after.substring(0, nextHeaderIdx) + "\\n" + taskLine + after.substring(nextHeaderIdx);
        }
    } else {
        // Create category at end of subtask section
        const sectionHeader = "## サブタスク（1階層まで）";
        if (newContent.includes(sectionHeader)) {
             newContent = newContent.replace(sectionHeader, \`\${sectionHeader}\\n\\n\${catHeader}\\n\${taskLine}\`);
        } else {
             newContent += \`\\n\\n\${catHeader}\\n\${taskLine}\`;
        }
    }
    await app.vault.modify(activeFile, newContent);

    // 8. Add to Schedule
    const schedulePath = \`03.ツェッテルカステン/030.データベース/タスク管理/スケジュール/\${dateStr}.md\`;
    let scheduleFile = app.vault.getAbstractFileByPath(schedulePath);
    if (!scheduleFile) scheduleFile = await app.vault.create(schedulePath, "## 今日のスケジュール\\n\\n");
    
    const scheduleContent = await app.vault.read(scheduleFile);
    if (!scheduleContent.includes(taskLine)) {
        await app.vault.modify(scheduleFile, scheduleContent + "\\n" + taskLine);
    }
    new Notice("✅ タスクを追加しました");
    // Refresh
    setTimeout(() => app.commands.executeCommandById('dataview:refresh-views'), 500);
};

// --- Button 3: Set Date (Dark) ---
const setDateBtn = btnContainer.createEl("button", { cls: "project-btn dark", text: "📅 日付を設定" });
setDateBtn.onclick = async () => {
    const api = getQuickAdd();
    if (!api) return;
    
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) return;

    const content = await app.vault.read(activeFile);
    const lines = content.split("\\n");
    const taskLines = lines.map((line, idx) => ({ line, idx })).filter(item => item.line.trim().match(/^- \[[ x]\]/));

    if (taskLines.length === 0) {
        new Notice("タスクが見つかりません");
        return;
    }

    // Select Tasks
    const selectedTasks = await api.checkboxPrompt(
        "日付を設定するタスクを選択してください",
        taskLines.map(t => t.line.replace(/^- \[[ x]\] /, "")), // Display text
        taskLines.map(t => t.line) // Value (full line)
    );

    if (!selectedTasks || selectedTasks.length === 0) return;

    // Input Date
    const today = moment().format("YYYY-MM-DD");
    const dateInput = await api.inputPrompt("設定する日付 (YYYY-MM-DD or MM-DD)", today);
    if (!dateInput) return;

    const dateObj = moment(dateInput.trim(), ["YYYY-MM-DD", "MM-DD"], true);
    if (!dateObj.isValid()) { new Notice("無効な日付"); return; }
    const dateStr = dateObj.format("YYYY-MM-DD");

    // Update File
    let newContent = content;
    const scheduleUpdates = [];

    // Map selected values back to indices (simple string match might be risky if duplicates, but acceptable for now)
    // Better: match by index if checkboxPrompt returns indices? No, it returns values.
    // We will iterate and match.
    
    for (const selectedLine of selectedTasks) {
        // Find the line in the ORIGINAL content (to avoid shifting issues, though we replace string)
        // Regex to find the line and replace/add date
        // Logic: Replace existing 📅 ... or Append 📅 ...
        
        let newLine = selectedLine;
        if (newLine.match(/📅 \\d{4}-\\d{2}-\\d{2}/)) {
            newLine = newLine.replace(/📅 \\d{4}-\\d{2}-\\d{2}/, \`📅 \${dateStr}\`);
        } else {
            newLine = \`\${newLine} 📅 \${dateStr}\`;
        }
        
        newContent = newContent.replace(selectedLine, newLine);
        
        // Prepare for schedule update
        // Ensure link is present
        if (!newLine.includes(\`🔗 \${activeFile.basename}\`)) {
            newLine += \` 🔗 \${activeFile.basename}\`;
        }
        scheduleUpdates.push(newLine);
    }

    await app.vault.modify(activeFile, newContent);

    // Update Schedule File
    const schedulePath = \`03.ツェッテルカステン/030.データベース/タスク管理/スケジュール/\${dateStr}.md\`;
    let scheduleFile = app.vault.getAbstractFileByPath(schedulePath);
    if (!scheduleFile) scheduleFile = await app.vault.create(schedulePath, "## 今日のスケジュール\\n\\n");
    
    let scheduleContent = await app.vault.read(scheduleFile);
    let addedCount = 0;
    for (const taskLine of scheduleUpdates) {
        // Avoid duplicates (simple check)
        // Check if a task with same name exists? Or exact line?
        // Let's check if the task name part exists to avoid dupes if other metadata differs slightly
        // For simplicity, check exact line first, then loose check
        if (!scheduleContent.includes(taskLine)) {
            scheduleContent += "\\n" + taskLine;
            addedCount++;
        }
    }
    
    if (addedCount > 0) {
        await app.vault.modify(scheduleFile, scheduleContent);
    }

    new Notice(\`✅ \${selectedTasks.length}件のタスクの日付を \${dateStr} に設定しました\`);
    setTimeout(() => app.commands.executeCommandById('dataview:refresh-views'), 500);
};
\`\`\`

### サブタスク1
- [ ] タスク1 #ジャンル ⏱️ 60 📅 YYYY-MM-DD
- [ ] タスク2 #ジャンル ⏱️ 60 📅 YYYY-MM-DD

### サブタスク2
- [ ] タスク3 #ジャンル ⏱️ 60 📅 YYYY-MM-DD

## メモ
<!-- プロジェクトに関するメモや注意事項を記入 -->
`;
    }

    // 8. テンプレートを置換
    let projectContent = templateContent
      .replace(/# プロジェクト名/g, `# ${projectName}`)
      .replace(/プロジェクトの説明を記入してください。/g, description.trim() || "プロジェクトの説明を記入してください。")
      .replace(/開始: YYYY-MM-DD/g, `開始: ${startDate}`)
      .replace(/終了: YYYY-MM-DD/g, `終了: ${endDate}`);

    // 8. ファイルを作成または更新
    if (existingFile) {
      await app.vault.modify(existingFile, projectContent);
      new Notice(`✅ プロジェクト「${projectName}」を更新しました`, 3000);
    } else {
      const newFile = await app.vault.create(filePath, projectContent);
      new Notice(`✅ プロジェクト「${projectName}」を作成しました`, 3000);

      // 新しく作成したファイルを開く
      await app.workspace.openLinkText(filePath, "", true);
    }

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

