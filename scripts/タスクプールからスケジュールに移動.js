// QuickAdd User Script: タスクプールからスケジュールに移動
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  const path = require('path');
  const basePath = app.vault.adapter.basePath;
  const configPath = path.join(basePath, 'scripts', 'config.js');
  const Config = require(configPath);
  const { PATHS, FILES, SETTINGS } = Config;

  const TASK_POOL_PATH = "タスクプール/タスクプール.md";
  const SCHEDULE_PATH = PATHS.SCHEDULE;
  const CONFIG_PATH = FILES.SETTINGS;
  const DEFAULT_MAX_DAILY_MINUTES = SETTINGS.DEFAULT_MAX_DAILY_MINUTES;
  let maxDailyMinutes = DEFAULT_MAX_DAILY_MINUTES;

  // 設定ファイルを読み込む
  async function loadSettings() {
    try {
      const configFile = app.vault.getAbstractFileByPath(CONFIG_PATH);
      if (!configFile) return;

      const content = await app.vault.read(configFile);
      const config = JSON.parse(content);
      if (Number.isFinite(config.maxDailyMinutes)) {
        maxDailyMinutes = config.maxDailyMinutes;
      }
    } catch (error) {
      console.error("設定ファイルの読み込みエラー:", error);
    }
  }

  // ヘルパー関数: タスクプールからタスクを取得
  async function getPoolTasks() {
    const poolFile = app.vault.getAbstractFileByPath(TASK_POOL_PATH);
    if (!poolFile) {
      return [];
    }

    const content = await app.vault.read(poolFile);
    const lines = content.split('\n');
    const tasks = [];

    for (const line of lines) {
      // チェックボックス付きのタスク行を抽出
      if (line.match(/^- \[ \] .+/)) {
        const taskText = line.replace(/^- \[ \] /, '').trim();
        tasks.push({ text: taskText, fullLine: line });
      }
    }

    return tasks;
  }

  // ヘルパー関数: 日付のタスクを取得
  async function getDailyTasks(date) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);

    if (!file) return [];

    const content = await app.vault.read(file);
    const lines = content.split('\n');
    const tasks = [];

    for (const line of lines) {
      if (line.match(/^- \[[ x]\] .+ ⏱️ \d+/)) {
        const durationMatch = line.match(/⏱️ (\d+)/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
        tasks.push({ text: line, duration });
      }
    }

    return tasks;
  }

  // ヘルパー関数: 容量チェック
  async function checkCapacity(date, newDuration) {
    const tasks = await getDailyTasks(date);
    const totalMinutes = tasks.reduce((sum, t) => sum + t.duration, 0);
    const newTotal = totalMinutes + newDuration;

    return {
      total: totalMinutes,
      available: maxDailyMinutes - totalMinutes,
      newTotal: newTotal,
      willExceed: newTotal > maxDailyMinutes
    };
  }

  try {
    await loadSettings();

    // 1. タスクプールからタスクを取得
    const poolTasks = await getPoolTasks();

    if (poolTasks.length === 0) {
      new Notice("タスクプールにタスクがありません");
      return;
    }

    // 2. 移動するタスクを選択
    const taskLabels = poolTasks.map(t => t.text);
    const selectedTaskLabel = await quickAddApi.suggester(
      taskLabels,
      taskLabels
    );

    if (!selectedTaskLabel) {
      new Notice("タスクが選択されていません");
      return;
    }

    const selectedTask = poolTasks.find(t => t.text === selectedTaskLabel);
    if (!selectedTask) {
      new Notice("選択したタスクが見つかりません");
      return;
    }

    // 3. 所要時間を抽出（⏱️ 60 形式）
    const durationMatch = selectedTask.text.match(/⏱️ (\d+)/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;

    if (duration === 0) {
      new Notice("タスクに所要時間が設定されていません（⏱️ 形式）");
      return;
    }

    // 4. 日付を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const dateInput = await quickAddApi.inputPrompt(
      "日付を入力してください (YYYY-MM-DD) - 空白の場合は今日",
      today
    );

    const inputDate = dateInput.trim() || today;
    const date = moment(inputDate, "YYYY-MM-DD");
    if (!date.isValid()) {
      new Notice("無効な日付形式です。YYYY-MM-DD形式で入力してください");
      return;
    }
    const dateStr = date.format("YYYY-MM-DD");

    // 5. 容量チェック
    const capacity = await checkCapacity(dateStr, duration);

    if (capacity.willExceed) {
      const shouldContinue = await quickAddApi.yesNoPrompt(
        `⚠️ 容量超過警告\n\n` +
        `現在の使用量: ${capacity.total}分\n` +
        `追加後の使用量: ${capacity.newTotal}分\n` +
        `上限: ${maxDailyMinutes}分\n\n` +
        `このまま続行しますか？`
      );

      if (!shouldContinue) {
        new Notice("タスクの移動をキャンセルしました");
        return;
      }
    }

    // 6. スケジュールファイルにタスクを追加
    const filePath = `${SCHEDULE_PATH}/${dateStr}.md`;
    let file = app.vault.getAbstractFileByPath(filePath);

    if (!file) {
      file = await app.vault.create(filePath, `## 今日のスケジュール\n\n`);
    }

    // タスク行を作成（日付を追加）
    let taskLine = selectedTask.text;
    if (!taskLine.includes(`📅 ${dateStr}`)) {
      taskLine = `- [ ] ${taskLine} 📅 ${dateStr}`;
    } else {
      taskLine = `- [ ] ${taskLine}`;
    }
    taskLine += '\n';

    // ファイルに追加
    const content = await app.vault.read(file);
    const newContent = content + taskLine;
    await app.vault.modify(file, newContent);

    // 7. タスクプールから削除
    const poolFile = app.vault.getAbstractFileByPath(TASK_POOL_PATH);
    const poolContent = await app.vault.read(poolFile);
    const newPoolContent = poolContent.replace(selectedTask.fullLine + '\n', '');
    await app.vault.modify(poolFile, newPoolContent);

    // 成功メッセージ
    const message = capacity.willExceed
      ? `✅ タスクをスケジュールに移動しました（容量超過警告あり）\n使用量: ${capacity.newTotal}分 / ${maxDailyMinutes}分`
      : `✅ タスクをスケジュールに移動しました\n使用量: ${capacity.newTotal}分 / ${maxDailyMinutes}分`;

    new Notice(message, 3000);

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

