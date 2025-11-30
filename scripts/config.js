// 設定: タスク管理ツールのベースパス
// 自分の環境に合わせて変更してください
const BASE_PATH = "";

module.exports = {
    // フォルダパス
    PATHS: {
        BASE: BASE_PATH,
        SCHEDULE: "スケジュール",
        PROJECT: "プロジェクト",
        TEMPLATE: "テンプレート",
        CONFIG: "config",
        SCRIPTS: "scripts",
    },
    // ファイルパス
    FILES: {
        SCHEDULE_TEMPLATE: "スケジュールテンプレート.md",
        SETTINGS: "config/settings.json",
        GENRE_CONFIG: "ジャンル設定.md",
        WEEKLY_GRID: "週勤務グリッド.md",
    },
    // その他設定
    SETTINGS: {
        DEFAULT_MAX_DAILY_MINUTES: 360,
    }
};
