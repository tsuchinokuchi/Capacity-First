// scripts/dashboard/task_pool.js
const config = {
    PATHS: {
        TASK_POOL: "タスクプール/タスクプール.md",
        SCHEDULE: "スケジュール"
    }
};

const poolPath = config.PATHS.TASK_POOL;
const schedulePath = config.PATHS.SCHEDULE;
const today = moment().format("YYYY-MM-DD");

// Container setup
// Container setup
const container = input?.container || dv.container;
container.innerHTML = ""; // Clear previous content

// --- Styles ---
const style = document.createElement('style');
style.textContent = `
    .dashboard-action-bar {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    .dashboard-btn {
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
        color: var(--text-on-accent);
        opacity: 0.8;
    }
    .dashboard-btn:hover {
        opacity: 1;
    }
    .dashboard-btn.primary {
        background-color: var(--interactive-accent);
    }
    .dashboard-btn.danger {
        background-color: var(--text-error);
    }
    .dashboard-btn.secondary {
        background-color: var(--background-modifier-border);
        color: var(--text-muted);
    }
    .dashboard-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        background-color: var(--background-modifier-form-field);
        color: var(--text-faint);
    }
    .task-table {
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
    }
    .task-table thead tr {
        background-color: #1a2332;
    }
    .task-table th {
        text-align: left;
        padding: 12px 8px;
        border: none;
        color: var(--text-normal);
        font-weight: 600;
        font-size: 14px;
        background-color: transparent;
    }
    .task-table td {
        padding: 10px 8px;
        border: none;
        vertical-align: middle;
        font-size: 14px;
    }
    .task-table tr {
        transition: background-color 0.1s;
    }
    .task-table tbody tr:nth-child(odd) {
        background-color: var(--background-primary);
    }
    .task-table tbody tr:nth-child(even) {
        background-color: var(--background-secondary-alt);
    }
    .task-table tbody tr:hover {
        background-color: var(--background-modifier-hover);
    }
    .task-table tr.selected {
        background-color: rgba(var(--interactive-accent-rgb), 0.2) !important;
    }
    .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
    }
    .status-badge.done {
        color: var(--color-green);
    }
    .status-badge.todo {
        color: var(--text-muted);
    }
    input[type="checkbox"] {
        cursor: pointer;
    }
`;
container.appendChild(style);

// --- Data Loading ---
let allTasks = [];
try {
    // 1. Get Undated Tasks from Pool
    let poolTasks = [];
    const poolFile = dv.page(poolPath);
    if (poolFile) {
        poolTasks = poolFile.file.tasks
            .where(t => !t.completed && t.text.includes("⏱️") && !t.text.includes("📅"))
            .map(t => ({
                ...t,
                source: "プール",
                sortDate: "9999-99-99",
                text: t.text, path: t.path, line: t.line, completed: t.completed
            }))
            .array();
    }

    // 2. Get Overdue Tasks from Schedule
    const overdueTasks = dv.pages(`"${schedulePath}"`)
        .where(p => p.file.name < today && p.file.name.match(/^\d{4}-\d{2}-\d{2}$/))
        .flatMap(p => {
            return p.file.tasks
                .where(t => !t.completed && t.text.includes("⏱️"))
                .map(t => ({
                    ...t,
                    source: `期限切れ (${p.file.name})`,
                    sortDate: p.file.name,
                    text: t.text, path: t.path, line: t.line, completed: t.completed
                }));
        })
        .array();

    // 3. Combine and Sort
    allTasks = [...overdueTasks, ...poolTasks].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

} catch (error) {
    dv.paragraph(`_タスク読み込みエラー_: ${error.message}`);
    return;
}

if (!allTasks.length) {
    dv.paragraph("_タスクプール・期限切れタスクはありません_");
    return;
}

// --- State Management ---
let selectedIndices = new Set();

// --- Action Bar ---
const actionBar = container.createDiv({ cls: "dashboard-action-bar" });

const createBtn = (text, icon, type, onClick, initialDisabled = true) => {
    const btn = actionBar.createEl("button", { cls: `dashboard-btn ${type}` });
    btn.innerHTML = `${icon} ${text}`;
    btn.onclick = onClick;
    btn.disabled = initialDisabled;
    return btn;
};



// 2. Complete
const completeBtn = createBtn("完了", "✅", "secondary", () => processSelectedTasks("complete"));

// 3. Delete
const deleteBtn = createBtn("削除", "🗑️", "secondary", () => processSelectedTasks("delete"));



// 5. Change Date
const dateBtn = createBtn("日付変更", "📅", "secondary", () => processSelectedTasks("move_date"));

// --- Table ---
const table = container.createEl("table", { cls: "task-table" });
const thead = table.createTHead();
const headerRow = thead.insertRow();

const headers = [
    { text: "", width: "40px" },
    { text: "ソース", width: "150px" },
    { text: "タスク", width: "auto" },
    { text: "ジャンル", width: "120px" },
    { text: "時間", width: "80px" },
    { text: "状態", width: "100px" }
];

headers.forEach(h => {
    const th = headerRow.createEl("th", { text: h.text });
    if (h.width) th.style.width = h.width;
});

const tbody = table.createTBody();

