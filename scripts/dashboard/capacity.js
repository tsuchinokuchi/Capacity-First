// scripts/dashboard/capacity.js
const CONFIG_FILE_PATH = "scripts/config.js";

let config = {};
try {
    // Try to load config.js using app.vault.adapter
    // This assumes scripts/config.js is relative to the vault root
    const configPath = app.vault.adapter.basePath + "/" + CONFIG_FILE_PATH;
    // Since we cannot easily require absolute paths in all environments without customjs,
    // we will try to read the file content and extract necessary values or fallback to defaults.
    // However, for this specific script, we mainly need paths which we can try to infer or hardcode defaults matching the repo structure.

    // Fallback defaults
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

    // Attempt to load config.js if possible (advanced usage)
    // For now, we will use the defaults which match the repo structure.
    // If the user changes config.js, they might need to update this or we need a better way to share config.
    // Given the constraints of dv.view, we'll stick to the pattern used in the original dashboard but modularized.
} catch (e) {
    console.error("Failed to load config", e);
}

const CONFIG_PATH = config.FILES.SETTINGS;
const schedulePath = config.PATHS.SCHEDULE;
const genreConfigPath = config.FILES.GENRE_CONFIG;

const today = moment().format("YYYY-MM-DD");
let maxDailyMinutes = config.SETTINGS.DEFAULT_MAX_DAILY_MINUTES;
let genres = ["デスクワーク", "売場作業", "顧客対応", "定型作業", "学習", "健康", "趣味", "その他プライベート"];

try {
    const cfg = await dv.io.load(CONFIG_PATH);
    if (cfg) {
        const parsed = JSON.parse(cfg);
        if (Number.isFinite(parsed.maxDailyMinutes)) maxDailyMinutes = parsed.maxDailyMinutes;
    }
} catch (error) { console.error(error); }

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

let used = 0;
let remaining = 0;
const genreUsage = {};

tasks.forEach(task => {
    const m = task.text.match(/⏱️ (\d+)/);
    const minutes = m ? parseInt(m[1], 10) : 0;
    used += minutes;
    if (!task.completed) remaining += minutes;
    for (const genre of genres) {
        if (task.text.includes(`#${genre}`)) {
            genreUsage[genre] = (genreUsage[genre] || 0) + minutes;
            break;
        }
    }
});

const usedPct = Math.round((used / maxDailyMinutes) * 100);
const remainingPct = Math.round((remaining / maxDailyMinutes) * 100);
const bar = (pct) => {
    const filled = Math.min(20, Math.max(0, Math.floor(pct / 5)));
    return "█".repeat(filled) + "░".repeat(20 - filled);
};

if (!todayPage) {
    dv.paragraph("_今日のスケジュールファイルが見つかりません_");
    return;
}

dv.table(
    ["指標", "値", "バー"],
    [
        ["利用済み", `${used}分 / ${maxDailyMinutes}分 (${usedPct}%)`, bar(usedPct)],
        ["未完了タスク残", `${remaining}分 / ${maxDailyMinutes}分 (${remainingPct}%)`, bar(remainingPct)]
    ]
);

if (Object.keys(genreUsage).length) {
    dv.paragraph("**ジャンル別内訳**");
    dv.table(
        ["ジャンル", "時間", "割合"],
        Object.entries(genreUsage)
            .sort((a, b) => b[1] - a[1])
            .map(([genre, minutes]) => [genre, `${minutes}分`, `${Math.round((minutes / used) * 100) || 0}%`])
    );
}

if (used > maxDailyMinutes) {
    dv.paragraph("⚠️ **容量超過**：今日の設定上限を超えています");
}
