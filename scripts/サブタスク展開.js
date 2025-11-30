// QuickAdd User Script: サブタスク展開
// プロジェクトのサブタスクを日次タスクに展開

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  // 設定
  const Config = require('./config');
  const { PATHS, FILES, SETTINGS } = Config;

  const PROJECT_PATH = PATHS.PROJECT;
  const SCHEDULE_PATH = PATHS.SCHEDULE;
  const CONFIG_PATH = FILES.SETTINGS;
  const DEFAULT_MAX_DAILY_MINUTES = SETTINGS.DEFAULT_MAX_DAILY_MINUTES;
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

  // キーワード定義（出勤日判定用）
  const workKeywords = [/勤務/, /出勤/];

  // ヘルパー関数: 出勤日リストを取得
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

  // ヘルパー関数: タスクが既に存在するかチェック
  async function taskExists(date, taskText) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) return false;

    const content = await app.vault.read(file);
    const lines = content.split('\n');

    const taskName = taskText
      .replace(/^- \[[ x]\] /, "")
      .replace(/⏱️ \d+/, "")
      .replace(/📅 \d{4}-\d{2}-\d{2}/, "")
      .replace(/#\w+/g, "")
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

  // ヘルパー関数: 日付のタスクを取得（容量チェック用）
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

  // ヘルパー関数: タスクを日付に追加
  async function addTaskToDate(date, taskLine) {
    const filePath = `${SCHEDULE_PATH}/${date}.md`;
    let file = app.vault.getAbstractFileByPath(filePath);

    if (!file) {
      file = await app.vault.create(filePath, `## 今日のスケジュール\n\n`);
    }

    const taskText = taskLine.trim();
    const content = await app.vault.read(file);
    const newContent = content + (content.endsWith('\n') ? '' : '\n') + taskText + '\n';
    await app.vault.modify(file, newContent);
  }

  // ヘルパー関数: プロジェクトファイルを読み込む
  async function loadProject(projectPath) {
    const file = app.vault.getAbstractFileByPath(projectPath);
    if (!file) return null;

    let content = await app.vault.read(file);

    // DataviewJSブロックを除外
    content = content.replace(/```dataviewjs[\s\S]*?```/g, '');

    const lines = content.split('\n');

    const project = {
      name: '',
      startDate: '',
      endDate: '',
      subtasks: []
    };

    let currentSubtask = null;
    let inSubtasksSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // プロジェクト名
      if (line.match(/^#\s+(.+)$/)) {
        project.name = line.replace(/^#\s+/, '').trim();
      }

      // 開始日
      if (line.match(/開始:\s*(\d{4}-\d{2}-\d{2})/)) {
        project.startDate = line.match(/開始:\s*(\d{4}-\d{2}-\d{2})/)[1];
      }

      // 終了日
      if (line.match(/終了:\s*(\d{4}-\d{2}-\d{2})/)) {
        project.endDate = line.match(/終了:\s*(\d{4}-\d{2}-\d{2})/)[1];
      }

      // サブタスクセクションの開始
      if (line.match(/^##\s+サブタスク/)) {
        inSubtasksSection = true;
        continue;
      }

      // 次のセクション（サブタスクセクションの終了）
      if (inSubtasksSection && line.match(/^##\s+/)) {
        if (currentSubtask) {
          project.subtasks.push(currentSubtask);
          currentSubtask = null;
        }
        inSubtasksSection = false;
        continue;
      }

      // サブタスクの見出し（### サブタスク名）
      if (inSubtasksSection && line.match(/^###\s+(.+)$/)) {
        if (currentSubtask) {
          project.subtasks.push(currentSubtask);
        }
        currentSubtask = {
          name: line.replace(/^###\s+/, '').trim(),
          tasks: []
        };
        continue;
      }

      // タスク行（- [ ] で始まる行）
      if (inSubtasksSection && currentSubtask && line.match(/^-\s+\[[ x]\]\s+(.+)$/)) {
        const taskText = line.replace(/^-\s+\[[ x]\]\s+/, '').trim();
        const isCompleted = line.match(/^-\s+\[x\]/);

        // 日付を抽出
        const dateMatch = taskText.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
        const taskDate = dateMatch ? dateMatch[1] : null;

        // 所要時間を抽出
        const durationMatch = taskText.match(/⏱️\s*(\d+)/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;

        currentSubtask.tasks.push({
          text: taskText,
          line: line.trim(),
          date: taskDate,
          duration: duration,
          isCompleted: isCompleted
        });
      }
    }

    // 最後のサブタスクを追加
    if (currentSubtask) {
      project.subtasks.push(currentSubtask);
    }

    return project;
  }

  try {
    await loadSettings();

    // プロジェクトファイル一覧を取得
    const projectFiles = app.vault.getFiles()
      .filter(file => file.path.startsWith(PROJECT_PATH) && file.path.endsWith('.md') && !file.name.includes('README') && !file.name.includes('テンプレート'));

    if (projectFiles.length === 0) {
      new Notice("プロジェクトファイルが見つかりません");
      return;
    }

    // プロジェクトを選択
    const projectNames = projectFiles.map(f => f.name.replace('.md', ''));
    const selectedProjectName = await quickAddApi.suggester(
      projectNames,
      projectNames
    );

    if (!selectedProjectName) {
      new Notice("プロジェクトが選択されていません");
      return;
    }

    const selectedFile = projectFiles.find(f => f.name.replace('.md', '') === selectedProjectName);
    if (!selectedFile) {
      new Notice("プロジェクトファイルが見つかりません");
      return;
    }

    // プロジェクトを読み込む
    const project = await loadProject(selectedFile.path);
    if (!project) {
      new Notice("プロジェクトの読み込みに失敗しました");
      return;
    }

    console.log('プロジェクト読み込み結果:', project);

    if (!project.startDate || !project.endDate) {
      new Notice(`プロジェクトの期間が設定されていません。開始: ${project.startDate}, 終了: ${project.endDate}`);
      return;
    }

    if (!project.subtasks || project.subtasks.length === 0) {
      new Notice("プロジェクトにサブタスクがありません");
      return;
    }

    // 展開期間を決定
    const startDate = moment(project.startDate);
    const endDate = moment(project.endDate);

    // 出勤日リストを取得
    const daysDiff = endDate.diff(startDate, 'days') + 1;
    const workDays = await getWorkDays(startDate.format("YYYY-MM-DD"), daysDiff);
    console.log(`出勤日リスト (${workDays.length}日):`, workDays);

    let addedCount = 0;
    let skippedCount = 0;
    let capacityExceededCount = 0;

    // 各サブタスクのタスクを展開
    for (const subtask of project.subtasks) {
      for (const task of subtask.tasks) {
        if (task.isCompleted) continue; // 完了済みはスキップ

        // 日付が指定されている場合はその日付を使用
        let targetDate = task.date ? moment(task.date) : null;

        // 日付が指定されている場合、期間内かチェック
        if (targetDate) {
          if (targetDate.isBefore(startDate) || targetDate.isAfter(endDate)) {
            // 期間外の場合は開始日から順に割り当て
            targetDate = moment(startDate);
          }
        } else {
          // 日付が指定されていない場合は開始日から順に割り当て
          targetDate = moment(startDate);
        }

        // 日付を出勤日に合わせて調整
        let assigned = false;
        let currentDate = moment(targetDate);

        // 日付が指定されている場合、その日付以降の最初の出勤日を探す
        // 日付が指定されていない場合、開始日以降の最初の出勤日を探す
        while (currentDate.isSameOrBefore(endDate) && !assigned) {
          const dateStr = currentDate.format("YYYY-MM-DD");

          if (workDays.includes(dateStr)) {
            // 既に存在するかチェック
            const exists = await taskExists(dateStr, task.text);
            if (exists) {
              skippedCount++;
              assigned = true;
              break;
            }

            // 容量チェック
            const capacity = await checkCapacity(dateStr, task.duration);
            if (capacity.willExceed) {
              // 容量超過の場合は次の出勤日を試す
              currentDate.add(1, 'day');
              continue;
            }

            // タスク行の日付を更新したタスク行を作成
            let taskLine = task.line;
            // 既存の日付を新しい日付に置き換え
            if (taskLine.includes('📅')) {
              taskLine = taskLine.replace(/📅\s*\d{4}-\d{2}-\d{2}/, `📅 ${dateStr}`);
            } else {
              // 日付が含まれていない場合は追加
              taskLine = taskLine + ` 📅 ${dateStr}`;
            }

            // タスクを追加
            await addTaskToDate(dateStr, taskLine);
            addedCount++;
            assigned = true;
            break;
          }

          currentDate.add(1, 'day');
        }

        if (!assigned) {
          capacityExceededCount++;
        }
      }
    }

    // 結果を表示
    let message = `✅ プロジェクト「${project.name}」のサブタスクを展開しました\n`;
    message += `追加: ${addedCount}件`;
    if (skippedCount > 0) {
      message += `, スキップ: ${skippedCount}件`;
    }
    if (capacityExceededCount > 0) {
      message += `, 容量超過: ${capacityExceededCount}件`;
    }

    new Notice(message, 5000);

  } catch (error) {
    const errorMessage = `エラー: ${error.message}\nスタック: ${error.stack}`;
    new Notice(errorMessage, 10000);
    console.error('サブタスク展開エラー:', error);
    console.error('エラースタック:', error.stack);
  }
};

