// QuickAdd Macro: タスクを次の日に移動（出勤日連動）
// 使い方: QuickAddの設定画面でこのMacroを追加

module.exports = async (params) => {
  const { app, quickAddApi } = params;

  // 設定
  const SCHEDULE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/スケジュール";
  const WORK_GRID_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/週勤務グリッド.md";
  const CONFIG_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/config/settings.json";
  const DEFAULT_MAX_DAILY_MINUTES = 360;
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

  // ヘルパー関数: 出勤日リストを取得
  async function getWorkDays() {
    const file = app.vault.getAbstractFileByPath(WORK_GRID_PATH);
    if (!file) return [];
    
    const content = await app.vault.read(file);
    // 週勤務グリッドから出勤日を抽出
    // 実装は週勤務グリッドの構造に依存
    // とりあえず、今日から2週間先までの日付を返す
    const workDays = [];
    const today = moment();
    for (let i = 0; i < 14; i++) {
      const date = moment(today).add(i, 'days');
      workDays.push(date.format("YYYY-MM-DD"));
    }
    
    // TODO: 週勤務グリッドから実際の出勤日を抽出する処理を実装
    return workDays;
  }

  // ヘルパー関数: 次の出勤日を検索
  async function findNextWorkDay(startDate) {
    const workDays = await getWorkDays();
    const start = moment(startDate);
    
    for (let i = 1; i <= 14; i++) {
      const nextDate = moment(start).add(i, 'days');
      const dateStr = nextDate.format("YYYY-MM-DD");
      if (workDays.includes(dateStr)) {
        return dateStr;
      }
    }
    
    return null;
  }

  // ヘルパー関数: 日付のタスクを取得
  async function getDailyTasks(date) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    
    if (!file) return [];
    
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    const tasks = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^- \[[ x]\] .+ ⏱️ \d+/)) {
        const durationMatch = line.match(/⏱️ (\d+)/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
        tasks.push({ text: line, duration, lineIndex: i });
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
    
    // 現在のファイルからタスクを選択（または、今日のタスク一覧から選択）
    const today = moment().format("YYYY-MM-DD");
    const todayTasks = await getDailyTasks(today);
    
    if (todayTasks.length === 0) {
      new Notice("今日のタスクがありません");
      return;
    }
    
    // タスクを選択
    const taskLabels = todayTasks.map(t => {
      const taskName = t.text
        .replace(/^- \[[ x]\] /, "")
        .replace(/⏱️ \d+/, "")
        .replace(/📅 \d{4}-\d{2}-\d{2}/, "")
        .replace(/#\w+/g, "")
        .trim();
      return `${taskName} (${t.duration}分)`;
    });
    
    const selectedTask = await quickAddApi.suggester(
      taskLabels,
      todayTasks
    );
    
    if (!selectedTask) {
      new Notice("タスクが選択されていません");
      return;
    }
    
    // 次の出勤日を検索
    const nextWorkDay = await findNextWorkDay(today);
    
    if (!nextWorkDay) {
      new Notice("次の出勤日が見つかりません");
      return;
    }
    
    // 容量チェック
    const capacity = await checkCapacity(nextWorkDay, selectedTask.duration);
    
    if (capacity.willExceed) {
      const shouldContinue = await quickAddApi.yesNoPrompt(
        `⚠️ 容量超過警告\n\n` +
        `移動先: ${nextWorkDay}\n` +
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
    
    // 今日のファイルからタスクを削除
    const todayFilePath = `${SCHEDULE_PATH}/${today}.md`;
    const todayFile = app.vault.getAbstractFileByPath(todayFilePath);
    if (todayFile) {
      const todayContent = await app.vault.read(todayFile);
      const todayLines = todayContent.split('\n');
      todayLines.splice(selectedTask.lineIndex, 1);
      await app.vault.modify(todayFile, todayLines.join('\n'));
    }
    
    // 次の日のファイルにタスクを追加
    const nextFilePath = `${SCHEDULE_PATH}/${nextWorkDay}.md`;
    let nextFile = app.vault.getAbstractFileByPath(nextFilePath);
    
    if (!nextFile) {
      nextFile = await app.vault.create(nextFilePath, `## 今日のスケジュール\n\n`);
    }
    
    // 日付を更新したタスク行を作成
    const taskText = selectedTask.text.replace(
      /📅 \d{4}-\d{2}-\d{2}/,
      `📅 ${nextWorkDay}`
    );
    
    const nextContent = await app.vault.read(nextFile);
    const newNextContent = nextContent + taskText + '\n';
    await app.vault.modify(nextFile, newNextContent);
    
    // 成功メッセージ
    new Notice(`✅ タスクを ${nextWorkDay} に移動しました`, 3000);
    
  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

