/**
 * Task Actions Utility
 * Centralizes logic for task manipulation (Move, Complete, Delete) and Project Syncing.
 */

const TaskActions = {

    /**
     * Prompts user for a date using QuickAdd if available, otherwise window.prompt.
     * @param {string} defaultDate - YYYY-MM-DD
     * @returns {Promise<string|null>} YYYY-MM-DD or null if cancelled/invalid
     */
    async promptForDate(defaultDate) {
        let input = "";
        // Access global app variable
        const quickAddApi = app.plugins.plugins.quickadd?.api;

        if (quickAddApi) {
            try {
                input = await quickAddApi.inputPrompt(
                    "移動先の日付を入力してください (YYYY-MM-DD または MM-DD)",
                    `空欄の場合は ${defaultDate} に移動します`,
                    ""
                );
            } catch (e) {
                new Notice(`Debug: QuickAdd Prompt Error: ${e.message}`);
                console.error(e);
                return null;
            }
        } else {
            input = prompt("移動先の日付を入力してください (YYYY-MM-DD または MM-DD)\n空欄の場合は翌日に移動します", defaultDate);
        }

        if (input === undefined || input === null) return null;

        const inputStr = input.trim() === "" ? defaultDate : input.trim();
        const dateObj = this.parseDate(inputStr);

        if (!dateObj || !dateObj.isValid()) {
            new Notice(`無効な日付形式です: ${inputStr}`);
            return null;
        }
        return dateObj.format("YYYY-MM-DD");
    },

    /**
     * Parses date string flexibly (YYYY-MM-DD, MM-DD, MM/DD -> YYYY-MM-DD).
     */
    parseDate(input) {
        if (!input) return null;
        let s = input.trim();
        // Normalize
        s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        s = s.replace(/[－．]/g, '-').replace(/[.]/g, '-');

        // Standard formats
        let sc = moment(s, ["YYYY-MM-DD", "YYYY/MM/DD", "YYYY-M-D", "YYYY/M/D"], true);
        if (sc.isValid()) return sc;

        // MM-DD etc (Append current year)
        if (/^\d{1,2}[-\/]\d{1,2}$/.test(s)) {
            let d = moment(s, ["MM-DD", "M-D", "MM/DD", "M/D"], true);
            if (d.isValid()) {
                d.year(moment().year());
                return d;
            }
        }
        // Fallback MM-DD
        if (/^\d{1,2}-\d{1,2}$/.test(s.replace(/\//g, '-'))) {
            let d = moment(`${moment().year()}-${s.replace(/\//g, '-')}`, "YYYY-MM-DD", false);
            if (d.isValid()) return d;
        }
        return null;
    },

    /**
     * Executes task actions: complete, delete, move_date, move_to_pool.
     * @param {Array} tasks - Array of task objects {path, line, text, completed}
     * @param {string} action - "complete", "delete", "move_date", "move_to_pool"
     * @param {Object} options - { targetDate: "YYYY-MM-DD", poolPath: "...", schedulePath: "..." }
     */
    async executeAction(tasks, action, options = {}) {
        // Group by file
        const tasksByFile = new Map();
        tasks.forEach(task => {
            if (!tasksByFile.has(task.path)) tasksByFile.set(task.path, []);
            tasksByFile.get(task.path).push(task);
        });

        const movedTaskTexts = [];
        let processedCount = 0;

        for (const [filePath, fileTasks] of tasksByFile) {
            const file = app.vault.getAbstractFileByPath(filePath);
            if (!file) continue;

            const content = await app.vault.read(file);
            let lines = content.split("\n");
            let modified = false;
            const linesToModify = new Map();

            for (const task of fileTasks) {
                const lineNum = task.line;
                const lineContent = lines[lineNum];

                // Sync to Project (Always try to sync if linked)
                if (action === "complete" && !task.completed) {
                    await this.syncProjectTask(task.text, "update_status", { completed: true });
                } else if (action === "delete") {
                    await this.syncProjectTask(task.text, "delete");
                } else if (action === "move_date") {
                    await this.syncProjectTask(task.text, "move_date", { newDate: options.targetDate });
                }

                // File modifications
                if (action === "complete") {
                    if (!task.completed) {
                        linesToModify.set(lineNum, lineContent.replace(/- \[ \]/, "- [x]"));
                    }
                } else if (action === "delete" || action === "move_date" || action === "move_to_pool") {
                    linesToModify.set(lineNum, null); // Remove
                    if (action === "move_date" || action === "move_to_pool") {
                        movedTaskTexts.push(task.text);
                    }
                }
                processedCount++;
            }

            // Apply line changes (batch)
            if (action === "delete" || action === "move_date" || action === "move_to_pool") {
                lines = lines.filter((_, idx) => !linesToModify.has(idx) || linesToModify.get(idx) !== null);
                modified = true;
            } else {
                linesToModify.forEach((newContent, idx) => {
                    if (lines[idx] !== newContent) {
                        lines[idx] = newContent;
                        modified = true;
                    }
                });
            }

            if (modified) {
                await app.vault.modify(file, lines.join("\n"));
            }
        }

        // Handle Moves (Target)
        if (action === "move_date" && options.targetDate && movedTaskTexts.length > 0) {
            await this.appendToDateFile(movedTaskTexts, options.targetDate, options.schedulePath || "スケジュール");
        } else if (action === "move_to_pool" && options.poolPath && movedTaskTexts.length > 0) {
            await this.appendToPoolFile(movedTaskTexts, options.poolPath);
        }

        return processedCount;
    },

    async appendToDateFile(taskTexts, dateStr, schedulePath) {
        const targetYear = moment(dateStr).format("YYYY");
        const targetMonth = moment(dateStr).format("MM");
        const targetYearFolder = `${schedulePath}/${targetYear}`;
        const targetFolder = `${targetYearFolder}/${targetMonth}`;
        const targetPath = `${targetFolder}/${dateStr}.md`;

        // Create Folders
        if (!app.vault.getAbstractFileByPath(targetYearFolder)) await app.vault.createFolder(targetYearFolder);
        if (!app.vault.getAbstractFileByPath(targetFolder)) await app.vault.createFolder(targetFolder);

        // Create/Read File
        let targetFile = app.vault.getAbstractFileByPath(targetPath);
        if (!targetFile) {
            targetFile = await app.vault.create(targetPath, "");
        }

        await this.appendTasksToFile(targetFile, taskTexts);
        new Notice(`${taskTexts.length}件のタスクを ${dateStr} に移動しました`);
    },

    async appendToPoolFile(taskTexts, poolPath) {
        let targetFile = app.vault.getAbstractFileByPath(poolPath);
        if (targetFile) {
            await this.appendTasksToFile(targetFile, taskTexts);
            new Notice(`${taskTexts.length}件のタスクをタスクプールに移動しました`);
        }
    },

    async appendTasksToFile(file, taskTexts) {
        const content = await app.vault.read(file);
        const newContent = content + (content.endsWith("\n") ? "" : "\n") + taskTexts.join("\n") + "\n";
        await app.vault.modify(file, newContent);
    },

    /**
     * Syncs task changes back to the original project file if linked.
     */
    async syncProjectTask(taskLine, action, params = {}) {
        const linkMatch = taskLine.match(/🔗\s*(.+)$/);
        if (!linkMatch) return;

        const projectName = linkMatch[1].trim();
        const files = app.vault.getFiles();
        // Prioritize files in "プロジェクト" folder
        let projectFile = files.find(f => f.basename === projectName && f.path.includes("プロジェクト"));
        if (!projectFile) {
            projectFile = files.find(f => f.basename === projectName);
        }

        if (!projectFile) return;

        const content = await app.vault.read(projectFile);
        let lines = content.split("\n");
        let modified = false;

        const cleanSource = taskLine.replace(/^- \[[ x]\]/, "").trim();

        const targetIdx = lines.findIndex(line => {
            const cleanLine = line.replace(/^- \[[ x]\]/, "").trim();
            return cleanLine === cleanSource;
        });

        if (targetIdx === -1) return;

        if (action === "update_status") {
            const newStatus = params.completed ? "x" : " ";
            const currentLine = lines[targetIdx];
            const currentStatusMatch = currentLine.match(/^- \[([ x])\]/);
            const currentStatus = currentStatusMatch ? currentStatusMatch[1] : " ";

            if (currentStatus !== newStatus) {
                lines[targetIdx] = currentLine.replace(/^- \[[ x]\]/, `- [${newStatus}]`);
                modified = true;
            }
        } else if (action === "delete") {
            lines.splice(targetIdx, 1);
            modified = true;
        } else if (action === "move_date") {
            const newDate = params.newDate;
            let line = lines[targetIdx];
            if (line.match(/📅 \d{4}-\d{2}-\d{2}/)) {
                line = line.replace(/📅 \d{4}-\d{2}-\d{2}/, `📅 ${newDate}`);
            } else {
                line += ` 📅 ${newDate}`;
            }
            lines[targetIdx] = line;
            modified = true;
        }

        if (modified) {
            await app.vault.modify(projectFile, lines.join("\n"));
        }
    }
};

module.exports = TaskActions;
