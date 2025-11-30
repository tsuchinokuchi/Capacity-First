// scripts/dashboard/today_tasks.js
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

const today = moment().format("YYYY-MM-DD");
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

const todayPage = dv.page(`${schedulePath}/${today}`);
const tasks = todayPage ? todayPage.file.tasks.where(t => t.text.includes("⏱️")).array() : [];

const todayTasks = tasks.map(task => {
    const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
    const cleanName = task.text
        .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
        .replace(/⏱️ \d+/, '').replace(/📅 \d{4}-\d{2}-\d{2}/, '')
        .replace(/#\w+/g, '').replace(/⏰ \d{4}-\d{2}-\d{2}/, '')
        .trim();
    const deadlineMatch = task.text.match(/⏰ (\d{4}-\d{2}-\d{2})/);
    let deadlineLabel = "-";
    if (deadlineMatch) {
        const diff = moment(deadlineMatch[1]).diff(moment().startOf('day'), 'days');
        if (diff < 0) deadlineLabel = `🔴 ${deadlineMatch[1]} 超過`;
        else if (diff === 0) deadlineLabel = `🟠 今日 (${deadlineMatch[1]})`;
        else deadlineLabel = `⏰ ${deadlineMatch[1]} (あと${diff}日)`;
    }
    const genre = genres.find(g => task.text.includes(`#${g}`)) || "-";
    return {
        name: cleanName,
        genre,
        minutes: `${duration}分`,
        status: task.completed ? "✅ 完了" : "⬜ 未完了",
        deadline: deadlineLabel
    };
});

if (!todayTasks.length) {
    dv.paragraph("_今日のタスクはありません_");
} else {
    dv.table(
        ["タスク", "ジャンル", "時間", "状態", "締切"],
        todayTasks.map(t => [t.name, t.genre, t.minutes, t.status, t.deadline])
    );
    dv.paragraph(`👉 [[${schedulePath}/${today}|今日のスケジュールを開く]]`);
}
