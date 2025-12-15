// 設定: タスク管理ツールのベースパス
// 自分の環境に合わせて変更してください
const BASE_PATH = "03.ツェッテルカステン/030.データベース/タスク管理";

module.exports = {
    // フォルダパス
    PATHS: {
        BASE: BASE_PATH,
        SCHEDULE: `${BASE_PATH}/スケジュール`,
        PROJECT: `${BASE_PATH}/プロジェクト`,
        TEMPLATE: `${BASE_PATH}/テンプレート`,
        CONFIG: `${BASE_PATH}/config`,
        SCRIPTS: `${BASE_PATH}/scripts`,
    },
    // ファイルパス
    FILES: {
        SCHEDULE_TEMPLATE: `${BASE_PATH}/スケジュールテンプレート.md`,
        SETTINGS: `${BASE_PATH}/config/settings.json`,
        GENRE_CONFIG: `${BASE_PATH}/ジャンル設定.md`,
        WEEKLY_GRID: `${BASE_PATH}/週勤務グリッド.md`,
    },
    // その他設定
    SETTINGS: {
        DEFAULT_MAX_DAILY_MINUTES: 360,
    }
};
