// scripts/dashboard/weekly_summary.js
// Default config matching repo structure
const config = {
    PATHS: {
        SCHEDULE: "スケジュール"
    },
    FILES: {
        SETTINGS: "config/settings.json"
    },
    SETTINGS: {
        DEFAULT_MAX_DAILY_MINUTES: 360
    }
};

const CONFIG_PATH = config.FILES.SETTINGS;
const schedulePath = config.PATHS.SCHEDULE;

let maxDailyMinutes = config.SETTINGS.DEFAULT_MAX_DAILY_MINUTES;

try {
    const cfg = await dv.io.load(CONFIG_PATH);
    if (cfg) {
        const parsed = JSON.parse(cfg);
        if (Number.isFinite(parsed.maxDailyMinutes)) maxDailyMinutes = parsed.maxDailyMinutes;
    }
} catch (error) { console.error(error); }

const weekStart = moment().startOf('isoWeek');
const weekEnd = moment(weekStart).add(6, 'days');
const pages = dv.pages(`"${schedulePath}"`);
let weeklyMinutes = 0;
let weeklyTasks = [];

for (let d = moment(weekStart); d.isSameOrBefore(weekEnd); d.add(1, 'day')) {
    const dateStr = d.format("YYYY-MM-DD");
    const file = pages.where(p => p.file.name === dateStr).array()[0];
    if (!file) continue;
    file.file.tasks
        .where(t => t.text.includes("⏱️"))
        .array()
        .forEach(task => {
            const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
            weeklyMinutes += parseInt(duration, 10);
            const cleanName = task.text
                .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
                .replace(/⏱️ \d+/, '').replace(/📅 \d{4}-\d{2}-\d{2}/, '')
                .replace(/#\w+/g, '')
                .trim();
            weeklyTasks.push([
                d.format("MM/DD(ddd)"),
                cleanName,
                `${duration}分`,
                task.completed ? "✅" : "⬜"
            ]);
        });
}

if (!weeklyTasks.length) {
    dv.paragraph("_今週のタスクはありません_");
} else {
    dv.table(["日付", "タスク", "時間", "状態"], weeklyTasks);
    const maxWeekly = maxDailyMinutes * 5; // 平日稼働想定
    const pct = Math.round((weeklyMinutes / maxWeekly) * 100);
    const bar = "█".repeat(Math.min(20, Math.floor(pct / 5))) + "░".repeat(Math.max(0, 20 - Math.floor(pct / 5)));
    dv.paragraph(`**週間容量**: ${weeklyMinutes}分 / ${maxWeekly}分 (${pct}%)\n${bar}`);
}
