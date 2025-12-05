const type = input?.type || "buttons";

if (type === "progress") {
    const page = dv.current();
    const file = app.vault.getAbstractFileByPath(page.file.path);
    if (file) {
        const content = await app.vault.read(file);
        const lines = content.split("\n");
        const tasks = lines.filter(line => line.trim().match(/^- \[[ x]\]/));
        const total = tasks.length;
        const completed = tasks.filter(line => line.trim().match(/^- \[x\]/)).length;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        dv.paragraph(`**${progress}% 完了** (${completed}/${total})`);
        dv.el("progress", "", { attr: { value: progress, max: 100 } });
    }
}

if (type === "buttons") {
    // --- Styles ---
    const container = dv.container;
    // Clear container only if we are re-rendering, but here we append. 
    // Actually dataviewjs clears the container by default for the block.
    // But since we are in a view, we should be careful.
    // For buttons, we want to create a container.

    const style = document.createElement('style');
    style.textContent = `
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
    `;
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
        const baseName = currentName.replace(/_\d{4}-\d{2}$/, "");
        const newName = `${baseName}_${moment().format("YYYY-MM")}`;
        const newPath = `${activeFile.parent.path}/${newName}.md`;

        if (app.vault.getAbstractFileByPath(newPath)) {
            new Notice(`❌ ファイルが既に存在します: ${newName}`);
            return;
        }

        const content = await app.vault.read(activeFile);
        // 1. Uncheck all tasks
        let newContent = content.replace(/- \[x\]/g, "- [ ]");
        // 2. Remove dates (📅 YYYY-MM-DD and ⏰ YYYY-MM-DD)
        newContent = newContent.replace(/ 📅 \d{4}-\d{2}-\d{2}/g, "");
        newContent = newContent.replace(/ ⏰ \d{4}-\d{2}-\d{2}/g, "");
        // 3. Update Title (optional, if H1 matches filename)
        newContent = newContent.replace(new RegExp(`# ${currentName}`), `# ${newName}`);

        await app.vault.create(newPath, newContent);
        new Notice(`✅ 作成完了: ${newName}`);
        await app.workspace.openLinkText(newPath, "", true);
    };

    // --- Button 2: Add Subtask (Blue) ---
    const addSubtaskBtn = btnContainer.createEl("button", { cls: "project-btn blue", text: "➕ サブタスク追加" });
    addSubtaskBtn.onclick = async () => {
        const api = getQuickAdd();
        if (!api) return;

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
        const subtaskMatches = Array.from(content.matchAll(/^### (.+)$/gm)).map(m => m[1]).filter(s => !['概要', '期間', '進捗', 'サブタスク（1階層まで）', 'メモ'].includes(s));

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
        const taskLine = `- [ ] ${taskName} #${selectedGenre} ⏱️ ${duration} 📅 ${dateStr} 🔗 ${activeFile.basename}`;

        // 7. Insert into file
        let newContent = content;
        const catHeader = `### ${category}`;
        if (newContent.includes(catHeader)) {
            const parts = newContent.split(catHeader);
            const after = parts[1];
            const nextHeaderIdx = after.search(/\n###? /);
            if (nextHeaderIdx === -1) {
                newContent = parts[0] + catHeader + after + "\n" + taskLine;
            } else {
                newContent = parts[0] + catHeader + after.substring(0, nextHeaderIdx) + "\n" + taskLine + after.substring(nextHeaderIdx);
            }
        } else {
            const sectionHeader = "## サブタスク（1階層まで）";
            const sectionIdx = newContent.indexOf(sectionHeader);
            if (sectionIdx !== -1) {
                const nextHeaderIdx = newContent.indexOf("\n## ", sectionIdx + sectionHeader.length);
                if (nextHeaderIdx !== -1) {
                    newContent = newContent.substring(0, nextHeaderIdx) + `\n\n${catHeader}\n${taskLine}` + newContent.substring(nextHeaderIdx);
                } else {
                    newContent += `\n\n${catHeader}\n${taskLine}`;
                }
            } else {
                newContent += `\n\n${catHeader}\n${taskLine}`;
            }
        }
        await app.vault.modify(activeFile, newContent);

        // 8. Add to Schedule
        const schedulePath = `スケジュール/${dateStr}.md`;
        let scheduleFile = app.vault.getAbstractFileByPath(schedulePath);
        if (!scheduleFile) scheduleFile = await app.vault.create(schedulePath, "## 今日のスケジュール\n\n");

        const scheduleContent = await app.vault.read(scheduleFile);
        if (!scheduleContent.includes(taskLine)) {
            await app.vault.modify(scheduleFile, scheduleContent + "\n" + taskLine);
        }
        new Notice("✅ タスクを追加しました");
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
        const lines = content.split("\n");
        const taskLines = lines.map((line, idx) => ({ line, idx })).filter(item => item.line.trim().match(/^- \[[ x]\]/));

        if (taskLines.length === 0) {
            new Notice("タスクが見つかりません");
            return;
        }

        // Select Tasks
        // Using simple signature: checkboxPrompt(items)
        const selectedLines = await api.checkboxPrompt(
            taskLines.map(t => t.line)
        );

        if (!selectedLines) {
            new Notice("選択がキャンセルされました");
            return;
        }
        if (selectedLines.length === 0) {
            new Notice("タスクが選択されていません");
            return;
        }

        const selectedTasks = selectedLines;

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
        const tasksToRemove = []; // { date: "YYYY-MM-DD", line: "full line" }

        for (const selectedLine of selectedTasks) {
            let newLine = selectedLine;

            // Check for existing date to remove from old schedule
            const dateMatch = newLine.match(/📅 (\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const oldDate = dateMatch[1];
                if (oldDate !== dateStr) {
                    // Ensure link is present for removal matching
                    let lineToRemove = selectedLine;
                    if (!lineToRemove.includes(`🔗 ${activeFile.basename}`)) {
                        lineToRemove += ` 🔗 ${activeFile.basename}`;
                    }
                    tasksToRemove.push({ date: oldDate, line: lineToRemove });
                }
            }

            // Update date in line
            if (newLine.match(/📅 \d{4}-\d{2}-\d{2}/)) {
                newLine = newLine.replace(/📅 \d{4}-\d{2}-\d{2}/, `📅 ${dateStr}`);
            } else {
                newLine = `${newLine} 📅 ${dateStr}`;
            }

            newContent = newContent.replace(selectedLine, newLine);

            // Prepare for schedule update
            if (!newLine.includes(`🔗 ${activeFile.basename}`)) {
                newLine += ` 🔗 ${activeFile.basename}`;
            }
            scheduleUpdates.push(newLine);
        }

        await app.vault.modify(activeFile, newContent);

        // Remove from old schedules
        for (const item of tasksToRemove) {
            const oldSchedulePath = `スケジュール/${item.date}.md`;
            const oldFile = app.vault.getAbstractFileByPath(oldSchedulePath);
            if (oldFile) {
                const oldContent = await app.vault.read(oldFile);
                if (oldContent.includes(item.line)) {
                    const newOldContent = oldContent.replace(item.line, "").replace(/\n\n\n/g, "\n\n"); // Simple cleanup
                    await app.vault.modify(oldFile, newOldContent);
                }
            }
        }

        // Update Schedule File
        const schedulePath = `スケジュール/${dateStr}.md`;
        let scheduleFile = app.vault.getAbstractFileByPath(schedulePath);
        if (!scheduleFile) scheduleFile = await app.vault.create(schedulePath, "## 今日のスケジュール\n\n");

        let scheduleContent = await app.vault.read(scheduleFile);
        let addedCount = 0;
        for (const taskLine of scheduleUpdates) {
            if (!scheduleContent.includes(taskLine)) {
                scheduleContent += "\n" + taskLine;
                addedCount++;
            }
        }

        if (addedCount > 0) {
            await app.vault.modify(scheduleFile, scheduleContent);
        }

        new Notice(`✅ ${selectedTasks.length}件のタスクの日付を ${dateStr} に設定しました`);
        setTimeout(() => app.commands.executeCommandById('dataview:refresh-views'), 500);
    };
}
