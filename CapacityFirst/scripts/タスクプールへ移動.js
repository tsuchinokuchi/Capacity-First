// QuickAdd User Script: タスクプールへ移動
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
    // QuickAddのAPIを取得
    const { app, quickAddApi } = params;

    // 設定
    const path = require('path');
    const basePath = app.vault.adapter.basePath;
    // Config path fitting the project structure
    const configPath = path.join(basePath, 'CapacityFirst', 'scripts', 'config.js');

    // Clear cache for local config
    if (require.cache && require.cache[configPath]) {
        delete require.cache[configPath];
    }

    let Config;
    try {
        Config = require(configPath);
    } catch (e) {
        console.error("Config load error:", e);
        new Notice("Config file not found.");
        return;
    }

    const { PATHS, FILES } = Config;

    // Use POOL path from config, with fallback logic if needed (redundant if config is correct)
    let poolPathRelative = PATHS.POOL;
    // If PATHS.POOL includes BASE_PATH already (it does in config.js), we might need to handle it carefully.
    // config.js says: POOL: joinPath(BASE_PATH, "スケジュール/タスクプール.md") -> "CapacityFirst/スケジュール/タスクプール.md"
    // So it is already full path relative to vault root.
    const TASK_POOL_PATH = poolPathRelative || "CapacityFirst/スケジュール/タスクプール.md";
    const SCHEDULE_PATH = "CapacityFirst/" + (PATHS.SCHEDULE.includes("CapacityFirst") ? PATHS.SCHEDULE.replace("CapacityFirst/", "") : PATHS.SCHEDULE || "スケジュール");

    // ヘルパー関数: 日付のタスクを取得
    async function getDailyTasks(date) {
        const year = moment(date).format("YYYY");
        const month = moment(date).format("MM");
        const flatPath = `${SCHEDULE_PATH}/${date}.md`;
        const nestedPath = `${SCHEDULE_PATH}/${year}/${month}/${date}.md`;

        let file = app.vault.getAbstractFileByPath(nestedPath);
        if (!file) file = app.vault.getAbstractFileByPath(flatPath);

        if (!file) return { file: null, tasks: [] };

        const content = await app.vault.read(file);
        const lines = content.split('\n');
        const tasks = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match tasks including those with duration
            if (line.match(/^- \[[ x]\] .+/)) {
                tasks.push({ text: line, lineIndex: i });
            }
        }

        return { file, tasks };
    }

    try {
        // 1. ソース日付の特定（アクティブファイル または 今日）
        let sourceDate = moment().format("YYYY-MM-DD");
        const activeFile = app.workspace.getActiveFile();
        if (activeFile && activeFile.basename.match(/^\d{4}-\d{2}-\d{2}$/)) {
            sourceDate = activeFile.basename;
        }

        // 2. タスクを取得
        const { file: sourceFile, tasks: todayTasks } = await getDailyTasks(sourceDate);

        if (!sourceFile || todayTasks.length === 0) {
            new Notice(`${sourceDate} にタスクがありません`);
            return;
        }

        // 3. 移動するタスクを選択
        const taskLabels = todayTasks.map(t => {
            // 表示用に少し整形
            return t.text;
        });

        const selectedTaskLabel = await quickAddApi.suggester(
            taskLabels,
            taskLabels
        );

        if (!selectedTaskLabel) {
            new Notice("タスクが選択されていません");
            return;
        }

        const selectedTask = todayTasks.find(t => t.text === selectedTaskLabel);
        if (!selectedTask) {
            new Notice("エラー: タスクが見つかりませんでした");
            return;
        }

        // 4. タスクプールに追加
        // タスクプールファイルを取得
        // Note: TASK_POOL_PATH might need adjustment if it's relative or absolute in config
        // Let's try to find it.
        let poolFile = app.vault.getAbstractFileByPath(TASK_POOL_PATH);

        // Fallback search if path in config is just relative to CapacityFirst root or vault root improperly
        if (!poolFile) {
            // Try searching for "タスクプール.md"
            const files = app.vault.getFiles();
            poolFile = files.find(f => f.name === 'タスクプール.md' && f.path.includes('CapacityFirst'));
        }

        if (!poolFile) {
            new Notice("タスクプールファイルが見つかりません: " + TASK_POOL_PATH);
            return;
        }

        // タスクのクリーニング（日付タグなどを削除）
        let cleanTaskText = selectedTask.text
            .replace(/📅 \d{4}-\d{2}-\d{2}/, "") // Remove date tag
            .trim();

        // チェックボックスの状態を未完了に戻す（オプション：完了したものをプールに戻すことは稀だが）
        cleanTaskText = cleanTaskText.replace(/^- \[[x]\]/, "- [ ]");

        const poolContent = await app.vault.read(poolFile);
        await app.vault.modify(poolFile, poolContent + "\n" + cleanTaskText);

        // 5. 元のファイルから削除
        const sourceContent = await app.vault.read(sourceFile);
        const sourceLines = sourceContent.split('\n');

        // 削除対象の行を特定（内容で検索するよりインデックスが安全だが、ファイルの変更がない前提）
        // 再読込して確認したほうが安全だが、今回は簡略化のためインデックス利用
        // ただし、lines配列は変えていないので、splitしなおして削除
        if (sourceLines[selectedTask.lineIndex] === selectedTask.text) {
            sourceLines.splice(selectedTask.lineIndex, 1);
            await app.vault.modify(sourceFile, sourceLines.join('\n'));
            new Notice(`✅ タスクをプールに移動しました: ${cleanTaskText.replace("- [ ] ", "")}`);
        } else {
            new Notice("⚠️ ファイルが変更されたため、削除に失敗しました。移動は手動で行ってください。");
        }

    } catch (error) {
        new Notice(`エラー: ${error.message}`);
        console.error(error);
    }
};
