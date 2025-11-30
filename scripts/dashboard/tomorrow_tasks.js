// scripts/dashboard/tomorrow_tasks.js
// Default config matching repo structure
const config = {
    PATHS: {
        SCHEDULE: "スケジュール"
    },
    FILES: {
        GENRE_CONFIG: "ジャンル設定.md"
    }
};

const schedulePath = config.PATHS.SCHEDULE;
const genreConfigPath = config.FILES.GENRE_CONFIG;

let genres = ["デスクワーク", "売場作業", "顧客対応", "定型作業", "学習", "健康", "趣味", "その他プライベート"];

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

const tomorrow = moment().add(1, 'day').format("YYYY-MM-DD");
const tomorrowPage = dv.page(`${schedulePath}/${tomorrow}`);
if (!tomorrowPage) {
    dv.paragraph("_明日のスケジュールファイルがありません_");
    return;
}

const tomorrowTasks = tomorrowPage.file.tasks
    .where(t => t.text.includes("⏱️"))
    .array()
    .map(task => {
        const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
        const cleanName = task.text
            .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
            .replace(/⏱️ \d+/, '').replace(/📅 \d{4}-\d{2}-\d{2}/, '')
            .replace(/#\w+/g, '')
            .trim();
        const genre = genres.find(g => task.text.includes(`#${g}`)) || "-";
        return [cleanName, genre, `${duration}分`, task.completed ? "✅" : "⬜"];
    });

if (!tomorrowTasks.length) {
    dv.paragraph("_明日のタスクはありません_");
} else {
    dv.table(["タスク", "ジャンル", "時間", "状態"], tomorrowTasks);
    dv.paragraph(`👉 [[${schedulePath}/${tomorrow}|明日のスケジュールを開く]]`);
}
