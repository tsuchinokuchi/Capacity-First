// scripts/dashboard/today_tasks.js
const config = {
    PATHS: {
        SCHEDULE: "スケジュール",
        POOL: "タスクプール/タスクプール.md"
    },
    FILES: {
        GENRE_CONFIG: "ジャンル設定.md"
    }
};

const schedulePath = config.PATHS.SCHEDULE;
const genreConfigPath = config.FILES.GENRE_CONFIG;

const today = moment().format("YYYY-MM-DD");
let genres = ["デスクワーク", "売場作業", "顧客対応", "定型作業", "学習", "健康", "趣味", "その他プライベート"];

// Load genres
try {
    const genreContent = await dv.io.load(genreConfigPath);
    if (genreContent) {
        const match = genreContent.match(/const TASK_GENRES = \[([\s\S]*?)\];/);
        if (match) {
            const parsed = match[1].split(',').map(g => g.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
            if (parsed.length) genres = parsed;
        }
    }
} catch (error) { console.error(error); }

const todayPage = dv.page(`${schedulePath}/${today}`);
const tasks = todayPage ? todayPage.file.tasks.where(t => t.text.includes("⏱️")).array() : [];

// Container setup
const container = dv.container;
container.innerHTML = ""; // Clear previous content if any

if (!tasks.length) {
    dv.paragraph("_今日のタスクはありません_");
    dv.paragraph(`👉 [[${schedulePath}/${today}|今日のスケジュールを開く]]`);
    const addBtn = container.createEl("button", { cls: "dashboard-btn primary", text: "➕ タスク追加" });
    addBtn.onclick = () => app.commands.executeCommandById("quickadd:choice:task-add");
    return;
}

// --- State Management ---
let selectedIndices = new Set();

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
        background-color: #1a2332; /* Navy-like header */
    }
    .task-table th {
        text-align: left;
        padding: 12px 8px;
        border: none;
        color: var(--text-normal);
        font-weight: 600;
        font-size: 14px;
        background-color: transparent; /* Allow row color to show */
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
    /* Zebra striping */
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
    /* Checkbox styling */
    input[type="checkbox"] {
        cursor: pointer;
    }
`;
container.appendChild(style);

// --- Action Bar ---
const actionBar = container.createDiv({ cls: "dashboard-action-bar" });

const createBtn = (text, icon, type, onClick, initialDisabled = true) => {
    const btn = actionBar.createEl("button", { cls: `dashboard-btn ${type}` });
    btn.innerHTML = `${icon} ${text}`;
    btn.onclick = onClick;
    btn.disabled = initialDisabled;
    return btn;
};

// 1. Add Task (Always enabled)
const addBtn = createBtn("タスク追加", "➕", "primary", () => {
    app.commands.executeCommandById("quickadd:choice:task-add");
}, false);

// 2. Complete
const completeBtn = createBtn("完了", "✅", "secondary", () => processSelectedTasks("complete"));

// 3. Delete
const deleteBtn = createBtn("削除", "🗑️", "secondary", () => processSelectedTasks("delete"));

// 4. Move to Pool
const poolBtn = createBtn("タスクプールへ", "📦", "secondary", () => new Notice("未実装: プール移動"));

// 5. Change Date
const dateBtn = createBtn("日付変更", "📅", "secondary", () => processSelectedTasks("move_date"));

// --- Table ---
const table = container.createEl("table", { cls: "task-table" });
const thead = table.createTHead();
const headerRow = thead.insertRow();

// Header Columns
const headers = [
    { text: "", width: "40px" }, // Checkbox
    { text: "タスク", width: "auto" },
    { text: "ジャンル", width: "120px" },
    { text: "時間", width: "80px" },
    { text: "状態", width: "100px" },
    { text: "締切日", width: "150px" },
    { text: "リンク", width: "60px" }
];

headers.forEach(h => {
    const th = headerRow.createEl("th", { text: h.text });
    if (h.width) th.style.width = h.width;
});

const tbody = table.createTBody();

// --- Render Rows ---
tasks.forEach((task, index) => {
    const row = tbody.insertRow();
    row.id = `task-row-${index}`;

    // Parse Data
    const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
    const cleanName = task.text
        .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
        .replace(/⏱️ \d+/, '').replace(/📅 \d{4}-\d{2}-\d{2}/, '')
        .replace(/#\S+/g, '').replace(/⏰ \d{4}-\d{2}-\d{2}/, '')
        .replace(/🔗\s*[^\s]+/, '') // Remove link metadata from name
        .trim();

    const deadlineMatch = task.text.match(/⏰ (\d{4}-\d{2}-\d{2})/);
    let deadlineLabel = "-";
    if (deadlineMatch) {
        const diff = moment(deadlineMatch[1]).diff(moment().startOf('day'), 'days');
        if (diff < 0) deadlineLabel = `🔴 ${deadlineMatch[1]} 超過`;
        else if (diff === 0) deadlineLabel = `🟠 今日`;
        else deadlineLabel = `🟡 締切${diff}日後 (${moment(deadlineMatch[1]).format("MM/DD")})`;
    }

    const genre = genres.find(g => task.text.includes(`#${g}`)) || "-";

    // 1. Select Checkbox
    const selectCell = row.insertCell();
    selectCell.style.textAlign = "center";
    const selectCb = selectCell.createEl("input", { type: "checkbox" });
    selectCb.dataset.index = index;
    selectCb.onclick = (e) => {
        // e.stopPropagation(); // Allow row click?
        toggleSelection(index, selectCb.checked);
    };

    // 2. Task Name
    const nameCell = row.insertCell();
    nameCell.textContent = cleanName;
    // Tags are not added to nameCell as requested

    // 3. Genre
    row.insertCell().textContent = genre;

    // 4. Time
    row.insertCell().textContent = `${duration}分`;

    // 5. Status
    const statusCell = row.insertCell();
    const statusBadge = statusCell.createEl("span", {
        cls: `status-badge ${task.completed ? "done" : "todo"}`
    });
    // Use checkbox icon for status to match image style
    const statusIcon = task.completed ? "✅" : "⬜";
    statusBadge.innerHTML = `${statusIcon} ${task.completed ? "完了" : "未完了"}`;
    statusBadge.style.cursor = "pointer";
    statusBadge.onclick = () => toggleTaskStatus(task, !task.completed);

    // 6. Deadline
    row.insertCell().textContent = deadlineLabel;

    // 7. Link
    const linkCell = row.insertCell();
    const a = linkCell.createEl("a");
    a.textContent = "📄 開く";
    a.href = "#";
    a.onclick = (e) => {
        e.preventDefault();
        // Link to the source file (daily note)
        app.workspace.openLinkText(task.path, "", true);
    };
});

