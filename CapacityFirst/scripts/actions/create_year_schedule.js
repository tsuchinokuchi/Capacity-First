
/**
 * Action: Create Year Schedule
 * Arguments: { year: number }
 */

const root = input.root || "CapacityFirst";
const modulePath = app.vault.adapter.basePath + "/" + root + "/scripts/utils/schedule_manager.js";

if (typeof require !== "undefined" && require.cache && require.cache[modulePath]) {
    delete require.cache[modulePath];
}

const { createYearSchedule } = require(modulePath);

if (input && input.year && input.config) {
    new Notice(`Debug: Creating schedule for ${input.year} in ${input.config.PATHS.SCHEDULE}`);
    await createYearSchedule(input.year, input.config);
} else {
    new Notice("Error: Missing arguments for Create Year Schedule");
}
