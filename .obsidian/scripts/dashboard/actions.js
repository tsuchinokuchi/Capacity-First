const actions = [
    { name: "➕ タスク追加", command: "quickadd:choice:タスク追加" },
    { name: "📦 タスクプール→予定", command: "quickadd:choice:タスクプールからスケジュールに移動" },
    { name: "➡️ 次の日に移動", command: "quickadd:choice:タスク移動" },
    { name: "🔁 繰り返し展開", command: "quickadd:choice:繰り返しタスク展開" }
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
