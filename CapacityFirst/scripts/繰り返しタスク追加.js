// QuickAdd User Script: 繰り返しタスク追加
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
    const { app, quickAddApi } = params;

    // 設定読み込み (Robust Local Load)
    const path = require('path');
    // Use vault base path to ensure correct absolute path resolution
    const basePath = app.vault.adapter.getBasePath();
    const configPath = path.join(basePath, 'CapacityFirst/scripts/config.js');
    if (require.cache && require.cache[configPath]) {
        delete require.cache[configPath];
    }
    const Config = require('./config');
    const { PATHS } = Config;

    const RECURRING_ROOT = `${PATHS.SCHEDULE}/繰り返しタスク`;

    const TYPES = [
        { label: "毎日", file: "毎日.md", icon: "🔁" },
        { label: "毎週", file: "毎週.md", icon: "📅" },
        { label: "毎月", file: "毎月.md", icon: "🗓️" }
    ];

    // 1. タイプの選択
    const selectedType = await quickAddApi.suggester(
        TYPES.map(t => `${t.icon} ${t.label}`),
        TYPES
    );
    if (!selectedType) return;

    // 2. タスク名の入力
    const taskName = await quickAddApi.inputPrompt("タスク名を入力してください");
    if (!taskName) return;

    // 3. 所要時間の入力
    const duration = await quickAddApi.inputPrompt("所要時間（分）", "30");
    if (!duration) return;

    let extraText = "";

    // 4. 追加設定 (毎週/毎月の場合)
    if (selectedType.label === "毎週") {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const selectedDay = await quickAddApi.suggester(days, days);
        if (!selectedDay) return;
        extraText = ` 🔁 every ${selectedDay}`;
    } else if (selectedType.label === "毎月") {
        const day = await quickAddApi.inputPrompt("日付（1-31）", "1");
        if (!day) return;
        extraText = ` 🔁 every month on the ${day}`;
    } else {
        // 毎日の場合
        extraText = " 🔁 every day";
    }

    // 5. ジャンル選択
    const GENRES = ["デスクワーク", "売場作業", "顧客対応", "定型作業", "学習", "健康", "趣味", "その他プライベート"];
    const genre = await quickAddApi.suggester(GENRES, GENRES);
    const genreTag = genre ? ` #${genre}` : "";

    // 6. ファイルへの書き込み
    const targetPath = `${RECURRING_ROOT}/${selectedType.label}/${selectedType.file}`;

    // フォルダ確認
    const targetFolder = `${RECURRING_ROOT}/${selectedType.label}`;
    if (!app.vault.getAbstractFileByPath(targetFolder)) {
        await app.vault.createFolder(targetFolder);
    }

    let file = app.vault.getAbstractFileByPath(targetPath);
    if (!file) {
        file = await app.vault.create(targetPath, "");
    }

    const taskLine = `- [ ] ${taskName}${genreTag} ⏱️ ${duration}${extraText}`;

    const content = await app.vault.read(file);
    const newContent = content + (content.endsWith("\n") ? "" : "\n") + taskLine;

    await app.vault.modify(file, newContent);

    new Notice(`✅ 繰り返しタスクを追加しました: ${selectedType.label}`);
};
