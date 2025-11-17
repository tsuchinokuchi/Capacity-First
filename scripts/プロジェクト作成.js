// QuickAdd User Script: プロジェクト作成
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;
  
  // 設定
  const PROJECT_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/プロジェクト";
  const TEMPLATE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理/プロジェクト/プロジェクトテンプレート.md";
  const MAX_MONTHS = 1; // 最大1ヶ月
  
  try {
    // 1. プロジェクト名を入力
    const projectName = await quickAddApi.inputPrompt(
      "プロジェクト名を入力してください"
    );
    if (!projectName) {
      new Notice("プロジェクト名が入力されていません");
      return;
    }
    
    // ファイル名に使用できない文字を削除
    const safeFileName = projectName.replace(/[<>:"/\\|?*]/g, '_');
    
    // 2. プロジェクトの説明を入力
    const description = await quickAddApi.inputPrompt(
      "プロジェクトの説明を入力してください（任意）",
      ""
    );
    
    // 3. 開始日を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const startDateInput = await quickAddApi.inputPrompt(
      "開始日を入力してください (YYYY-MM-DD)",
      today
    );
    if (!startDateInput) {
      new Notice("開始日が入力されていません");
      return;
    }
    
    const startDate = moment(startDateInput, "YYYY-MM-DD");
    if (!startDate.isValid()) {
      new Notice("無効な日付形式です。YYYY-MM-DD形式で入力してください");
      return;
    }
    
    // 4. 終了日を入力（デフォルト: 開始日から1ヶ月後）
    const defaultEndDate = moment(startDate).add(MAX_MONTHS, 'month').format("YYYY-MM-DD");
    const endDateInput = await quickAddApi.inputPrompt(
      "終了日を入力してください (YYYY-MM-DD)",
      defaultEndDate
    );
    if (!endDateInput) {
      new Notice("終了日が入力されていません");
      return;
    }
    
    const endDate = moment(endDateInput, "YYYY-MM-DD");
    if (!endDate.isValid()) {
      new Notice("無効な日付形式です。YYYY-MM-DD形式で入力してください");
      return;
    }
    
    // 期間チェック（最大1ヶ月）
    const durationMonths = endDate.diff(startDate, 'months', true);
    if (durationMonths > MAX_MONTHS) {
      const shouldContinue = await quickAddApi.yesNoPrompt(
        `⚠️ 期間超過警告\n\n` +
        `開始日: ${startDate.format("YYYY-MM-DD")}\n` +
        `終了日: ${endDate.format("YYYY-MM-DD")}\n` +
        `期間: ${durationMonths.toFixed(1)}ヶ月（上限: ${MAX_MONTHS}ヶ月）\n\n` +
        `このまま続行しますか？`
      );
      
      if (!shouldContinue) {
        new Notice("プロジェクトの作成をキャンセルしました");
        return;
      }
    }
    
    // 開始日が終了日より後でないかチェック
    if (startDate.isAfter(endDate)) {
      new Notice("開始日が終了日より後です。正しい日付を入力してください");
      return;
    }
    
    // 5. プロジェクトファイルを作成
    const filePath = `${PROJECT_PATH}/${safeFileName}.md`;
    
    // ファイルが既に存在するかチェック
    const existingFile = app.vault.getAbstractFileByPath(filePath);
    if (existingFile) {
      const shouldOverwrite = await quickAddApi.yesNoPrompt(
        `プロジェクト「${safeFileName}」は既に存在します。\n上書きしますか？`
      );
      
      if (!shouldOverwrite) {
        new Notice("プロジェクトの作成をキャンセルしました");
        return;
      }
    }
    
    // テンプレートを読み込む
    const templateFile = app.vault.getAbstractFileByPath(TEMPLATE_PATH);
    let content;
    if (templateFile) {
      let templateContent = await app.vault.read(templateFile);

      // タイトル
      templateContent = templateContent.replace(/^# .+$/m, `# ${projectName}`);

      // 概要
      const summaryRegex = /(## 概要\s*\n)([\s\S]*?)(\n## |\n```|$)/;
      templateContent = templateContent.replace(summaryRegex, (_, prefix, _body, suffix) => {
        const newBody = `${description || "プロジェクトの説明を記入してください。"}\n\n`;
        return `${prefix}${newBody}${suffix}`;
      });

      // 期間: 開始
      templateContent = templateContent.replace(
        /- 開始:\s*[\d-]+/m,
        `- 開始: ${startDate.format("YYYY-MM-DD")}`
      );

      // 期間: 終了
      templateContent = templateContent.replace(
        /- 終了:\s*[\d-]+（最大1ヶ月）/m,
        `- 終了: ${endDate.format("YYYY-MM-DD")}（最大1ヶ月）`
      );

      content = templateContent;
    } else {
      // テンプレートが見つからない場合のフォールバック（サブタスク追加ボタン付き）
      content = `# ${projectName}\n\n` +
        `## 概要\n${description || "プロジェクトの説明を記入してください。"}\n\n` +
        `## 期間\n` +
        `- 開始: ${startDate.format("YYYY-MM-DD")}\n` +
        `- 終了: ${endDate.format("YYYY-MM-DD")}（最大1ヶ月）\n\n` +
        `## 進捗\n- [ ] 0%完了\n\n` +
        `## サブタスク（1階層まで）\n\n` +
        "```dataviewjs\n" +
        "// QuickAdd を使ったサブタスク追加ボタン\n" +
        "const container = dv.container;\n" +
        "const button = document.createElement('button');\n" +
        "button.textContent = '➕ サブタスク追加';\n" +
        "button.className = 'mod-cta';\n" +
        "button.onclick = () => app.commands.executeCommandById('quickadd:choice:サブタスク追加');\n" +
        "container.appendChild(button);\n" +
        "```\n\n" +
        `## メモ\n`;
    }
    
    // ファイルを作成または上書き
    if (existingFile) {
      await app.vault.modify(existingFile, content);
    } else {
      await app.vault.create(filePath, content);
    }
    
    // 成功メッセージ
    new Notice(`✅ プロジェクト「${projectName}」を作成しました`, 3000);
    
    // ファイルを開く
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await app.workspace.openLinkText(filePath, '', true);
    }
    
  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

