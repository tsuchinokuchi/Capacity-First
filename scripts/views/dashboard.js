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

// 1. Title
createHeader("📊 Capacity-first Task Dashboard", 1);

// 2. Debug / Auto Update (Hidden or small?)
// Keeping it as a section for now
createHeader("⏱️ 日付と自動更新");
const debugContainer = container.createDiv();
await dv.view("scripts/dashboard/debug_paths", { container: debugContainer });

// --- Admin / Tools ---
const adminContainer = container.createDiv();
adminContainer.style.marginTop = "10px";
const createYearBtn = adminContainer.createEl("button", { text: "📅 年間スケジュール作成" });
createYearBtn.onclick = async () => {
    const yearInput = prompt("作成する年を入力してください (例: 2026)", moment().add(1, 'year').format("YYYY"));
    if (!yearInput) return;

    const year = parseInt(yearInput);
    if (isNaN(year)) {
        new Notice("有効な年を入力してください");
        return;
    }

    // Load and run schedule manager
    // Note: Since we are in a dataview script, we can't easily require() modules unless we use app.vault.adapter or similar.
    // However, we can use dv.view to run a script that does the work, or just load the content and eval it (risky but works for local),
    // OR, better, we can make schedule_manager a view or just include the logic here if it's simple enough.
    // But we made it a module. Let's try to load it via standard CommonJS if possible, or just copy the logic?
    // Obsidian's JS engine might not support require() for local files easily without a plugin.
    // Let's use a dynamic import or just read the file and execute it.
    // Actually, for simplicity in this context, let's just use the logic directly or via a helper view.
    // Let's try to use a helper view "scripts/actions/create_year_schedule" which we will create.

    // Changing approach: Call a new view to handle the action to keep dashboard clean.
    await dv.view("scripts/actions/create_year_schedule", { year: year });
};

container.createEl("hr");

// 3. Task Pool (Collapsible)
const poolContent = createSection("🗂 タスクプール & 期限切れ", false);
// Note: We pass the content div as 'container' to the sub-view
await dv.view("scripts/dashboard/task_pool", { container: poolContent });

container.createEl("hr");

// 4. Today's Tasks
createHeader("✅ 今日のタスク");
const todayContainer = container.createDiv();
await dv.view("scripts/dashboard/today_tasks", { container: todayContainer, refresh: Date.now() });

// 5. Capacity
const capacityContainer = container.createDiv();
capacityContainer.style.marginTop = "15px";
await dv.view("scripts/dashboard/capacity", { container: capacityContainer });

container.createEl("hr");

// 6. Project Progress (Collapsible)
const projectContent = createSection("🚀 プロジェクト進捗", false);
await dv.view("scripts/dashboard/project_list", { container: projectContent });

// 7. Tomorrow's Tasks (Collapsible)
const tomorrowContent = createSection("📅 明日のタスク", false);
await dv.view("scripts/dashboard/tomorrow_tasks", { container: tomorrowContent });

// 8. Weekly Summary (Collapsible)
const weeklyContent = createSection("📆 今週のサマリー", false);
await dv.view("scripts/dashboard/weekly_summary", { container: weeklyContent });

// 9. Shortcuts
createHeader("📎 ショートカット");
const shortcuts = [
    "[[繰り返しタスク/毎日|毎日の繰り返し]]",
    "[[繰り返しタスク/毎週|毎週の繰り返し]]",
    "[[繰り返しタスク/毎月|毎月の繰り返し]]",
    "[[週勤務グリッド|週勤務グリッド]]",
    "[[タスクプール/タスクプール|タスクプール原本]]"
];
const ul = container.createEl("ul");
shortcuts.forEach(link => {
    const li = ul.createEl("li");
    // Render obsidian link? 
    // dv.paragraph renders markdown.
    // We can just use dv.paragraph to render the list into a specific container?
    // Or just use innerHTML with a helper to resolve links?
    // Simplest is to just render a markdown list using dv.paragraph but that appends to main container.
    // We want it in 'ul'.
    // Let's just use dv.api.index.renderString? No.
    // We will just render text for now, or use dv.paragraph for the whole list.
});
// Re-doing shortcuts using dv.paragraph for simplicity as it handles links
const shortcutsContainer = container.createDiv();
dv.paragraph(shortcuts.map(s => `- ${s}`).join("\n"), { container: shortcutsContainer });
// Wait, dv.paragraph doesn't take container option. It appends to dv.container.
// But we are in the main script, so dv.container IS our container.
// But we want it after the header.
// We already created 'ul' which is empty. Let's remove 'ul' and use dv.paragraph.
ul.remove();
dv.paragraph(shortcuts.map(s => `- ${s}`).join("\n"));
