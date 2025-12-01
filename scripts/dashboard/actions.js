const actions = [
    { name: "➕ タスク追加", command: "quickadd:choice:task-add" },
    { name: "📅 日付変更", command: "quickadd:choice:task-move" },
    { name: "🔁 繰り返し展開", command: "quickadd:choice:task-repeat-expand" }
];

const wrap = dv.container.createDiv();
wrap.style.display = "flex";
wrap.style.gap = "8px";
wrap.style.flexWrap = "wrap";

actions.forEach(act => {
    const btn = wrap.createEl("button", { text: act.name });
    btn.className = "mod-cta";
    btn.style.padding = "8px 14px";
    btn.style.cursor = "pointer";
    btn.onclick = () => {
        try {
            app.commands.executeCommandById(act.command);
        } catch (error) {
            new Notice("❌ コマンドを実行できませんでした");
            console.error(error);
        }
    };
});
