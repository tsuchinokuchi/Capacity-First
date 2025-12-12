const container = input?.container || dv.container;
const pages = dv.pages('"スケジュール"');
container.createEl("div", { text: `Found ${pages.length} pages in "スケジュール"` });

if (pages.length > 0) {
    const firstPage = pages[0];
    const path = firstPage.file.path;
    dv.paragraph(`First page path (Dataview): ${path}`);

    const file = app.vault.getAbstractFileByPath(path);
    dv.paragraph(`app.vault.getAbstractFileByPath("${path}"): ${file ? "Found" : "Not Found"}`);

    if (file) {
        dv.paragraph(`File name: ${file.name}`);
        dv.paragraph(`File parent: ${file.parent.path}`);
    } else {
        dv.paragraph("⚠️ File not found via Vault API! Path mismatch?");
        // Try prepending 'タスク管理/'
        const path2 = "タスク管理/" + path;
        const file2 = app.vault.getAbstractFileByPath(path2);
        dv.paragraph(`Trying "${path2}": ${file2 ? "Found" : "Not Found"}`);
    }
}
