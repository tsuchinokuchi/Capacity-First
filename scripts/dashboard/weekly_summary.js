// scripts/dashboard/weekly_summary.js
// Default config matching repo structure
const config = {
    PATHS: {
        SCHEDULE: "スケジュール"
    },
    FILES: {
        SETTINGS: "config/settings.json"
    },
    SETTINGS: {
        DEFAULT_MAX_DAILY_MINUTES: 360
    }
};

const CONFIG_PATH = config.FILES.SETTINGS;
const schedulePath = config.PATHS.SCHEDULE;

let maxDailyMinutes = config.SETTINGS.DEFAULT_MAX_DAILY_MINUTES;

try {
    const cfg = await dv.io.load(CONFIG_PATH);
    if (cfg) {
        const parsed = JSON.parse(cfg);
        if (Number.isFinite(parsed.maxDailyMinutes)) maxDailyMinutes = parsed.maxDailyMinutes;
    }
} catch (error) { console.error(error); }

const weekStart = moment().startOf('isoWeek');
const weekEnd = moment(weekStart).add(6, 'days');
const pages = dv.pages(`"${schedulePath}"`);
let weeklyMinutes = 0;
let weeklyTasks = [];

for (let d = moment(weekStart); d.isSameOrBefore(weekEnd); d.add(1, 'day')) {
    const dateStr = d.format("YYYY-MM-DD");
    const file = pages.where(p => p.file.name === dateStr).array()[0];
    if (!file) continue;
    file.file.tasks
        .where(t => t.text.includes("⏱️"))
        .array()
        .forEach(task => {
            const duration = (task.text.match(/⏱️ (\d+)/) || [0, 0])[1];
            weeklyMinutes += parseInt(duration, 10);
            const cleanName = task.text
                .replace(/^- \[ \] /, '').replace(/^- \[x\] /, '')
                .replace(/⏱️ \d+/, '').replace(/📅 \d{4}-\d{2}-\d{2}/, '')
                .replace(/#\w+/g, '')
                .trim();
            weeklyTasks.push([
                d.format("MM/DD(ddd)"),
                cleanName,
                `${duration}分`,
                task.completed ? "✅" : "⬜"
            ]);
        });
}

const container = input?.container || dv.container;
if (!weeklyTasks.length) {
    dv.paragraph("_今週のタスクはありません_");
} else {
    // Use dv.table if container is dv.container, else manual table
    // dv.table appends to dv.container automatically.
    // If we want to append to custom container, we must build table manually or use dv.view context?
    // dv.table returns void. It appends to current dv context.
    // If we are in a dv.view, dv.container IS the container of that view.
    // But if we pass a custom container, dv.table might still write to the global dv.container of the parent view?
    // Actually, dv.view executes in a context where 'dv' is bound to the view.
    // But if we pass a DOM element from parent, 'dv.container' in this script is still the parent's container?
    // No, dv.view creates a new container for the view.
    // If we want to render into 'input.container', we should use it.
    // But dv.table doesn't accept container.
    // We might need to rely on the fact that we will append the view's container to the parent's custom container?
    // No, dashboard.js will create a div, and pass it as input.container.
    // If this script uses dv.paragraph, it writes to dv.container (the view's container).
    // If we want to write to input.container, we must use DOM methods on it.

    // Let's assume for now we just use dv.container (which is the view's container) 
    // and dashboard.js will just call dv.view and let it render into its own container, 
    // then dashboard.js can move that container?
    // No, dv.view renders in place.

    // Wait, if dashboard.js calls dv.view, it renders at that point.
    // If dashboard.js wants to put it inside a collapsible details/summary,
    // it should create the details/summary, and then call dv.view inside it?
    // But dv.view appends to the current script's output.
    // We can't easily "nest" dv.view output inside a DOM element created by JS *unless* we pass that element to dv.view?
    // But dv.view doesn't take a container to render *into*. It creates its own container and appends it to the parent.
    // Actually, dv.view(path, input) returns a promise.
    // The script inside dv.view has its own `dv` object. `dv.container` is the container for that view.
    // That container is appended to the parent container.
    // So if dashboard.js does:
    // const details = dv.container.createEl("details");
    // ...
    // await dv.view("...", { container: details });
    // And the sub-script does:
    // const container = input.container;
    // container.createEl(...)
    // Then it works!

    // But dv.table() writes to `dv.container`.
    // So if we use `dv.table()`, it writes to the view's default container, not `input.container`.
    // So we should avoid `dv.table()` if we want to target `input.container`.
    // Or we just let it write to `dv.container` and don't use `input.container` for `dv` methods?
    // If we use `input.container`, we must use DOM methods.

    // For weekly_summary, it uses dv.table.
    // Let's rewrite it to use DOM table if input.container is present.

    const table = container.createEl("table");
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    ["日付", "タスク", "時間", "状態"].forEach(h => headerRow.createEl("th", { text: h }));
    const tbody = table.createTBody();
    weeklyTasks.forEach(row => {
        const tr = tbody.insertRow();
        row.forEach(cell => tr.insertCell().textContent = cell);
    });

    const maxWeekly = maxDailyMinutes * 5; // 平日稼働想定
    const pct = Math.round((weeklyMinutes / maxWeekly) * 100);
    const bar = "█".repeat(Math.min(20, Math.floor(pct / 5))) + "░".repeat(Math.max(0, 20 - Math.floor(pct / 5)));

    const p = container.createEl("p");
    // Render markdown in p? dv.paragraph does it.
    // We can use obsidian's MarkdownRenderer if we want, but simple text is fine for now or basic HTML.
    p.innerHTML = `<strong>週間容量</strong>: ${weeklyMinutes}分 / ${maxWeekly}分 (${pct}%)<br>${bar}`;
}
