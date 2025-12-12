// scripts/dashboard/project_list.js
const config = input.config;
const root = input.root;

if (!config) {
    dv.paragraph("⚠️ Config definition missing");
    return;
}

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
    progressCell.style.width = "40%";
    progressCell.style.paddingRight = "10px";
    progressCell.style.verticalAlign = "middle";

    // Wrapper for alignment
    const wrapper = progressCell.createDiv();
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.minHeight = "20px";

    // Track (Background)
    const track = wrapper.createDiv();
    track.style.width = "100%";
    track.style.height = "8px";
    track.style.backgroundColor = "rgba(125, 125, 125, 0.3)";
    track.style.borderRadius = "4px";
    track.style.overflow = "hidden";
    track.style.position = "relative"; // Ensure stacking context

    // Fill (Progress)
    const fill = track.createDiv();
    fill.style.height = "100%";
    fill.style.width = `${p.progress}%`;
    fill.style.transition = "width 0.3s";
    fill.style.display = "block"; // Ensure block display

    // Color coding
    if (p.progress === 100) {
        fill.style.backgroundColor = "var(--color-green, #4caf50)";
    } else if (p.progress > 0) {
        fill.style.backgroundColor = "var(--interactive-accent, #7b1fa2)";
    } else {
        fill.style.backgroundColor = "var(--text-muted, #999999)";
    }

    // 3. Task Counts
    const countCell = row.insertCell();
    countCell.style.whiteSpace = "nowrap"; // Prevent wrapping
    countCell.innerHTML = `<strong>${p.progress}%</strong> <span class="progress-text" style="color: grey; font-size: 0.9em;">(${p.completed}/${p.total})</span>`;
});
