// QuickAdd User Script: タスク完了
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;
  
  // 設定
  const SCHEDULE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/スケジュール";

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
      // 未完了のタスク（- [ ] で始まる行）を取得
      if (line.match(/^- \[ \] .+/)) {
        tasks.push({ text: line, lineIndex: i });
      }
    }
    
    return tasks;
  }

  try {
    // 1. 日付を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const dateInput = await quickAddApi.inputPrompt(
      "日付を入力してください (YYYY-MM-DD) - 空白の場合は今日",
      today
    );
    
    // 空白の場合は今日の日付を使用
    const inputDate = dateInput.trim() || today;
    
    // 日付の妥当性チェック
    const date = moment(inputDate, "YYYY-MM-DD");
    if (!date.isValid()) {
      new Notice("無効な日付形式です。YYYY-MM-DD形式で入力してください");
      return;
    }
    const dateStr = date.format("YYYY-MM-DD");
    
    // 2. 指定日の未完了タスクを取得
    const tasks = await getDailyTasks(dateStr);
    
    if (tasks.length === 0) {
      new Notice(`${dateStr} の未完了タスクがありません`);
      return;
    }
    
    // 3. タスクを選択
    const taskLabels = tasks.map(t => {
      // タスク名を抽出（チェックボックス、メタデータを除去）
      const taskName = t.text
        .replace(/^- \[ \] /, "")
        .replace(/⏱️ \d+/, "")
        .replace(/📅 \d{4}-\d{2}-\d{2}/, "")
        .replace(/#\w+/g, "")
        .replace(/⏳ \d{4}-\d{2}-\d{2}/g, "")
        .replace(/#calendar/g, "")
        .trim();
      return taskName;
    });
    
    const selected = await quickAddApi.suggester(
      taskLabels,
      tasks
    );
    
    if (selected === undefined || selected === null) {
      new Notice("タスクが選択されていません");
      return;
    }
    
    // suggesterがインデックスを返す場合とオブジェクトを返す場合がある
    let selectedTask;
    if (typeof selected === 'number') {
      // インデックスの場合
      if (selected < 0 || selected >= tasks.length) {
        new Notice("タスクが選択されていません");
        return;
      }
      selectedTask = tasks[selected];
    } else {
      // オブジェクトの場合
      selectedTask = selected;
    }
    
    if (!selectedTask || selectedTask.lineIndex === undefined) {
      new Notice("タスクの情報を取得できませんでした");
      console.error("selectedTask:", selectedTask);
      console.error("tasks:", tasks);
      return;
    }
    
    // 4. タスクを完了状態に変更（- [ ] → - [x]）
    const filePath = `${SCHEDULE_PATH}/${dateStr}.md`;
    const file = app.vault.getAbstractFileByPath(filePath);
    
    if (!file) {
      new Notice("スケジュールファイルが見つかりません");
      return;
    }
    
    const content = await app.vault.read(file);
    const lines = content.split('\n');
    
    // 選択したタスクの行を完了状態に変更
    if (lines[selectedTask.lineIndex] && lines[selectedTask.lineIndex].match(/^- \[ \] /)) {
      lines[selectedTask.lineIndex] = lines[selectedTask.lineIndex].replace(/^- \[ \] /, "- [x] ");
    } else {
      new Notice("タスクの行が見つかりませんでした");
      return;
    }
    
    await app.vault.modify(file, lines.join('\n'));
    
    // 成功メッセージ
    const taskName = typeof selected === 'number' ? taskLabels[selected] : taskLabels[tasks.indexOf(selectedTask)];
    new Notice(`✅ タスクを完了しました: ${taskName}`, 3000);
    
  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

