dv.span("**Today**: " + moment().format("YYYY年MM月DD日（ddd）"));

const refreshKey = "__capacity_dashboard_refresh";
const currentDate = moment().format("YYYY-MM-DD");

if (!window[refreshKey]) {
    window[refreshKey] = { lastDate: currentDate };
    setInterval(() => {
        const latest = moment().format("YYYY-MM-DD");
        if (window[refreshKey].lastDate !== latest) {
            window[refreshKey].lastDate = latest;
            app.commands.executeCommandById('dataview:refresh-views');
        }
    }, 60 * 1000);
}

if (window[refreshKey].lastDate !== currentDate) {
    window[refreshKey].lastDate = currentDate;
    setTimeout(() => app.commands.executeCommandById('dataview:refresh-views'), 100);
}
