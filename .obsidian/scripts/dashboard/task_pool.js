// scripts/dashboard/task_pool.js
// Default config matching repo structure
const config = {
    PATHS: {
        TASK_POOL: "03.ツェッテルカステン/030.データベース/タスク管理/タスクプール/タスクプール.md"
    }
};

const poolPath = config.PATHS.TASK_POOL;

try {
    const poolFile = dv.page(poolPath);
    if (!poolFile) {
        dv.paragraph("_タスクプールファイルが見つかりません_");
        return;
    }
    const poolTasks = poolFile.file.tasks
        .where(t => t.text.includes("⏱️") && !t.text.includes("📅"))
        .array();
    if (!poolTasks.length) {
        dv.paragraph("_未スケジュールのタスクはありません_");
        return;
    }
    dv.table(
        ["タスク", "ジャンル", "時間"],
        poolTasks.map(task => {
            const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
            const cleanName = task.text
                .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
                .replace(/⏱️ \d+/, '')
                .replace(/#\w+/g, '')
                .trim();
            const genreMatch = task.text.match(/#(\w+)/);
            return [cleanName, genreMatch ? genreMatch[1] : "-", `${duration}分`];
        })
    );
    dv.paragraph("💡 QuickAdd「タスクプールからスケジュールに移動」で日付へ配置できます。");
} catch (error) {
    dv.paragraph(`_タスクプールの読み込みに失敗しました_: ${error.message}`);
}
