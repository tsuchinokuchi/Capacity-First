// QuickAdd User Script: 繰り返しタスク展開
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択
// 週始め（月曜日）や手動で実行して、繰り返しタスクを展開

module.exports = async (params) => {
  // QuickAddのAPIを取得
  // new Notice("Debug: Script Started 1.2"); // Check execution
  const { app, quickAddApi } = params;

  // 設定
  // 設定
  // 設定
  const path = require('path');
  // Use local config relative to this script
  // Use vault base path to ensure correct absolute path resolution
  const basePath = app.vault.adapter.getBasePath();
  const configPath = path.join(basePath, 'CapacityFirst/scripts/config.js');

  // Clear cache for local config
  if (require.cache && require.cache[configPath]) {
    delete require.cache[configPath];
  }

  const Config = require('./config');
  const { PATHS, FILES } = Config;

  const SCHEDULE_PATH = PATHS.SCHEDULE;
  const DAILY_TASKS_PATH = `${PATHS.SCHEDULE}/繰り返しタスク/毎日/毎日.md`;
  const WEEKLY_TASKS_PATH = `${PATHS.SCHEDULE}/繰り返しタスク/毎週/毎週.md`;
  const MONTHLY_TASKS_PATH = `${PATHS.SCHEDULE}/繰り返しタスク/毎月/毎月.md`;
  const WORK_GRID_PATH = FILES.WEEKLY_GRID;

  // キーワード定義（出勤日判定用）
  const workKeywords = [/勤務/, /出勤/];

  // ヘルパー関数: 出勤日リストを取得（スケジュールフォルダから）
  // 見つからない場合は、期間内のすべての日付を返す（初期状態やエラー回避のため）
  async function getWorkDays(startDate, days = 14) {
    const workDays = [];
    const allDays = [];
    const start = moment(startDate);

    for (let i = 0; i < days; i++) {
      const date = moment(start).add(i, 'days');
      const dateStr = date.format("YYYY-MM-DD");
      allDays.push(dateStr);

      const year = date.format("YYYY");
      const month = date.format("MM");
      const flatPath = `${SCHEDULE_PATH}/${dateStr}.md`;
      const nestedPath = `${SCHEDULE_PATH}/${year}/${month}/${dateStr}.md`;
      let file = app.vault.getAbstractFileByPath(flatPath);
      if (!file) file = app.vault.getAbstractFileByPath(nestedPath);

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

    // もし出勤日が1つも見つからない場合は、全ての日付を対象とする（フォールバック）
    if (workDays.length === 0) {
      // new Notice("Debug: No work days found, falling back to all days.");
      return allDays;
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

  // ヘルパー関数: 日付のタスクを取得
  async function getDailyTasks(date) {
    const year = moment(date).format("YYYY");
    const month = moment(date).format("MM");
    const flatPath = `${SCHEDULE_PATH}/${date}.md`;
    const nestedPath = `${SCHEDULE_PATH}/${year}/${month}/${date}.md`;

    let file = app.vault.getAbstractFileByPath(flatPath);
    if (!file) file = app.vault.getAbstractFileByPath(nestedPath);

    if (!file) return [];

    const content = await app.vault.read(file);
    const lines = content.split('\n');
    const tasks = [];

    for (const line of lines) {
      if (line.match(/^- \[[ x]\] .+ ⏱️ \d+/)) {
        tasks.push(line);
      }
    }

    return tasks;
  }

  // ヘルパー関数: タスクが既に存在するかチェック
  async function taskExists(date, taskText) {
    const existingTasks = await getDailyTasks(date);
    // タスク名を抽出（メタデータを除く）
    const taskName = taskText
      .replace(/^- \[[ x]\] /, "")
      .replace(/⏱️ \d+/, "")
      .replace(/📅 \d{4}-\d{2}-\d{2}/, "")
      .replace(/#\w+/g, "")
      .replace(/🔁.*$/, "")
      .trim();

    return existingTasks.some(existingTask => {
      const existingName = existingTask
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
    const year = moment(date).format("YYYY");
    const month = moment(date).format("MM");
    const flatPath = `${SCHEDULE_PATH}/${date}.md`;
    const nestedFolder = `${SCHEDULE_PATH}/${year}/${month}`;
    const nestedPath = `${nestedFolder}/${date}.md`;

    let file = app.vault.getAbstractFileByPath(flatPath);
    if (!file) file = app.vault.getAbstractFileByPath(nestedPath);

    // ファイルが存在しない場合は作成 (フラット構造で)
    if (!file) {
      file = await app.vault.create(flatPath, `## 今日のスケジュール\n\n`);
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
    // 展開期間を選択
    const periodOptions = [
      "今週（7日間）",
      "来週（7日間）",
      "2週間（14日間）",
      "今月（月末まで）"
    ];

    const selectedPeriod = await quickAddApi.suggester(
      periodOptions,
      periodOptions
    );

    if (!selectedPeriod) {
      new Notice("期間が選択されていません");
      return;
    }

    // 期間を決定
    const today = moment();
    let startDate, endDate;

    if (selectedPeriod.includes("今週")) {
      startDate = moment(today).startOf('week').add(1, 'day'); // 月曜日
      endDate = moment(startDate).add(6, 'days');
    } else if (selectedPeriod.includes("来週")) {
      startDate = moment(today).startOf('week').add(8, 'days'); // 来週月曜日
      endDate = moment(startDate).add(6, 'days');
    } else if (selectedPeriod.includes("2週間")) {
      startDate = moment(today).startOf('week').add(1, 'day'); // 今週月曜日
      endDate = moment(startDate).add(13, 'days');
    } else { // 今月
      startDate = moment(today);
      endDate = moment(today).endOf('month');
    }

    // 出勤日判定ロジック廃止（無条件で展開）
    // const workDays = await getWorkDays(startDate.format("YYYY-MM-DD"), endDate.diff(startDate, 'days') + 1);


    // 繰り返しタスクを読み込む
    // DEBUG:
    // new Notice(`Debug: Loading daily from ${DAILY_TASKS_PATH}`);
    const dailyTasks = await loadRecurringTasks(DAILY_TASKS_PATH);
    // new Notice(`Debug: Daily tasks found: ${dailyTasks.length}`);

    const weeklyTasks = await loadRecurringTasks(WEEKLY_TASKS_PATH);
    const monthlyTasks = await loadRecurringTasks(MONTHLY_TASKS_PATH);

    // new Notice(`Debug: Range ${startDate.format("YYYY-MM-DD")} - ${endDate.format("YYYY-MM-DD")}`);

    if (dailyTasks.length === 0 && weeklyTasks.length === 0 && monthlyTasks.length === 0) {
      new Notice(`繰り返しタスク定義が見つかりません:\n${DAILY_TASKS_PATH}`);
      return;
    }

    let addedCount = 0;
    let skippedCount = 0;

    // 毎日のタスクを展開
    for (const task of dailyTasks) {
      if (task.isCompleted) continue; // 完了済みはスキップ

      let current = moment(startDate);
      while (current.isSameOrBefore(endDate)) {
        const dateStr = current.format("YYYY-MM-DD");

        // 無条件で展開
        const exists = await taskExists(dateStr, task.text);
        if (!exists) {
          await addTaskToDate(dateStr, task.line);
          addedCount++;
        } else {
          skippedCount++;
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

      let current = moment(startDate);
      while (current.isSameOrBefore(endDate)) {
        if (current.date() === targetDayOfMonth) {
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

    // 結果を表示
    new Notice(`✅ 繰り返しタスクを展開しました\n追加: ${addedCount}件, スキップ: ${skippedCount}件`, 5000);

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

