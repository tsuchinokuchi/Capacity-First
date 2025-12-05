// scripts/dashboard/project_list.js
const config = {
    PROJECT_DIR: "プロジェクト"
};

const container = input?.container || dv.container;
container.innerHTML = ""; // Clear previous content

// --- Styles ---
const style = document.createElement('style');
style.textContent = `
    .project-table {
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
    }
    .project-table th {
        text-align: left;
        padding: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
        font-weight: 600;
        font-size: 14px;
        color: var(--text-muted);
    }
    .project-table td {
        padding: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
        vertical-align: middle;
        font-size: 14px;
    }
    .progress-bar-container {
        width: 100%;
        height: 8px;
        background-color: var(--background-modifier-border);
        border-radius: 4px;
        overflow: hidden;
    }
    .progress-bar {
        height: 100%;
        background-color: var(--interactive-accent);
        transition: width 0.3s ease;
    }
    .progress-text {
        font-size: 12px;
        color: var(--text-muted);
        margin-left: 8px;
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
`;
container.appendChild(style);

// --- Add Button ---
const btnContainer = container.createDiv();
btnContainer.style.marginBottom = "10px";
const addBtn = btnContainer.createEl("button", { cls: "dashboard-btn primary", text: "➕ プロジェクト追加" });
addBtn.onclick = () => app.commands.executeCommandById("quickadd:choice:project-create");

// --- Data Loading ---
const projects = dv.pages(`"${config.PROJECT_DIR}"`)
    .where(p => !p.file.name.includes("テンプレート") && p.file.name !== "README")
    .map(p => {
        const tasks = p.file.tasks;
        const total = tasks.length;
        const completed = tasks.where(t => t.completed).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
            file: p.file,
            name: p.file.name,
            total: total,
            completed: completed,
            progress: progress
        };
    })
    .sort(p => p.progress, "desc") // Sort by progress (optional)
    .array();

if (!projects.length) {
    dv.paragraph("_進行中のプロジェクトはありません_");
    return;
}

// --- Render Table ---
const table = container.createEl("table", { cls: "project-table" });
const thead = table.createTHead();
const headerRow = thead.insertRow();
["プロジェクト", "進捗", "タスク数"].forEach(text => {
    headerRow.createEl("th", { text });
});

const tbody = table.createTBody();

projects.forEach(p => {
    const row = tbody.insertRow();

    // 1. Project Name (Link)
    const nameCell = row.insertCell();
    const link = nameCell.createEl("a");
    link.textContent = p.name;
    link.onclick = () => app.workspace.openLinkText(p.file.path, "", false);
    link.style.cursor = "pointer";
    link.style.fontWeight = "500";
    link.style.color = "var(--text-normal)";

    // 2. Progress Bar
    const progressCell = row.insertCell();
    progressCell.style.width = "50%";
    const barContainer = progressCell.createDiv({ cls: "progress-bar-container" });
    const bar = barContainer.createDiv({ cls: "progress-bar" });
    bar.style.width = `${p.progress}%`;

    // Color coding based on progress
    if (p.progress === 100) bar.style.backgroundColor = "var(--color-green)";
    else if (p.progress > 0) bar.style.backgroundColor = "var(--interactive-accent)";
    else bar.style.backgroundColor = "var(--text-muted)";

    // 3. Task Counts
    const countCell = row.insertCell();
    countCell.innerHTML = `${p.progress}% <span class="progress-text">(${p.completed}/${p.total})</span>`;
});
