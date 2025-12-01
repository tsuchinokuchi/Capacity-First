// QuickAdd User Script: タスク追加（容量チェック付き）
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

  const SCHEDULE_PATH = PATHS.SCHEDULE;
  const CONFIG_PATH = FILES.SETTINGS;
  const GENRE_CONFIG_PATH = FILES.GENRE_CONFIG;
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

  // ジャンルリストを設定ファイルから読み込む
  async function loadGenres() {
    const defaultGenres = [
      "デスクワーク",
      "売場作業",
      "顧客対応",
      "定型作業",
      "学習",
      "健康",
      "趣味",
      "その他プライベート"
    ];

    try {
      const genreConfigFile = app.vault.getAbstractFileByPath(GENRE_CONFIG_PATH);
      if (!genreConfigFile) {
        return defaultGenres;
      }

      const content = await app.vault.read(genreConfigFile);
      const genreMatch = content.match(/const TASK_GENRES = \[([\s\S]*?)\];/);

      if (genreMatch) {
        const genres = genreMatch[1]
          .split(',')
          .map(g => g.trim().replace(/^["']|["']$/g, ''))
          .filter(g => g);

        return genres.length > 0 ? genres : defaultGenres;
      }
    } catch (error) {
      console.error("ジャンル設定の読み込みエラー:", error);
    }

    return defaultGenres;
  }

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

  try {
    await loadSettings();

    // ジャンルリストを読み込む
    const GENRES = await loadGenres();

    // 1. タスク名を入力
    const taskName = await quickAddApi.inputPrompt(
      "タスク名を入力してください"
    );
    if (!taskName) {
      new Notice("タスク名が入力されていません");
      return;
    }

    // 2. 所要時間を選択
    const durationLabels = DURATION_OPTIONS.map(opt => opt.label);
    const selectedDurationLabel = await quickAddApi.suggester(
      durationLabels,
      durationLabels
    );
    if (!selectedDurationLabel) {
      new Notice("所要時間が選択されていません");
      return;
    }
    const duration = DURATION_OPTIONS.find(opt => opt.label === selectedDurationLabel).value;

    // 3. ジャンルを選択
    const selectedGenre = await quickAddApi.suggester(
      GENRES,
      GENRES
    );
    if (!selectedGenre) {
      new Notice("ジャンルが選択されていません");
      return;
    }

    // 4. 日付を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const dateInput = await quickAddApi.inputPrompt(
      "日付を入力してください (YYYY-MM-DD or MM-DD) - 空白の場合は今日",
      today
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

    // 空白の場合は今日の日付を使用
    const inputDateRaw = dateInput.trim() || today;
    const dateStr = parseDateInput(inputDateRaw, today);

    if (!dateStr) {
      new Notice(`無効な日付形式です: ${inputDateRaw}\nYYYY-MM-DD または MM-DD 形式で入力してください`);
      return;
    }

    // 5. 締切日を入力（オプション）
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

    // 6. 容量チェック
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

    // 7. タスクを追加
    const filePath = `${SCHEDULE_PATH}/${dateStr}.md`;
    let file = app.vault.getAbstractFileByPath(filePath);

    // ファイルが存在しない場合は作成
    if (!file) {
      file = await app.vault.create(filePath, `## 今日のスケジュール\n\n`);
    }

    // タスク行を作成（締切日がある場合は追加）
    const taskLine = `- [ ] ${taskName} #${selectedGenre} ⏱️ ${duration} 📅 ${dateStr}${deadlineStr}\n`;

    // ファイルに追加
    const content = await app.vault.read(file);
    const newContent = content + taskLine;
    await app.vault.modify(file, newContent);

    // 成功メッセージ
    const message = capacity.willExceed
      ? `✅ タスクを追加しました（容量超過警告あり）\n使用量: ${capacity.newTotal}分 / ${maxDailyMinutes}分`
      : `✅ タスクを追加しました\n使用量: ${capacity.newTotal}分 / ${maxDailyMinutes}分`;

    new Notice(message, 3000);

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

