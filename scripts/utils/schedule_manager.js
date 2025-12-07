
/**
 * Schedule Manager
 * Handles creation of schedule folders and files.
 */

const SCHEDULE_ROOT = "スケジュール";
const TEMPLATE_PATH = "スケジュールテンプレート.md";

/**
 * Creates schedule files for a given year.
 * @param {string|number} year - The year to generate schedule for (e.g., 2025).
 */
async function createYearSchedule(year) {
    const yearStr = year.toString();
    const startDate = moment(`${yearStr}-01-01`);
    const endDate = moment(`${yearStr}-12-31`);

    // 1. Load Template
    let templateContent = "";
    const templateFile = app.vault.getAbstractFileByPath(TEMPLATE_PATH);
    if (templateFile) {
        templateContent = await app.vault.read(templateFile);
    } else {
        new Notice(`Error: Template not found at ${TEMPLATE_PATH}`);
        return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    // 2. Iterate through days
    for (let m = moment(startDate); m.isSameOrBefore(endDate); m.add(1, 'days')) {
        const monthStr = m.format("MM");
        const dayStr = m.format("YYYY-MM-DD");

        // Folder Path: Schedule/YYYY/MM
        const folderPath = `${SCHEDULE_ROOT}/${yearStr}/${monthStr}`;
        const filePath = `${folderPath}/${dayStr}.md`;

        // Create Folder if not exists
        if (!app.vault.getAbstractFileByPath(folderPath)) {
            await app.vault.createFolder(folderPath);
        }

        // Create File if not exists
        if (!app.vault.getAbstractFileByPath(filePath)) {
            await app.vault.create(filePath, templateContent);
            createdCount++;
        } else {
            skippedCount++;
        }
    }

    new Notice(`Schedule creation complete for ${yearStr}.\nCreated: ${createdCount}\nSkipped: ${skippedCount}`);
}

module.exports = {
    createYearSchedule
};
