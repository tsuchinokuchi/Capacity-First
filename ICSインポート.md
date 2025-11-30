# 📥 Googleカレンダー（ICS）インポート

以下のボタンで、ICSファイルから向こう14日分の予定を
`スケジュール/` の日次ノートへ追記します。

対象: `calendar.ics`

```dataviewjs
const icsPath = "calendar.ics";
const outFolder = "スケジュール";
const daysForward = 30;

const container = dv.container;
container.innerHTML = `<button id="ics-import" style="padding:8px 14px;">インポート（向こう${daysForward}日）</button>`;

function parseICS(text){
  const events = [];
  // ICS folding対応: 次行がスペース始まりなら前行に連結
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (const l of rawLines){
    if (l.startsWith(' ') && lines.length){ lines[lines.length-1] += l.slice(1); }
    else lines.push(l);
  }
  let ev = null;
  for (let i = 0; i < lines.length; i++){
    const line = lines[i];
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev && ev.dtstartRaw && ev.dtendRaw) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const m = line.match(/^([A-Z;=:\/A-Za-z_]+):(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (key.startsWith('DTSTART')) { ev.dtstartRaw = val; if (key.includes('VALUE=DATE')) ev.allDay = true; }
    if (key.startsWith('DTEND')) { ev.dtendRaw = val; if (key.includes('VALUE=DATE')) ev.allDay = true; }
    if (key === 'SUMMARY') ev.summary = val;
    if (key === 'LOCATION') ev.location = val;
    if (key === 'RRULE') ev.rruleRaw = val;
  }
  // 文字列→moment
  function parseIcsDate(s){
    // 例: 20251102T090000Z / 20251102T090000 / TZID=Asia/Tokyo:20251102T090000
    const tzIdx = s.indexOf(':');
    if (s.includes('TZID=') && tzIdx !== -1) s = s.slice(tzIdx+1);
    if (/^\d{8}$/.test(s)) return moment(s, 'YYYYMMDD'); // 終日
    if (s.endsWith('Z')) return moment.utc(s, 'YYYYMMDDTHHmmss[Z]').local();
    return moment(s, 'YYYYMMDDTHHmmss');
  }
  for (const e of events){
    e.dtstart = parseIcsDate(e.dtstartRaw);
    e.dtend = parseIcsDate(e.dtendRaw);
    if (e.allDay){
      // 終日予定は 07:00-08:00 にマップ
      e.dtstart.hour(7).minute(0).second(0);
      e.dtend = moment(e.dtstart).add(1, 'hour');
    }
  }
  return events.filter(e => e.dtstart?.isValid() && e.dtend?.isValid());
}

async function ensureDailyFile(dateStr){
  const path = `${outFolder}/${dateStr}.md`;
  let file = app.vault.getAbstractFileByPath(path);
  if (!file){
    await app.vault.create(path, `## 今日のスケジュール\n`);
    file = app.vault.getAbstractFileByPath(path);
  }
  return file;
}

function rruleToTasks(rr){
  if (!rr) return '';
  // RRULE like: FREQ=WEEKLY;BYDAY=MO,WE,FR;INTERVAL=1
  const parts = Object.fromEntries(rr.split(';').map(p => p.split('=')));
  const freq = parts['FREQ'];
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL'],10) : 1;
  const byday = parts['BYDAY'];
  const bymonthday = parts['BYMONTHDAY'];
  const bysetpos = parts['BYSETPOS'];
  const dayMap = {SU:'Sun', MO:'Mon', TU:'Tue', WE:'Wed', TH:'Thu', FR:'Fri', SA:'Sat'};
  if (freq === 'DAILY') {
    return interval > 1 ? `every ${interval} days` : 'every day';
  }
  if (freq === 'WEEKLY') {
    const days = byday ? byday.split(',').map(d => dayMap[d]||d).join(', ') : '';
    const base = interval > 1 ? `every ${interval} weeks` : 'every week';
    return days ? `${base} on ${days}` : base;
  }
  if (freq === 'MONTHLY') {
    if (bymonthday) {
      return interval > 1 ? `every ${interval} months on the ${bymonthday}` : `every month on the ${bymonthday}`;
    }
    if (byday && bysetpos) {
      const posMap = { '1':'first', '2':'second', '3':'third', '4':'fourth', '-1':'last' };
      const pos = posMap[bysetpos] || `${bysetpos}th`;
      const day = dayMap[byday] || byday;
      return interval > 1 ? `every ${interval} months on the ${pos} ${day}` : `every month on the ${pos} ${day}`;
    }
  }
  return '';
}

function toLine(e){
  const start = e.dtstart.format('HH:mm');
  const end = e.dtend.format('HH:mm');
  const title = e.summary || '予定';
  const loc = e.location ? ` @${e.location}` : '';
  const recur = rruleToTasks(e.rruleRaw);
  const recurText = recur ? ` 🔁 ${recur}` : '';
  const day = e.dtstart.format('YYYY-MM-DD');
  // 日付は Due(📅) と Scheduled(⏳) を両方付けておくと互換性が高い
  return `- [ ] ${start}-${end} ${title}${loc} 📅 ${day} ⏳ ${day} #calendar${recurText}`;
}

document.getElementById('ics-import')?.addEventListener('click', async () => {
  try{
    const raw = await dv.io.load(icsPath);
    if (!raw) { new Notice('ICSが見つかりません'); return; }
    const events = parseICS(raw);
    if (!events.length){ new Notice('ICS解析結果: 0件（ファイル読み込みは成功）'); return; }
    const today = moment().startOf('day');
    const end = moment(today).add(daysForward-1, 'days').endOf('day');
    let targets = events.filter(e => e.dtstart.isBetween(today, end, null, '[]'))
      .sort((a,b) => a.dtstart.valueOf() - b.dtstart.valueOf());
    if (targets.length === 0){
      // デバッグ: 直近365日で再フィルタ
      const altEnd = moment(today).add(365, 'days');
      const alt = events.filter(e => e.dtstart.isBetween(today, altEnd, null, '[]'))
        .sort((a,b) => a.dtstart.valueOf() - b.dtstart.valueOf());
      const info = alt.slice(0,3).map(e => `${e.dtstart.format('YYYY-MM-DD HH:mm')} ${e.summary||''}`).join('\n');
      new Notice(`対象期間に予定なし。例: \n${info || '（先のイベントなし）'}`);
      targets = alt;
    }
    let count = 0;
    for (const e of targets){
      const dateStr = e.dtstart.format('YYYY-MM-DD');
      const file = await ensureDailyFile(dateStr);
      let content = await app.vault.read(file);
      const line = toLine(e);
      if (!content.includes(line)){
        content += `\n${line}\n`;
        await app.vault.modify(file, content);
        count++;
      }
    }
    new Notice(`ICSから${count}件を取り込みました`);
  } catch(err){
    console.error(err);
    new Notice('インポートでエラーが発生しました');
  }
});
```


