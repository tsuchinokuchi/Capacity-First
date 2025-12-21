// QuickAdd User Script: プロジェクト作成
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  const path = require('path');
  // Use vault base path to ensure correct absolute path resolution
  const basePath = app.vault.adapter.getBasePath();
  const configPath = path.join(basePath, 'CapacityFirst/scripts/config.js');
  const Config = require(configPath);
  const { PATHS, FILES } = Config;

  const PROJECT_PATH = PATHS.PROJECT;
  const TEMPLATE_PATH = `${PATHS.TEMPLATE}/プロジェクトテンプレート.md`;

  try {
    // 1. プロジェクト名を入力
    const projectName = await quickAddApi.inputPrompt(
      "プロジェクト名を入力してください"
    );
    if (!projectName || !projectName.trim()) {
      new Notice("プロジェクト名が入力されていません");
      return;
    }

    // 2. 概要を入力（オプション）
    const description = await quickAddApi.inputPrompt(
      "プロジェクトの概要を入力してください（空白可）",
      ""
    );

    // Helper to parse date flexibly
    const parseDate = (input) => {
      if (!input) return null;
      let s = input.trim();
      // Normalize: Full-width to half-width
      s = s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      // Normalize: Separators to hyphen
      s = s.replace(/[－／．]/g, '-').replace(/[./]/g, '-');

      // Handle MM-DD (e.g., 12-31, 1-1) -> Prepend Current Year
      if (/^\d{1,2}-\d{1,2}$/.test(s)) {
        s = `${moment().year()}-${s}`;
      }

      // Parse with Moment (allow loose parsing for YYYY-M-D etc)
      const d = moment(s, ["YYYY-MM-DD", "YYYY-M-D"], false);
      return d.isValid() ? d : null;
    };

    // 3. 開始日を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const startDateInput = await quickAddApi.inputPrompt(
      "開始日を入力してください (YYYY-MM-DD または MM-DD) - 空白の場合は今日",
      today
    );

    let startDate = today;
    if (startDateInput && startDateInput.trim()) {
      const dateObj = parseDate(startDateInput);
      if (!dateObj || !dateObj.isValid()) {
        new Notice(`無効な開始日形式です: ${startDateInput}\nYYYY-MM-DD形式で入力してください`);
        return;
      }
      startDate = dateObj.format("YYYY-MM-DD");
    }
    const startMoment = moment(startDate, "YYYY-MM-DD");

    // 4. 終了日を入力（デフォルト: 開始日から1ヶ月後）
    const defaultEndDate = moment(startMoment).add(1, 'month').format("YYYY-MM-DD");
    const endDateInput = await quickAddApi.inputPrompt(
      "終了日を入力してください (YYYY-MM-DD または MM-DD) - 空白の場合は開始日から1ヶ月後",
      defaultEndDate
    );

    let endDate = defaultEndDate;
    if (endDateInput && endDateInput.trim()) {
      const dateObj = parseDate(endDateInput);
      if (!dateObj || !dateObj.isValid()) {
        new Notice(`無効な終了日形式です: ${endDateInput}\nYYYY-MM-DD形式で入力してください`);
        return;
      }
      endDate = dateObj.format("YYYY-MM-DD");
    }
    const endMoment = moment(endDate, "YYYY-MM-DD");

    // 終了日が開始日より後かチェック
    if (endMoment.isBefore(startMoment)) {
      new Notice("終了日は開始日より後である必要があります");
      return;
    }

    // 5. ファイル名を作成（既存チェック）
    const fileName = `${projectName}.md`;
    const filePath = `${PROJECT_PATH}/${fileName}`;
    const existingFile = app.vault.getAbstractFileByPath(filePath);

    if (existingFile) {
      const shouldOverwrite = await quickAddApi.yesNoPrompt(
        `「${projectName}」という名前のプロジェクトが既に存在します。\n上書きしますか？`
      );
      if (!shouldOverwrite) {
        new Notice("プロジェクトの作成をキャンセルしました");
        return;
      }
    }

    // 6. テンプレートを読み込む
    let templateContent = "";
    try {
      const templateFile = app.vault.getAbstractFileByPath(TEMPLATE_PATH);
      if (templateFile) {
        templateContent = await app.vault.read(templateFile);
      }
    } catch (error) {
      console.warn("テンプレートの読み込みに失敗しました。デフォルトテンプレートを使用します。", error);
    }

    // 7. テンプレートが読み込めなかった場合はデフォルトを使用
    if (!templateContent || templateContent.trim() === "") {
      templateContent = `# プロジェクト名

## 概要
プロジェクトの説明を記入してください。

## 期間
- 開始: YYYY-MM-DD
- 終了: YYYY-MM-DD（最大1ヶ月）

## 進捗
\`\`\`dataviewjs
await dv.view("CapacityFirst/scripts/views/project_buttons", { type: "progress" });
\`\`\`

## サブタスク（1階層まで）

\`\`\`dataviewjs
await dv.view("CapacityFirst/scripts/views/project_buttons", { type: "buttons" });
\`\`\`

### サブタスク1
- [ ] タスク1 #ジャンル ⏱️ 60 📅 YYYY-MM-DD
- [ ] タスク2 #ジャンル ⏱️ 60 📅 YYYY-MM-DD

### サブタスク2
- [ ] タスク3 #ジャンル ⏱️ 60 📅 YYYY-MM-DD

## メモ
<!-- プロジェクトに関するメモや注意事項を記入 -->
`;
    }

    // 8. テンプレートを置換
    let projectContent = templateContent
      .replace(/# プロジェクト名/g, `# ${projectName}`)
      .replace(/プロジェクトの説明を記入してください。/g, description.trim() || "プロジェクトの説明を記入してください。")
      .replace(/開始: YYYY-MM-DD/g, `開始: ${startDate}`)
      .replace(/終了: YYYY-MM-DD/g, `終了: ${endDate}`);

    // 8. ファイルを作成または更新
    if (existingFile) {
      await app.vault.modify(existingFile, projectContent);
      new Notice(`✅ プロジェクト「${projectName}」を更新しました`, 3000);
    } else {
      const newFile = await app.vault.create(filePath, projectContent);
      new Notice(`✅ プロジェクト「${projectName}」を作成しました`, 3000);

      // 新しく作成したファイルを開く
      await app.workspace.openLinkText(filePath, "", true);
    }

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};
