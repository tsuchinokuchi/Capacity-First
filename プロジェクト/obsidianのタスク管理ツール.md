# obsidianのタスク管理ツール

## 概要
プロジェクトの説明を記入してください。

## 期間
- 開始: 2025-11-08
- 終了: 2025-12-31（最大1ヶ月）

## 進捗
- [ ] 0%完了

## サブタスク（1階層まで）

```dataviewjs
const container = dv.container;
const buttonContainer = document.createElement('div');
buttonContainer.style.marginBottom = '15px';
buttonContainer.style.display = 'flex';
buttonContainer.style.gap = '10px';
buttonContainer.style.flexWrap = 'wrap';

const genreConfigPath = "03.ツェッテルカステン/030.データベース/タスク管理/ジャンル設定.md";
let genres = ["デスクワーク", "売場作業", "顧客対応", "定型作業", "学習", "健康", "趣味", "その他プライベート"];
try {
  const genreConfigContent = await dv.io.load(genreConfigPath);
  if (genreConfigContent) {
    const genreMatch = genreConfigContent.match(/const TASK_GENRES = \[([\s\S]*?)\];/);
    if (genreMatch) {
      genres = genreMatch[1]
        .split(',')
        .map(g => g.trim().replace(/^["']|["']$/g, ''))
        .filter(g => g);
    }
  }
} catch (error) {
  console.error("ジャンル設定の読み込みエラー:", error);
}

const addButton = document.createElement('button');
addButton.textContent = '➕ サブタスク追加';
addButton.className = 'mod-cta';
addButton.style.padding = '8px 16px';
addButton.style.cursor = 'pointer';
addButton.style.fontSize = '14px';
addButton.onclick = async () => {
  try {
    const quickAddPlugin = app.plugins.plugins.quickadd;
    if (!quickAddPlugin || !quickAddPlugin.api) {
      new Notice('❌ QuickAddプラグインが見つかりません');
      return;
    }
    const quickAddApi = quickAddPlugin.api;

    const activeFile = app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('❌ アクティブなファイルが見つかりません');
      return;
    }

    const taskName = await quickAddApi.inputPrompt("タスク名を入力してください");
    if (!taskName || !taskName.trim()) {
      new Notice('タスク名が入力されていません');
      return;
    }

    const selectedGenre = await quickAddApi.suggester(
      genres,
      genres,
      "カテゴリ（ジャンル）を選択してください"
    );
    if (!selectedGenre) {
      new Notice('カテゴリが選択されていません');
      return;
    }

    const duration = await quickAddApi.inputPrompt("所要時間（分）を入力してください", "60");
    if (!duration || !duration.trim()) {
      new Notice('所要時間が入力されていません');
      return;
    }

    const today = moment().format("YYYY-MM-DD");
    const scheduleDate = await quickAddApi.inputPrompt(
      "実施日を入力してください (YYYY-MM-DD)",
      today
    );
    if (!scheduleDate || !scheduleDate.trim()) {
      new Notice('実施日が入力されていません');
      return;
    }

    const scheduleDateMoment = moment(scheduleDate.trim(), "YYYY-MM-DD");
    if (!scheduleDateMoment.isValid()) {
      new Notice('無効な日付形式です。YYYY-MM-DD形式で入力してください');
      return;
    }

    const scheduleDateStr = scheduleDateMoment.format("YYYY-MM-DD");

    const deadlineInput = await quickAddApi.inputPrompt(
      "締切日を入力してください (YYYY-MM-DD) - 空白の場合は締切なし",
      ""
    );

    let deadlineStr = "";
    if (deadlineInput && deadlineInput.trim()) {
      const deadlineMoment = moment(deadlineInput.trim(), "YYYY-MM-DD");
      if (deadlineMoment.isValid()) {
        deadlineStr = ` ⏰ ${deadlineMoment.format("YYYY-MM-DD")}`;
      } else {
        new Notice("無効な締切日形式です。スキップします");
      }
    }

    let projectContent = await app.vault.read(activeFile);
    const subtaskMatches = projectContent.matchAll(/^### (.+)$/gm);
    const existingSubtasks = Array.from(subtaskMatches)
      .map(m => m[1])
      .filter(s => !["概要", "期間", "進捗", "サブタスク（1階層まで）", "メモ"].includes(s));

    let subtaskCategory;
    if (existingSubtasks.length > 0) {
      subtaskCategory = await quickAddApi.suggester(
        [...existingSubtasks, '新規カテゴリ'],
        [...existingSubtasks, '新規カテゴリ'],
        "サブタスクカテゴリを選択してください（または新規カテゴリを作成）"
      );

      if (!subtaskCategory) {
        new Notice('サブタスクカテゴリが選択されていません');
        return;
      }

      if (subtaskCategory === '新規カテゴリ') {
        subtaskCategory = await quickAddApi.inputPrompt("新しいサブタスクカテゴリ名を入力してください");
        if (!subtaskCategory || !subtaskCategory.trim()) {
          new Notice('サブタスクカテゴリ名が入力されていません');
          return;
        }
      }
    } else {
      subtaskCategory = await quickAddApi.inputPrompt("サブタスクカテゴリ名を入力してください");
      if (!subtaskCategory || !subtaskCategory.trim()) {
        new Notice('サブタスクカテゴリ名が入力されていません');
        return;
      }
    }

    const projectName = activeFile.basename;
    const taskLine = `- [ ] ${taskName.trim()} #${selectedGenre} ⏱️ ${duration.trim()} 📅 ${scheduleDateStr}${deadlineStr} 🔗 ${projectName}`;

    const subtaskHeader = `### ${subtaskCategory.trim()}`;
    const subtaskSectionIndex = projectContent.indexOf('## サブタスク（1階層まで）');

    if (subtaskSectionIndex === -1) {
      new Notice('❌ サブタスクセクションが見つかりません');
      return;
    }

    const afterSubtaskSection = projectContent.substring(subtaskSectionIndex);
    const nextSectionIndex = afterSubtaskSection.indexOf('\n## ');
    const subtaskSection = nextSectionIndex !== -1
      ? afterSubtaskSection.substring(0, nextSectionIndex)
      : afterSubtaskSection;

    const categoryHeaderRegex = new RegExp(`^### ${subtaskCategory.trim()}$`, 'm');
    const categoryMatch = subtaskSection.match(categoryHeaderRegex);

    if (categoryMatch) {
      const categoryIndex = subtaskSection.indexOf(categoryMatch[0]);
      const afterCategory = subtaskSection.substring(categoryIndex);
      const nextCategoryIndex = afterCategory.indexOf('\n### ');
      const categoryEndIndex = nextCategoryIndex !== -1
        ? categoryIndex + nextCategoryIndex
        : subtaskSection.length;

      const categoryContent = subtaskSection.substring(categoryIndex, categoryEndIndex);
      const lastTaskIndex = categoryContent.lastIndexOf('- [');

      if (lastTaskIndex !== -1) {
        const insertIndex = categoryContent.indexOf('\n', lastTaskIndex);
        const newCategoryContent =
          categoryContent.substring(0, insertIndex) +
          '\n' +
          taskLine +
          categoryContent.substring(insertIndex);
        projectContent =
          projectContent.substring(0, subtaskSectionIndex + categoryIndex) +
          newCategoryContent +
          projectContent.substring(subtaskSectionIndex + categoryEndIndex);
      } else {
        const headerEndIndex = categoryContent.indexOf('\n');
        const newCategoryContent =
          categoryContent.substring(0, headerEndIndex + 1) +
          taskLine +
          '\n' +
          categoryContent.substring(headerEndIndex + 1);
        projectContent =
          projectContent.substring(0, subtaskSectionIndex + categoryIndex) +
          newCategoryContent +
          projectContent.substring(subtaskSectionIndex + categoryEndIndex);
      }
    } else {
      const subtaskSectionEnd = subtaskSectionIndex + subtaskSection.length;
      const newCategory = `\n\n${subtaskHeader}\n${taskLine}\n`;
      projectContent =
        projectContent.substring(0, subtaskSectionEnd) +
        newCategory +
        projectContent.substring(subtaskSectionEnd);
    }

    await app.vault.modify(activeFile, projectContent);

    const schedulePath = "03.ツェッテルカステン/030.データベース/タスク管理/スケジュール";
    const scheduleFilePath = `${schedulePath}/${scheduleDateStr}.md`;
    let scheduleFile = app.vault.getAbstractFileByPath(scheduleFilePath);

    if (!scheduleFile) {
      scheduleFile = await app.vault.create(scheduleFilePath, `## 今日のスケジュール\n\n`);
    }

    let scheduleContent = await app.vault.read(scheduleFile);

    if (!scheduleContent.includes(taskLine)) {
      scheduleContent += taskLine + '\n';
      await app.vault.modify(scheduleFile, scheduleContent);
    }

    new Notice(`✅ サブタスクを追加しました（プロジェクト: ${subtaskCategory.trim()}、実施日: ${scheduleDateStr}）`);

    setTimeout(() => {
      app.commands.executeCommandById('dataview:refresh-views');
    }, 500);
  } catch (error) {
    new Notice('❌ エラー: ' + error.message);
    console.error(error);
  }
};

