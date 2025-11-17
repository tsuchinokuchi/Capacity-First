// QuickAdd User Script: 容量チェック
// 現在のスケジュールファイルの容量使用状況を表示

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;
  
  // 設定
  const SCHEDULE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/スケジュール";
  const CONFIG_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/config/settings.json";
  const DEFAULT_MAX_DAILY_MINUTES = 360; // 6時間
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
  
  // ヘルパー関数: 日付のタスクを取得
  async function getDailyTasks(date) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    
    if (!file) return [];
    
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    const tasks = [];
    
    for (const line of lines) {
      // 新しいフォーマット: ⏱️ を含むタスク
      if (line.match(/^- \[[ x]\] .+ ⏱️ \d+/)) {
        const durationMatch = line.match(/⏱️ (\d+)/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
        const genreMatch = line.match(/#(\w+)/);
        const genre = genreMatch ? genreMatch[1] : '未分類';
        tasks.push({ text: line, duration, genre });
      }
    }
    
    return tasks;
  }
  
  try {
    await loadSettings();
    
    // 現在開いているファイルの日付を取得
    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("ファイルが開かれていません");
      return;
    }
    
    // ファイル名から日付を抽出
    const fileName = activeFile.basename;
    const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
    
    if (!dateMatch) {
      new Notice("スケジュールファイルを開いてください（YYYY-MM-DD形式）");
      return;
    }
    
    const dateStr = dateMatch[1];
    
    // タスクを取得
    const tasks = await getDailyTasks(dateStr);
    
    if (tasks.length === 0) {
      new Notice(`📅 ${dateStr}\nタスクがありません`, 3000);
      return;
    }
    
    // 容量計算
    const totalMinutes = tasks.reduce((sum, t) => sum + t.duration, 0);
    const available = maxDailyMinutes - totalMinutes;
    const usagePercent = Math.round((totalMinutes / maxDailyMinutes) * 100);
    
    // ジャンル別集計
    const genreBreakdown = {};
    tasks.forEach(t => {
      genreBreakdown[t.genre] = (genreBreakdown[t.genre] || 0) + t.duration;
    });
    
    // メッセージを作成
    let message = `📅 ${dateStr}\n\n`;
    message += `**容量使用状況**\n`;
    message += `${totalMinutes}分 / ${maxDailyMinutes}分 (${usagePercent}%)\n`;
    message += `残り: ${available}分\n\n`;
    
    if (Object.keys(genreBreakdown).length > 0) {
      message += `**ジャンル別**\n`;
      for (const [genre, minutes] of Object.entries(genreBreakdown)) {
        const percent = Math.round((minutes / totalMinutes) * 100);
        message += `${genre}: ${minutes}分 (${percent}%)\n`;
      }
    }
    
    // 通知を表示（長時間表示）
    new Notice(message, 8000);
    
  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

