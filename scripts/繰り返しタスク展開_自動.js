// QuickAdd User Script: 繰り返しタスク展開（自動実行用）
// 月初に来月分を自動展開
// runOnStartup: true で設定すること

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;
  
  // 設定
  const SCHEDULE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/スケジュール";
  const DAILY_TASKS_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/繰り返しタスク/毎日.md";
  const WEEKLY_TASKS_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/繰り返しタスク/毎週.md";
  const MONTHLY_TASKS_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/繰り返しタスク/毎月.md";
  const LAST_EXECUTED_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/.last_monthly_expand";
  
  // キーワード定義（出勤日判定用）
  const workKeywords = [/勤務/, /出勤/];
  
  // ヘルパー関数: 最後に実行された月を取得
  async function getLastExecutedMonth() {
    const file = app.vault.getAbstractFileByPath(LAST_EXECUTED_PATH);
    if (!file) return null;
    
    try {
      const content = await app.vault.read(file);
      return content.trim();
    } catch (error) {
      return null;
    }
  }
  
  // ヘルパー関数: 最後に実行された月を保存
  async function saveLastExecutedMonth(monthStr) {
    let file = app.vault.getAbstractFileByPath(LAST_EXECUTED_PATH);
    if (!file) {
      file = await app.vault.create(LAST_EXECUTED_PATH, monthStr);
    } else {
      await app.vault.modify(file, monthStr);
    }
  }
  
  // ヘルパー関数: 出勤日リストを取得（スケジュールフォルダから）
  async function getWorkDays(startDate, days = 31) {
    const workDays = [];
    const start = moment(startDate);
    
    for (let i = 0; i < days; i++) {
      const date = moment(start).add(i, 'days');
      const dateStr = date.format("YYYY-MM-DD");
      const filePath = `${SCHEDULE_PATH}/${dateStr}.md`;
      const file = app.vault.getAbstractFileByPath(filePath);
      
      if (file) {
        const content = await app.vault.read(file);
        const lines = content.split('\n');
        // 「勤務」や「出勤」を含むタスクがあるかチェック
        const hasWork = lines.some(line => 
          workKeywords.some(keyword => keyword.test(line))
        );
        if (hasWork) {
          workDays.push(dateStr);
        }
      }
    }
    
    return workDays;
  }
  
  // ヘルパー関数: 繰り返しタスク定義ファイルからタスクを読み込む
  async function loadRecurringTasks(filePath) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) return [];
    
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    const tasks = [];
    
    for (const line of lines) {
      // タスク行を抽出（- [ ] で始まる行）
      const taskMatch = line.match(/^-\s+\[([ x])\]\s+(.+)$/);
      if (!taskMatch) continue;
      
      const isCompleted = taskMatch[1] === 'x';
      const taskText = taskMatch[2].trim();
      
      // コメントや説明行はスキップ
      if (taskText.startsWith('<!--') || taskText.length === 0) continue;
      
      // タスクのメタデータを抽出
      const durationMatch = taskText.match(/⏱️\s+(\d+)/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
      
      // タスク行をそのまま保存（メタデータ付き）
      tasks.push({
        text: taskText,
        line: line.trim(),
        duration: duration,
        isCompleted: isCompleted
      });
    }
    
    return tasks;
  }
  
  // ヘルパー関数: タスクが既に存在するかチェック
  async function taskExists(date, taskText) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) return false;
    
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    
    // タスク名を抽出（メタデータを除く）
    const taskName = taskText
      .replace(/^- \[[ x]\] /, "")
      .replace(/⏱️ \d+/, "")
      .replace(/📅 \d{4}-\d{2}-\d{2}/, "")
      .replace(/#\w+/g, "")
      .replace(/🔁.*$/, "")
      .trim();
    
    return lines.some(line => {
      if (!line.match(/^- \[[ x]\] .+ ⏱️ \d+/)) return false;
      const existingName = line
        .replace(/^- \[[ x]\] /, "")
        .replace(/⏱️ \d+/, "")
        .replace(/📅 \d{4}-\d{2}-\d{2}/, "")
        .replace(/#\w+/g, "")
        .trim();
      return existingName === taskName;
    });
  }
  
  // ヘルパー関数: タスクを日付に追加
  async function addTaskToDate(date, taskLine) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    let file = app.vault.getAbstractFileByPath(filePath);
    
    // ファイルが存在しない場合は作成
    if (!file) {
      file = await app.vault.create(filePath, `## 今日のスケジュール\n\n`);
    }
    
    // 日付を更新したタスク行を作成（🔁マーカーを削除）
    const taskText = taskLine
      .replace(/🔁.*$/, "") // 繰り返しマーカーを削除
      .replace(/📅 \d{4}-\d{2}-\d{2}/, `📅 ${date}`) // 日付を更新
      .trim();
    
    // ファイルに追加
    const content = await app.vault.read(file);
    const newContent = content + (content.endsWith('\n') ? '' : '\n') + taskText + '\n';
    await app.vault.modify(file, newContent);
  }
  
  try {
    // 今日の日付を取得
    const today = moment();
    const currentMonth = today.format("YYYY-MM");
    
    // 最後に実行された月を取得
    const lastExecutedMonth = await getLastExecutedMonth();
    
    // 今月が既に実行済みならスキップ
    if (lastExecutedMonth === currentMonth) {
      // サイレントに終了（通知なし）
      return;
    }
    
    // 来月の期間を決定
    const nextMonth = moment(today).add(1, 'month');
    const startDate = moment(nextMonth).startOf('month');
    const endDate = moment(nextMonth).endOf('month');
    
    // 出勤日リストを取得（来月分）
    const workDays = await getWorkDays(startDate.format("YYYY-MM-DD"), endDate.diff(startDate, 'days') + 1);
    
    // 繰り返しタスクを読み込む
    const dailyTasks = await loadRecurringTasks(DAILY_TASKS_PATH);
    const weeklyTasks = await loadRecurringTasks(WEEKLY_TASKS_PATH);
    const monthlyTasks = await loadRecurringTasks(MONTHLY_TASKS_PATH);
    
    if (dailyTasks.length === 0 && weeklyTasks.length === 0 && monthlyTasks.length === 0) {
      // 繰り返しタスクが定義されていない場合は実行済みとして記録
      await saveLastExecutedMonth(currentMonth);
      return;
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    // 毎日のタスクを展開
    for (const task of dailyTasks) {
      if (task.isCompleted) continue;
      
      let current = moment(startDate);
      while (current.isSameOrBefore(endDate)) {
        const dateStr = current.format("YYYY-MM-DD");
        
        if (workDays.includes(dateStr)) {
          const exists = await taskExists(dateStr, task.text);
          if (!exists) {
            await addTaskToDate(dateStr, task.line);
            addedCount++;
          } else {
            skippedCount++;
          }
        }
        
        current.add(1, 'day');
      }
    }
    
    // 毎週のタスクを展開
    for (const task of weeklyTasks) {
      if (task.isCompleted) continue;
      
      // 曜日を抽出（例: every Monday）
      const dayMatch = task.text.match(/🔁\s*every\s+(\w+)/i);
      if (!dayMatch) continue;
      
      const dayName = dayMatch[1].toLowerCase();
      const dayMap = {
        'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
        'friday': 5, 'saturday': 6, 'sunday': 0
      };
      const targetDay = dayMap[dayName];
      if (targetDay === undefined) continue;
      
      let current = moment(startDate);
      while (current.isSameOrBefore(endDate)) {
        if (current.day() === targetDay) {
          const dateStr = current.format("YYYY-MM-DD");
          if (workDays.includes(dateStr)) {
            const exists = await taskExists(dateStr, task.text);
            if (!exists) {
              await addTaskToDate(dateStr, task.line);
              addedCount++;
            } else {
              skippedCount++;
            }
          }
        }
        current.add(1, 'day');
      }
    }
    
    // 毎月のタスクを展開
    for (const task of monthlyTasks) {
      if (task.isCompleted) continue;
      
      // 日付を抽出（例: every month on the 1st）
      const dateMatch = task.text.match(/🔁\s*every\s+month\s+on\s+the\s+(\d+)(?:st|nd|rd|th)?/i);
      if (!dateMatch) continue;
      
      const targetDayOfMonth = parseInt(dateMatch[1]);
      
      // 来月の該当日をチェック
      const targetDate = moment(nextMonth).date(targetDayOfMonth);
      if (targetDate.isValid() && targetDate.isSameOrBefore(endDate)) {
        const dateStr = targetDate.format("YYYY-MM-DD");
        if (workDays.includes(dateStr)) {
          const exists = await taskExists(dateStr, task.text);
          if (!exists) {
            await addTaskToDate(dateStr, task.line);
            addedCount++;
          } else {
            skippedCount++;
          }
        }
      }
    }
    
    // 実行済みとして記録
    await saveLastExecutedMonth(currentMonth);
    
    // 結果を表示（追加された場合のみ）
    if (addedCount > 0) {
      new Notice(`✅ 来月分の繰り返しタスクを展開しました\n追加: ${addedCount}件, スキップ: ${skippedCount}件`, 5000);
    }
    
  } catch (error) {
    // エラーはコンソールに記録（通知は出さない）
    console.error("繰り返しタスク自動展開エラー:", error);
  }
};

