// scripts/dashboard/capacity.js
const CONFIG_FILE_PATH = "scripts/config.js";

let config = {};
try {
    const configPath = app.vault.adapter.basePath + "/" + CONFIG_FILE_PATH;
    config = {
        PATHS: {
            SCHEDULE: "スケジュール"
        },
        FILES: {
            SETTINGS: "config/settings.json",
            GENRE_CONFIG: "ジャンル設定.md"
        },
        SETTINGS: {
            DEFAULT_MAX_DAILY_MINUTES: 360
        }
    };
} catch (e) {
    console.error("Failed to load config", e);
}

const CONFIG_PATH = config.FILES.SETTINGS;
const schedulePath = config.PATHS.SCHEDULE;

const today = moment().format("YYYY-MM-DD");
let maxDailyMinutes = config.SETTINGS.DEFAULT_MAX_DAILY_MINUTES;

try {
    const cfg = await dv.io.load(CONFIG_PATH);
    if (cfg) {
        const parsed = JSON.parse(cfg);
        if (Number.isFinite(parsed.maxDailyMinutes)) maxDailyMinutes = parsed.maxDailyMinutes;
    }
} catch (error) { console.error(error); }

const todayPage = dv.page(`${schedulePath}/${today}`);
const tasks = todayPage ? todayPage.file.tasks.where(t => t.text.includes("⏱️")).array() : [];

let used = 0;
let remaining = 0;

tasks.forEach(task => {
    const m = task.text.match(/⏱️ (\d+)/);
    const minutes = m ? parseInt(m[1], 10) : 0;
    used += minutes;
    if (!task.completed) remaining += minutes;
});

const usedPct = Math.round((used / maxDailyMinutes) * 100);
const remainingPct = Math.round((remaining / maxDailyMinutes) * 100);
const bar = (pct) => {
    const filled = Math.min(20, Math.max(0, Math.floor(pct / 5)));
    return "█".repeat(filled) + "░".repeat(20 - filled);
};

if (!todayPage) {
    // Silent fail or minimal message if no page, but usually today_tasks handles the "no tasks" state.
    // We'll just return empty to avoid clutter if the file doesn't exist yet.
    return;
}


const table = dv.container.createEl("table");
table.style.width = "100%";
table.style.borderCollapse = "collapse";
table.style.marginTop = "0px";

const rows = [
    ["利用済み", `${used}分 / ${maxDailyMinutes}分 (${usedPct}%)`, bar(usedPct)],
    ["未完了タスク残", `${remaining}分 / ${maxDailyMinutes}分 (${remainingPct}%)`, bar(remainingPct)]
];

rows.forEach(rowData => {
    const tr = table.insertRow();
    rowData.forEach((cellData, i) => {
        const td = tr.insertCell();
        td.textContent = cellData;
        td.style.padding = "4px 8px";
        if (i === 0) td.style.width = "15%"; // Label
        if (i === 1) td.style.width = "25%"; // Value
        // Bar takes remaining space
    });
});

if (used > maxDailyMinutes) {
    dv.paragraph("⚠️ **容量超過**：今日の設定上限を超えています");
}
