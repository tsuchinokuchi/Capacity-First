// QuickAdd Macro: タスクを次の日に移動（出勤日連動）
// 使い方: QuickAddの設定画面でこのMacroを追加

module.exports = async (params) => {
  const { app, quickAddApi } = params;

  // 設定
  const path = require('path');

  // Use local config relative to this script
  const configPath = path.join(__dirname, 'config.js');

  // Clear cache for local config
  if (require.cache && require.cache[configPath]) {
    delete require.cache[configPath];
  }

  const Config = require('./config');
  const { PATHS, FILES, SETTINGS } = Config;

  const SCHEDULE_PATH = PATHS.SCHEDULE;
  const WORK_GRID_PATH = FILES.WEEKLY_GRID;
  const CONFIG_PATH = FILES.SETTINGS;
  const DEFAULT_MAX_DAILY_MINUTES = SETTINGS.DEFAULT_MAX_DAILY_MINUTES || 360;
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
    const year = moment(date).format("YYYY");
    const month = moment(date).format("MM");
    const flatPath = `${SCHEDULE_PATH}/${date}.md`;
    const nestedPath = `${SCHEDULE_PATH}/${year}/${month}/${date}.md`;

    let file = app.vault.getAbstractFileByPath(nestedPath);
    if (!file) file = app.vault.getAbstractFileByPath(flatPath);

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

    // 現在のファイルから対象日付を取得（または、今日のタスク一覧から選択）
    let sourceDate = moment().format("YYYY-MM-DD");
    const activeFile = app.workspace.getActiveFile();
    if (activeFile && activeFile.basename.match(/^\d{4}-\d{2}-\d{2}$/)) {
      sourceDate = activeFile.basename;
    }

    // タスクを取得
    const todayTasks = await getDailyTasks(sourceDate);

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

    // 移動先の日付を入力
    const nextDayDefault = moment(sourceDate).add(1, 'days').format("YYYY-MM-DD");
    const inputDate = await quickAddApi.inputPrompt(
      "移動先の日付 (YYYY-MM-DD)",
      `空欄の場合は翌日 (${nextDayDefault}) に移動します`,
      ""
    );

    // 日付解析ヘルパー
    function parseDateInput(input, referenceDate) {
      if (!input) return null;

      // YYYY-MM-DD形式
      if (moment(input, "YYYY-MM-DD", true).isValid()) {
        return input;
      }

      // MM-DD, M-D, MM-D, M-DD形式 (区切り文字はハイフン、スラッシュ、ドットに対応)
      const match = input.match(/^(\d{1,2})[-/.](\d{1,2})$/);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const currentYear = moment(referenceDate).year();

        // とりあえず今年のその日付を作る
        let target = moment({ year: currentYear, month: month - 1, day: day });

        if (!target.isValid()) return null;

        // 基準日（今日）より過去なら来年にする
        // ただし、今日と同じ日付なら今年（今日のまま）とする
        if (target.isBefore(moment(referenceDate).startOf('day'))) {
          target.add(1, 'year');
        }

        return target.format("YYYY-MM-DD");
      }

      // 8桁数値 (YYYYMMDD)
      if (input.match(/^\d{8}$/) && moment(input, "YYYYMMDD", true).isValid()) {
        return moment(input, "YYYYMMDD").format("YYYY-MM-DD");
      }

      // 4桁数値 (MMDD)
      if (input.match(/^\d{4}$/)) {
        const month = parseInt(input.substring(0, 2));
        const day = parseInt(input.substring(2, 4));
        const currentYear = moment(referenceDate).year();
        let target = moment({ year: currentYear, month: month - 1, day: day });

        if (target.isValid()) {
          if (target.isBefore(moment(referenceDate).startOf('day'))) {
            target.add(1, 'year');
          }
          return target.format("YYYY-MM-DD");
        }
      }

      return null;
    }

    let targetDate = inputDate;

    if (!targetDate) {
      targetDate = nextDayDefault;
    } else {
      const parsed = parseDateInput(targetDate, sourceDate);
      if (!parsed) {
        new Notice(`無効な日付形式です: ${targetDate}\nYYYY-MM-DD または MM-DD 形式で入力してください。`);
        return;
      }
      targetDate = parsed;
    }

    // 容量チェック
    const capacity = await checkCapacity(targetDate, selectedTask.duration);

    if (capacity.willExceed) {
      const shouldContinue = await quickAddApi.yesNoPrompt(
        `⚠️ 容量超過警告\n\n` +
        `移動先: ${targetDate}\n` +
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

    // 元のファイル(sourceDate)からタスクを削除
    const sourceYear = moment(sourceDate).format("YYYY");
    const sourceMonth = moment(sourceDate).format("MM");
    const sourceFlatPath = `${SCHEDULE_PATH}/${sourceDate}.md`;
    const sourceNestedPath = `${SCHEDULE_PATH}/${sourceYear}/${sourceMonth}/${sourceDate}.md`;

    let sourceFile = app.vault.getAbstractFileByPath(sourceFlatPath);
    if (!sourceFile) sourceFile = app.vault.getAbstractFileByPath(sourceNestedPath);
    if (sourceFile) {
      const sourceContent = await app.vault.read(sourceFile);
      const sourceLines = sourceContent.split('\n');
      sourceLines.splice(selectedTask.lineIndex, 1);
      await app.vault.modify(sourceFile, sourceLines.join('\n'));
    }

    // 次の日のファイルにタスクを追加
    const targetYear = moment(targetDate).format("YYYY");
    const targetMonth = moment(targetDate).format("MM");
    const flatPath = `${SCHEDULE_PATH}/${targetDate}.md`;
    const yearFolder = `${SCHEDULE_PATH}/${targetYear}`;
    const monthFolder = `${yearFolder}/${targetMonth}`;
    const nestedPath = `${monthFolder}/${targetDate}.md`;

    let nextFile = app.vault.getAbstractFileByPath(nestedPath);
    if (!nextFile) nextFile = app.vault.getAbstractFileByPath(flatPath);

    if (!nextFile) {
      // Ensure folders exist
      if (!app.vault.getAbstractFileByPath(yearFolder)) {
        await app.vault.createFolder(yearFolder);
      }
      if (!app.vault.getAbstractFileByPath(monthFolder)) {
        await app.vault.createFolder(monthFolder);
      }
      nextFile = await app.vault.create(nestedPath, `## 今日のスケジュール\n\n`);
    }

    // 日付を更新したタスク行を作成
    const taskText = selectedTask.text.replace(
      /📅 \d{4}-\d{2}-\d{2}/,
      `📅 ${targetDate}`
    );

    const nextContent = await app.vault.read(nextFile);
    const newNextContent = nextContent + taskText + '\n';
    await app.vault.modify(nextFile, newNextContent);

    // 成功メッセージ
    new Notice(`✅ タスクを ${targetDate} に移動しました`, 3000);
    new Notice(`(CapacityFirst Script)`, 3000);

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};