buttonContainer.appendChild(addButton);
container.appendChild(buttonContainer);
```

### テスト計画
- [ ] テストケース一覧を洗い出す #デスクワーク ⏱️ 60 📅 2025-11-15
- [ ] QuickAdd / Dataview 動作テストを実施する #デスクワーク ⏱️ 120 📅 2025-11-15
- [ ] 修正ポイントの洗い出しメモを整理する #デスクワーク ⏱️ 45 📅 2025-11-15

### GitHub公開準備
- [ ] README と使用手順ドラフトを作成する #デスクワーク ⏱️ 90 📅 2025-11-21
- [ ] 公開用サンプルデータを匿名化する #デスクワーク ⏱️ 45 📅 2025-11-21
- [ ] リポジトリ初期設定（ライセンス・Actions）を整える #デスクワーク ⏱️ 60 📅 2025-11-21
- [ ] 動作確認スクリーンショットを撮影する #デスクワーク ⏱️ 45 📅 2025-11-21
- [ ] 公開用リリースノートをまとめる #デスクワーク ⏱️ 60 📅 2025-11-22
- [ ] GitHub へ push してリリースタグを作成する #デスクワーク ⏱️ 45 📅 2025-11-22

### NOTE記事作成
- [ ] NOTE 記事の構成案を作る #デスクワーク ⏱️ 60 📅 2025-11-22
- [ ] 記事本文（導入〜使い方）を執筆する #デスクワーク ⏱️ 120 📅 2025-11-28
- [ ] 記事用の画像・GIF を作成して添付する #デスクワーク ⏱️ 60 📅 2025-11-28
- [ ] 公開前レビューと公開設定を行う #デスクワーク ⏱️ 45 📅 2025-11-28

## メモ
<!-- プロジェクトに関するメモや注意事項を記入 -->
