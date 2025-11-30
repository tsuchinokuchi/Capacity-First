// スケジュールファイルのタスクを新しいフォーマットに変換
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  // 設定
  const Config = require('./config');
  const { PATHS } = Config;

  const SCHEDULE_PATH = PATHS.SCHEDULE;

  // ジャンル推測ルール
  function guessGenre(taskName) {
    const name = taskName.toLowerCase();

    // 売場作業
    if (name.includes('品出し') || name.includes('売場') || name.includes('売場整理')) {
      return '売場作業';
    }

    // 顧客対応
    if (name.includes('接客') || name.includes('顧客') || name.includes('電話') || name.includes('客')) {
      return '顧客対応';
    }

    // 定型作業
    if (name.includes('チェックリスト') || name.includes('週報') || name.includes('月報') || name.includes('年末調整')) {
      return '定型作業';
    }

    // デスクワーク（デフォルト）
    return 'デスクワーク';
  }

  // 時間帯から分を計算
  function calculateMinutes(timeRange) {
    const match = timeRange.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return null;

    const startHour = parseInt(match[1]);
    const startMin = parseInt(match[2]);
    const endHour = parseInt(match[3]);
    const endMin = parseInt(match[4]);

    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    return endTotal - startTotal;
  }

  // タスク行を変換
  function convertTaskLine(line, fileDate) {
    // 既に新しいフォーマットの場合はスキップ
    if (line.includes('⏱️') && line.includes('#')) {
      return line;
    }

    // 完了状態を抽出
    const isCompleted = line.match(/^-\s+\[x\]/);
    const checkbox = isCompleted ? '- [x]' : '- [ ]';

    // 時間帯を抽出
    const timeMatch = line.match(/(\d{2}:\d{2}-\d{2}:\d{2})/);

    // タスク名を抽出（時間帯、📅、⏳、#calendar、🔁、✅などを除去）
    let taskName = line
      .replace(/^-\s+\[[ x]\]\s*/, '')
      .replace(/\d{2}:\d{2}-\d{2}:\d{2}\s*/, '')
      .replace(/📅\s*\d{4}-\d{2}-\d{2}\s*/, '')
      .replace(/⏳\s*\d{4}-\d{2}-\d{2}\s*/, '')
      .replace(/#calendar\s*/, '')
      .replace(/🔁\s*[^\s]*\s*/, '')
      .replace(/✅\s*\d{4}-\d{2}-\d{2}\s*/, '')
      .trim();

    // 「勤務」「休み」などの時間帯指定タスクは容量管理対象外なので、そのまま残す
    if (taskName === '勤務' || taskName === '休み' || taskName === '休憩は打刻！') {
      return line; // そのまま返す
    }

    // 時間帯から分を計算
    let duration = null;
    if (timeMatch) {
      duration = calculateMinutes(timeMatch[1]);
    }

    // 所要時間が計算できない、または0以下の場合はスキップ（時間帯指定のまま）
    if (!duration || duration <= 0) {
      return line;
    }

    // ジャンルを推測
    const genre = guessGenre(taskName);

    // 新しいフォーマットで生成
    const newLine = `${checkbox} ${taskName} #${genre} ⏱️ ${duration} 📅 ${fileDate}`;

    return newLine;
  }

  try {
    // 変換対象ファイルを取得
    const scheduleFiles = app.vault.getFiles()
      .filter(file => file.path.startsWith(SCHEDULE_PATH) && file.path.endsWith('.md'));

    if (scheduleFiles.length === 0) {
      new Notice("スケジュールファイルが見つかりません");
      return;
    }

    // 確認
    const shouldContinue = await quickAddApi.yesNoPrompt(
      `スケジュールファイル ${scheduleFiles.length}件 を変換しますか？\n\n` +
      `既存のタスクが新しいフォーマットに変換されます。\n` +
      `「勤務」「休み」などの時間帯指定タスクはそのまま残ります。`
    );

    if (!shouldContinue) {
      new Notice("変換をキャンセルしました");
      return;
    }

    let convertedCount = 0;
    let skippedCount = 0;

    // 各ファイルを変換
    for (const file of scheduleFiles) {
      try {
        const content = await app.vault.read(file);
        const lines = content.split('\n');
        const fileDate = file.basename; // YYYY-MM-DD

        const newLines = [];
        let hasChanges = false;

        for (const line of lines) {
          // タスク行を変換
          if (line.match(/^-\s+\[[ x]\]/)) {
            const converted = convertTaskLine(line, fileDate);
            newLines.push(converted);
            if (converted !== line) {
              hasChanges = true;
              convertedCount++;
            } else {
              skippedCount++;
            }
          } else {
            newLines.push(line);
          }
        }

        // 変更があった場合のみファイルを更新
        if (hasChanges) {
          await app.vault.modify(file, newLines.join('\n'));
        }
      } catch (error) {
        console.error(`Error converting ${file.path}:`, error);
      }
    }

    // 結果を表示
    new Notice(`✅ 変換完了\n変換: ${convertedCount}件, スキップ: ${skippedCount}件`, 5000);

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

