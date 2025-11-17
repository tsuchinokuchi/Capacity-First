// QuickAdd User Script: サブタスク追加（日別タスクファイルに追加）
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;
  
  // 設定
  const SCHEDULE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/スケジュール";
  const CONFIG_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/config/settings.json";
  const DEFAULT_MAX_DAILY_MINUTES = 360;
  let maxDailyMinutes = DEFAULT_MAX_DAILY_MINUTES;
  
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
  
  // ジャンルリスト
  const GENRES = [
    "デスクワーク",
    "売場作業",
    "顧客対応",
    "定型作業",
    "学習",
    "健康",
    "趣味",
    "その他プライベート"
  ];
  
  // 所要時間オプション（15分単位）
  const DURATION_OPTIONS = [
    { label: "15分", value: 15 },
    { label: "30分", value: 30 },
    { label: "45分", value: 45 },
    { label: "60分", value: 60 },
    { label: "90分", value: 90 },
    { label: "120分", value: 120 },
    { label: "150分", value: 150 },
    { label: "180分", value: 180 },
    { label: "240分", value: 240 },
    { label: "300分", value: 300 },
    { label: "360分", value: 360 }
  ];
  
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
  
  await loadSettings();
  
  // タスク名を入力
  const taskName = await quickAddApi.inputPrompt('タスク名を入力してください:');
  if (!taskName) return;
  
  // ジャンルを選択
  const selectedGenre = await quickAddApi.suggester(
    GENRES,
    GENRES,
    'ジャンルを選択してください:'
  );
  if (!selectedGenre) return;
  
  // 所要時間を選択
  const selectedDuration = await quickAddApi.suggester(
    DURATION_OPTIONS.map(opt => opt.label),
    DURATION_OPTIONS,
    '所要時間を選択してください:'
  );
  if (!selectedDuration) return;
  const duration = selectedDuration.value;
  
  // 実施予定日を入力（必須）
  const today = moment().format("YYYY-MM-DD");
  const dateInput = await quickAddApi.inputPrompt(
    `実施予定日を入力してください (YYYY-MM-DD、空白の場合は今日: ${today}):`,
    today
  );
  
  const inputDate = (dateInput && dateInput.trim()) || today;
  
  // 日付の妥当性チェック
  const date = moment(inputDate, "YYYY-MM-DD");
  if (!date.isValid()) {
    new Notice("無効な日付形式です。YYYY-MM-DD形式で入力してください");
    return;
  }
  const dateStr = date.format("YYYY-MM-DD");
  
  // 締切日を入力（オプション）
  const deadlineInput = await quickAddApi.inputPrompt(
    "締切日を入力してください (YYYY-MM-DD) - 空白の場合は締切なし",
    ""
  );
  
  let deadlineStr = "";
  if (deadlineInput && deadlineInput.trim()) {
    const deadline = moment(deadlineInput.trim(), "YYYY-MM-DD");
    if (deadline.isValid()) {
      deadlineStr = ` ⏰ ${deadline.format("YYYY-MM-DD")}`;
    } else {
      new Notice("無効な締切日形式です。スキップします");
    }
  }
  
  // 容量チェック
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
      new Notice("タスクの追加をキャンセルしました");
      return;
    }
  }
  
  // 日別タスクファイルに追加
  const filePath = `${SCHEDULE_PATH}/${dateStr}.md`;
  let file = app.vault.getAbstractFileByPath(filePath);
  
  // ファイルが存在しない場合は作成
  if (!file) {
    file = await app.vault.create(filePath, `## 今日のスケジュール\n\n`);
  }
  
  // タスク行を作成
  const taskLine = `- [ ] ${taskName} #${selectedGenre} ⏱️ ${duration} 📅 ${dateStr}${deadlineStr}\n`;
  
  // ファイルに追加
  const content = await app.vault.read(file);
  const newContent = content + taskLine;
  await app.vault.modify(file, newContent);
  
  // 成功メッセージ
  const message = capacity.willExceed 
    ? `✅ サブタスクを追加しました（容量超過警告あり）\n使用量: ${capacity.newTotal}分 / ${maxDailyMinutes}分`
    : `✅ サブタスクを追加しました\n使用量: ${capacity.newTotal}分 / ${maxDailyMinutes}分`;
  
  new Notice(message, 3000);
};