// --- Render Rows ---
allTasks.forEach((task, index) => {
    const row = tbody.insertRow();
    row.id = `pool-task-row-${index}`;

    const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
    const cleanName = task.text
        .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
        .replace(/⏱️ \d+/, '')
        .replace(/#\w+/g, '')
        .trim();
    const genreMatch = task.text.match(/#(\w+)/);

    let sourceDisplay = task.source;
    if (task.source.startsWith("期限切れ")) {
        sourceDisplay = `🔴 ${task.source}`;
    }

    // 1. Checkbox
    const selectCell = row.insertCell();
    selectCell.style.textAlign = "center";
    const selectCb = selectCell.createEl("input", { type: "checkbox" });
    selectCb.dataset.index = index;
    selectCb.onclick = (e) => toggleSelection(index, selectCb.checked);

    // 2. Source
    row.insertCell().textContent = sourceDisplay;

    // 3. Task Name
    row.insertCell().textContent = cleanName;

    // 4. Genre
    row.insertCell().textContent = genreMatch ? genreMatch[1] : "-";

    // 5. Time
    row.insertCell().textContent = `${duration}分`;

    // 6. Status
    const statusCell = row.insertCell();
    const statusBadge = statusCell.createEl("span", {
        cls: `status-badge ${task.completed ? "done" : "todo"}`
    });
    const statusIcon = task.completed ? "✅" : "⬜";
    statusBadge.innerHTML = `${statusIcon} ${task.completed ? "完了" : "未完了"}`;
    statusBadge.style.cursor = "pointer";
    statusBadge.onclick = () => toggleTaskStatus(task, !task.completed);
});

// --- Logic ---

function toggleSelection(index, isChecked) {
    const row = document.getElementById(`pool-task-row-${index}`);
    if (isChecked) {
        selectedIndices.add(index);
        if (row) row.classList.add("selected");
    } else {
        selectedIndices.delete(index);
        if (row) row.classList.remove("selected");
    }
    updateActionButtons();
}

function updateActionButtons() {
    const hasSelection = selectedIndices.size > 0;
    completeBtn.disabled = !hasSelection;
    deleteBtn.disabled = !hasSelection;
    dateBtn.disabled = !hasSelection;
}

async function processSelectedTasks(action) {
    if (selectedIndices.size === 0) return;

    let targetDateStr = null;
    if (action === "move_date") {
        const defaultDate = moment().add(1, 'days').format("YYYY-MM-DD");
        const input = prompt("移動先の日付を入力してください (YYYY-MM-DD または MM-DD)\n空欄の場合は翌日に移動します", defaultDate);
        if (input === null) return;

        const inputStr = input.trim() === "" ? defaultDate : input.trim();
        const dateObj = moment(inputStr, ["YYYY-MM-DD", "MM-DD"], true);

        if (!dateObj.isValid()) {
            new Notice("無効な日付形式です");
            return;
        }
        targetDateStr = dateObj.format("YYYY-MM-DD");
    }

    if (!confirm(`${selectedIndices.size}件のタスクを${action === "delete" ? "削除" : "処理"}しますか？`)) return;

    const tasksToProcess = Array.from(selectedIndices).map(i => allTasks[i]);

    // Group tasks by file path to minimize file writes
    const tasksByFile = new Map();
    tasksToProcess.forEach(task => {
        if (!tasksByFile.has(task.path)) tasksByFile.set(task.path, []);
        tasksByFile.get(task.path).push(task);
    });

    for (const [filePath, fileTasks] of tasksByFile) {
        const file = app.vault.getAbstractFileByPath(filePath);
        if (!file) continue;

        const content = await app.vault.read(file);
        let lines = content.split("\n");
        let modified = false;
        const linesToModify = new Map();

        fileTasks.forEach(task => {
            const lineNum = task.line;
            const lineContent = lines[lineNum];

            if (action === "complete") {
                if (!task.completed) {
                    linesToModify.set(lineNum, lineContent.replace(/- \[ \]/, "- [x]"));
                }
            } else if (action === "delete") {
                linesToModify.set(lineNum, null);
            } else if (action === "move_date" || action === "move_to_pool") {
                linesToModify.set(lineNum, null); // Remove from source
            }
        });

        // Apply modifications to source file
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

    // Handle Moves (Destination)
    if (action === "move_date" && targetDateStr) {
        const targetPath = `${schedulePath}/${targetDateStr}.md`;
        let targetFile = app.vault.getAbstractFileByPath(targetPath);
        if (!targetFile) {
            targetFile = await app.vault.create(targetPath, "");
        }
        const targetContent = await app.vault.read(targetFile);
        const tasksText = tasksToProcess.map(t => t.text).join("\n");
        const newTargetContent = targetContent + (targetContent.endsWith("\n") ? "" : "\n") + tasksText + "\n";
        await app.vault.modify(targetFile, newTargetContent);
        new Notice(`${tasksToProcess.length}件のタスクを ${targetDateStr} に移動しました`);
    } else if (action === "move_to_pool") {
        const targetPath = poolPath;
        let targetFile = app.vault.getAbstractFileByPath(targetPath);
        if (targetFile) {
            const targetContent = await app.vault.read(targetFile);
            const tasksText = tasksToProcess.map(t => t.text).join("\n");
            const newTargetContent = targetContent + (targetContent.endsWith("\n") ? "" : "\n") + tasksText + "\n";
            await app.vault.modify(targetFile, newTargetContent);
            new Notice(`${tasksToProcess.length}件のタスクをタスクプールに移動しました`);
        }
    } else {
        new Notice("処理が完了しました");
    }
}

async function toggleTaskStatus(task, newStatus) {
    const file = app.vault.getAbstractFileByPath(task.path);
    if (file) {
        const content = await app.vault.read(file);
        const lines = content.split("\n");
        const lineContent = lines[task.line];
        const statusChar = newStatus ? "x" : " ";
        const newLine = lineContent.replace(/- \[[ x]\]/, `- [${statusChar}]`);

        if (newLine !== lineContent) {
            lines[task.line] = newLine;
            await app.vault.modify(file, lines.join("\n"));
            new Notice(`タスクを${newStatus ? "完了" : "未完了"}にしました`);
        }
    }
}
