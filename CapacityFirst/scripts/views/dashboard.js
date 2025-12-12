// scripts/views/dashboard.js

const container = dv.container;
container.innerHTML = ""; // Clear main container

// --- Helper to create collapsible section ---
const createSection = (title, isOpen = false) => {
    const details = container.createEl("details");
    if (isOpen) details.setAttribute("open", "");
    const summary = details.createEl("summary");
    summary.textContent = title;
    summary.style.fontWeight = "bold";
    summary.style.cursor = "pointer";
    summary.style.marginBottom = "10px";

    // Add some style to look like a callout header
    summary.style.backgroundColor = "var(--background-secondary)";
    summary.style.padding = "8px";
    summary.style.borderRadius = "4px";

    const content = details.createDiv();
    content.style.padding = "10px";
    content.style.borderLeft = "2px solid var(--background-secondary)";
    content.style.marginLeft = "10px";

    return content;
};

// --- Helper to create standard header ---
const createHeader = (text, level = 2) => {
    const h = container.createEl(`h${level}`);
    h.textContent = text;
    h.style.marginTop = "20px";
    h.style.marginBottom = "10px";
    h.style.borderBottom = "1px solid var(--background-modifier-border)";
    h.style.paddingBottom = "5px";
};

// --- Dashboard Layout ---

// Load Config
const root = input.root || "CapacityFirst";
let configPath = app.vault.adapter.basePath + "/" + root + "/scripts/config.js";

// Cache busting (robust for Windows)
if (typeof require !== "undefined" && require.cache) {
    // Try forward slash
    if (require.cache[configPath]) delete require.cache[configPath];
    // Try backslash
    const backSlashPath = configPath.replace(/\//g, "\\");
    if (require.cache[backSlashPath]) delete require.cache[backSlashPath];
}

let config = {};
try {
    // Using simple require path construction
    // Note: require needs absolute path or relative to module. 
    // In DataviewJS, require(path) works if path is absolute.
    config = require(configPath);
    // DEBUG
    // new Notice(`Debug: Loaded Config. SCHEDULE=${config.PATHS.SCHEDULE}`);
} catch (e) {
    console.error("Config load error:", e);
    dv.paragraph(`⚠️ Configuration not found at ${configPath}`);
}

// 1. Title
// createHeader("📊 Capacity-first Task Dashboard", 1);

// 3. Task Pool (Collapsible)
const poolContent = createSection("🗂 タスクプール & 期限切れ", false);
await dv.view(`${root}/scripts/dashboard/task_pool`, { container: poolContent, config: config, root: root });

container.createEl("hr");

// 4. Today's Tasks
createHeader("✅ 今日のタスク");
const todayContainer = container.createDiv();
await dv.view(`${root}/scripts/dashboard/today_tasks`, { container: todayContainer, refresh: Date.now(), config: config, root: root });

// 5. Capacity
const capacityContainer = container.createDiv();
capacityContainer.style.marginTop = "15px";
await dv.view(`${root}/scripts/dashboard/capacity`, { container: capacityContainer, config: config, root: root });

container.createEl("hr");

// 6. Project Progress (Collapsible)
const projectContent = createSection("🚀 プロジェクト進捗", false);
await dv.view(`${root}/scripts/dashboard/project_list`, { container: projectContent, config: config, root: root });

// 7. Tomorrow's Tasks (Collapsible)
const tomorrowContent = createSection("📅 明日のタスク", false);
await dv.view(`${root}/scripts/dashboard/tomorrow_tasks`, { container: tomorrowContent, config: config, root: root });

// 8. Weekly Summary (Collapsible)
const weeklyContent = createSection("📆 今週のサマリー", false);
await dv.view(`${root}/scripts/dashboard/weekly_summary`, { container: weeklyContent, config: config, root: root });

// 9. Shortcuts
createHeader("📎 ショートカット");
const shortcuts = [
    `[[${config.PATHS.SCHEDULE || "スケジュール"}/繰り返しタスク/毎日|毎日の繰り返し]]`,
    `[[${config.PATHS.SCHEDULE || "スケジュール"}/繰り返しタスク/毎週|毎週の繰り返し]]`,
    `[[${config.PATHS.SCHEDULE || "スケジュール"}/繰り返しタスク/毎月|毎月の繰り返し]]`,
    `[[${config.FILES.WEEKLY_GRID || "週勤務グリッド"}|週勤務グリッド]]`,
    `[[${config.PATHS.POOL || "タスクプール/タスクプール"}|タスクプール原本]]` // Note: POOL not standard in config yet but let's assume
];
const ul = container.createEl("ul");
// ... existing shortcut logic ...
// Re-doing shortcuts using dv.paragraph for simplicity
const shortcutsContainer = container.createDiv();
dv.paragraph(shortcuts.map(s => `- ${s}`).join("\n"), { container: shortcutsContainer });
ul.remove(); // Cleanup

container.createEl("hr");

// --- Admin / Tools --- (Moved to bottom)
const adminContainer = container.createDiv();
adminContainer.style.marginTop = "20px";
const createYearBtn = adminContainer.createEl("button", { text: "📅 年間スケジュール作成" });
createYearBtn.onclick = async () => {
    try {
        let yearInput;
        // ... existing prompt logic ...
        if (app.plugins.plugins.quickadd && app.plugins.plugins.quickadd.api) {
            yearInput = await app.plugins.plugins.quickadd.api.inputPrompt(
                "作成する年を入力してください",
                "例: 2026",
                moment().add(1, 'year').format("YYYY")
            );
        } else {
            // ...
            new Notice("QuickAdd plugin is required for input.");
            return;
        }

        if (!yearInput) return;
        const year = parseInt(yearInput);
        if (isNaN(year)) return;

        await dv.view(`${root}/scripts/actions/create_year_schedule`, { year: year, config: config, root: root });
    } catch (e) {
        new Notice(`Error: ${e.message}`);
        console.error(e);
    }
};