dv.paragraph(`👉 [[${schedulePath}/${today}|今日のスケジュールを開く]]`);

// --- Logic ---

function toggleSelection(index, isChecked) {
    const row = document.getElementById(`task-row-${index}`);
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
    // addBtn is always enabled
    completeBtn.disabled = !hasSelection;
    deleteBtn.disabled = !hasSelection;
    poolBtn.disabled = !hasSelection;
    dateBtn.disabled = !hasSelection;
}

async function processSelectedTasks(action) {
    if (selectedIndices.size === 0) return;

    let targetDateStr = null;
    if (action === "move_date") {
        let nextDay = moment().add(1, 'days');
        if (moment().day() === 5) nextDay = moment().add(3, 'days'); // Fri -> Mon
        else if (moment().day() === 6) nextDay = moment().add(2, 'days'); // Sat -> Mon
        const defaultDate = nextDay.format("YYYY-MM-DD");

        const input = prompt("移動先の日付を入力してください (YYYY-MM-DD または MM-DD)\n空欄の場合は翌営業日に移動します", defaultDate);
        if (input === null) return;

        const inputStr = input.trim() === "" ? defaultDate : input.trim();
        const dateObj = moment(inputStr, ["YYYY-MM-DD", "MM-DD"], true);

        if (!dateObj.isValid()) {
            new Notice("無効な日付形式です");
            return;
        }
        targetDateStr = dateObj.format("YYYY-MM-DD");
    }

    if (!confirm(`${selectedIndices.size}件のタスクを${action === "delete" ? "削除" : (action === "move_date" ? "移動" : "更新")}しますか？`)) return;

    const tasksToProcess = Array.from(selectedIndices).map(i => tasks[i]);
    const file = app.vault.getAbstractFileByPath(tasksToProcess[0].path);

    if (file) {
        const content = await app.vault.read(file);
        let lines = content.split("\n");
        let modified = false;
        const linesToModify = new Map();
        const movedTaskTexts = [];

        tasksToProcess.forEach(task => {
            const lineNum = task.line;
            const lineContent = lines[lineNum];

            if (action === "complete") {
                if (!task.completed) {
                    linesToModify.set(lineNum, lineContent.replace(/- \[ \]/, "- [x]"));
                }
            } else if (action === "delete") {
                linesToModify.set(lineNum, null);
            } else if (action === "move_date") {
                movedTaskTexts.push(lineContent);
                linesToModify.set(lineNum, null);
            }
        });

        if (action === "delete" || action === "move_date") {
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

            if (action === "move_date" && targetDateStr) {
                const targetPath = `${schedulePath}/${targetDateStr}.md`;
                new Notice(`Debug: Target Path = ${targetPath}`); // DEBUG
                let targetFile = app.vault.getAbstractFileByPath(targetPath);
                if (!targetFile) {
                    new Notice(`Debug: Creating new file at ${targetPath}`); // DEBUG
                    targetFile = await app.vault.create(targetPath, "");
                }
                const targetContent = await app.vault.read(targetFile);
                const newTargetContent = targetContent + (targetContent.endsWith("\n") ? "" : "\n") + movedTaskTexts.join("\n") + "\n";
                await app.vault.modify(targetFile, newTargetContent);
                new Notice(`${movedTaskTexts.length}件のタスクを ${targetDateStr} に移動しました`);
            } else {
                new Notice(`${selectedIndices.size}件のタスクを処理しました`);
            }
        }
    } else {
        new Notice(`エラー: ファイルが見つかりません (${tasksToProcess[0].path})`);
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
