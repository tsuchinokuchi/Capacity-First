// QuickAdd User Script: プロジェクト作成
// 使い方: QuickAddの設定画面で「User Scripts」セクションから選択

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  const path = require('path');
  const basePath = app.vault.adapter.basePath;
  const configPath = path.join(basePath, 'scripts', 'config.js');
  const Config = require(configPath);
  const { PATHS, FILES } = Config;

  const PROJECT_PATH = PATHS.PROJECT;
  const TEMPLATE_PATH = `${PATHS.PROJECT}/プロジェクトテンプレート.md`;

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

    // 3. 開始日を入力（デフォルト: 今日）
    const today = moment().format("YYYY-MM-DD");
    const startDateInput = await quickAddApi.inputPrompt(
      "開始日を入力してください (YYYY-MM-DD) - 空白の場合は今日",
      today
    );
    const startDate = startDateInput.trim() || today;

    // 開始日の妥当性チェック
    const startMoment = moment(startDate, "YYYY-MM-DD");
    if (!startMoment.isValid()) {
      new Notice("無効な開始日形式です。YYYY-MM-DD形式で入力してください");
      return;
    }

    // 4. 終了日を入力（デフォルト: 開始日から1ヶ月後）
    const defaultEndDate = moment(startMoment).add(1, 'month').format("YYYY-MM-DD");
    const endDateInput = await quickAddApi.inputPrompt(
      "終了日を入力してください (YYYY-MM-DD) - 空白の場合は開始日から1ヶ月後",
      defaultEndDate
    );
    const endDate = endDateInput.trim() || defaultEndDate;

    // 終了日の妥当性チェック
    const endMoment = moment(endDate, "YYYY-MM-DD");
    if (!endMoment.isValid()) {
      new Notice("無効な終了日形式です。YYYY-MM-DD形式で入力してください");
      return;
    }

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
- [ ] 0%完了

## サブタスク（1階層まで）

\`\`\`dataviewjs
// サブタスク追加ボタン
const container = dv.container;
const buttonContainer = document.createElement('div');
buttonContainer.style.marginBottom = '15px';
buttonContainer.style.display = 'flex';
buttonContainer.style.gap = '10px';
buttonContainer.style.flexWrap = 'wrap';

const addButton = document.createElement('button');
addButton.textContent = '➕ サブタスク追加';
addButton.className = 'mod-cta';
addButton.style.padding = '8px 16px';
addButton.style.cursor = 'pointer';
addButton.style.fontSize = '14px';
addButton.onclick = async () => {
  try {
    const commands = app.commands.commands;
    const commandId = Object.keys(commands).find(key => 
      key.includes('quickadd') && commands[key].name && commands[key].name.includes('サブタスク追加')
    );
    
    if (commandId) {
      await app.commands.executeCommandById(commandId);
      setTimeout(() => {
        app.workspace.getActiveFile() && app.commands.executeCommandById('dataview:refresh-views');
      }, 500);
    } else {
      const command = Object.values(commands).find(cmd => cmd.name === 'QuickAdd: サブタスク追加');
      if (command) {
        await app.commands.executeCommandById(command.id);
        setTimeout(() => {
          app.workspace.getActiveFile() && app.commands.executeCommandById('dataview:refresh-views');
        }, 500);
      } else {
        new Notice('「サブタスク追加」コマンドが見つかりません。');
      }
    }
  } catch (error) {
    new Notice('エラー: ' + error.message);
    console.error(error);
  }
};

buttonContainer.appendChild(addButton);
container.appendChild(buttonContainer);
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

