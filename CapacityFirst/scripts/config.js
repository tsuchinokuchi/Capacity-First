// 設定: タスク管理ツールのベースパス
// 自分の環境に合わせて変更してください
const BASE_PATH = "CapacityFirst";

const joinPath = (base, path) => base ? `${base}/${path}` : path;

module.exports = {
    // フォルダパス
    PATHS: {
        BASE: BASE_PATH,
        SCHEDULE: joinPath(BASE_PATH, "スケジュール"),
        PROJECT: joinPath(BASE_PATH, "プロジェクト"),
        TEMPLATE: joinPath(BASE_PATH, "テンプレート"),
        CONFIG: joinPath(BASE_PATH, "config"),
        SCRIPTS: joinPath(BASE_PATH, "scripts"),
    },
    // ファイルパス
    FILES: {
        SCHEDULE_TEMPLATE: joinPath(BASE_PATH, "スケジュールテンプレート.md"),
        SETTINGS: joinPath(BASE_PATH, "config/settings.json"),
        GENRE_CONFIG: joinPath(BASE_PATH, "ジャンル設定.md"),
        WEEKLY_GRID: joinPath(BASE_PATH, "週勤務グリッド.md"),
    },
    // その他設定
    SETTINGS: {
        DEFAULT_MAX_DAILY_MINUTES: 360,
    }
};
