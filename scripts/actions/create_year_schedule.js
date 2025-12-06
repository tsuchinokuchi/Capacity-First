
/**
 * Action: Create Year Schedule
 * Arguments: { year: number }
 */

const { createYearSchedule } = require(app.vault.adapter.basePath + "/プロジェクト管理/タスク管理/scripts/utils/schedule_manager.js");

if (input && input.year) {
    await createYearSchedule(input.year);
}
