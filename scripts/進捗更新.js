// QuickAdd User Script: プロジェクト進捗更新
// プロジェクトの完了率を自動計算して更新

module.exports = async (params) => {
  // QuickAddのAPIを取得
  const { app, quickAddApi } = params;

  // 設定
  // 設定
  const Config = require('./config');
  const { PATHS } = Config;

  const PROJECT_PATH = PATHS.PROJECT;

  // ヘルパー関数: プロジェクトファイルを読み込む
  async function loadProject(projectPath) {
    const file = app.vault.getAbstractFileByPath(projectPath);
    if (!file) return null;

    const content = await app.vault.read(file);
    return { file, content, lines: content.split('\n') };
  }

  // ヘルパー関数: 進捗率を計算
  function calculateProgress(lines) {
    let totalTasks = 0;
    let completedTasks = 0;

    let inSubtasksSection = false;

    for (const line of lines) {
      // サブタスクセクションの開始
      if (line.match(/^##\s+サブタスク/)) {
        inSubtasksSection = true;
        continue;
      }

      // 次のセクション（サブタスクセクションの終了）
      if (inSubtasksSection && line.match(/^##\s+/)) {
        inSubtasksSection = false;
        continue;
      }

      // タスク行（- [ ] または - [x] で始まる行）
      if (inSubtasksSection && line.match(/^-\s+\[[ x]\]\s+/)) {
        totalTasks++;
        if (line.match(/^-\s+\[x\]/)) {
          completedTasks++;
        }
      }
    }

    if (totalTasks === 0) return 0;
    return Math.round((completedTasks / totalTasks) * 100);
  }

  // ヘルパー関数: 進捗セクションを更新
  function updateProgressSection(content, progress) {
    const lines = content.split('\n');
    const newLines = [];
    let inProgressSection = false;
    let progressUpdated = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 進捗セクションの開始
      if (line.match(/^##\s+進捗/)) {
        inProgressSection = true;
        newLines.push(line);
        continue;
      }

      // 次のセクション（進捗セクションの終了）
      if (inProgressSection && line.match(/^##\s+/)) {
        // 進捗が更新されていない場合は追加
        if (!progressUpdated) {
          newLines.push(`- [${progress === 100 ? 'x' : ' '}] ${progress}%完了`);
        }
        inProgressSection = false;
        progressUpdated = false;
        newLines.push(line);
        continue;
      }

      // 進捗セクション内のチェックボックス行を更新
      if (inProgressSection && line.match(/^-\s+\[[ x]\]\s+\d+%/)) {
        newLines.push(`- [${progress === 100 ? 'x' : ' '}] ${progress}%完了`);
        progressUpdated = true;
        continue;
      }

      newLines.push(line);
    }

    // 進捗セクションが見つからない場合は追加
    if (!inProgressSection) {
      // 期間セクションの後に追加
      let insertIndex = -1;
      for (let i = 0; i < newLines.length; i++) {
        if (newLines[i].match(/^##\s+期間/)) {
          insertIndex = i;
          // 期間セクションの終わりを見つける
          for (let j = i + 1; j < newLines.length; j++) {
            if (newLines[j].match(/^##\s+/)) {
              insertIndex = j;
              break;
            }
          }
          break;
        }
      }

      if (insertIndex >= 0) {
        newLines.splice(insertIndex, 0, '## 進捗', `- [${progress === 100 ? 'x' : ' '}] ${progress}%完了`, '');
      }
    }

    return newLines.join('\n');
  }

  try {
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

    // 進捗率を計算
    const progress = calculateProgress(project.lines);

    // 進捗セクションを更新
    const newContent = updateProgressSection(project.content, progress);

    // ファイルを更新
    await app.vault.modify(project.file, newContent);

    // 成功メッセージ
    new Notice(`✅ プロジェクト「${selectedProjectName}」の進捗を更新しました\n進捗率: ${progress}%`, 3000);

  } catch (error) {
    new Notice(`エラー: ${error.message}`);
    console.error(error);
  }
};

