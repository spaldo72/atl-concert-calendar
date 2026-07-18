
const FEED = "calendar.ics";
const tabs = document.querySelectorAll(".tab");
const panelIds = ["apple","google","other"];

tabs.forEach(tab => tab.addEventListener("click", () => {
  tabs.forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  panelIds.forEach(id => document.getElementById(id).hidden = id !== tab.dataset.panel);
}));

document.querySelectorAll("[data-copy]").forEach(button => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => button.textContent = old, 1400);
    } catch {
      prompt("Copy this calendar address:", button.dataset.copy);
    }
  });
});

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function valueOf(block, key) {
  const line = block.split(/\r?\n/).find(x => x.split(":")[0].split(";")[0].toUpperCase() === key);
  if (!line) return "";
  return line.slice(line.indexOf(":")+1)
    .replace(/\\n/gi," ")
    .replace(/\\,/g,",")
    .replace(/\\;/g,";")
    .replace(/\\\\/g,"\\")
    .trim();
}

function parseDate(raw) {
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return new Date(+raw.slice(0,4), +raw.slice(4,6)-1, +raw.slice(6,8));
  }
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  const [,y,mo,d,h,mi,s="00",z] = m;
  return z ? new Date(Date.UTC(+y,+mo-1,+d,+h,+mi,+s)) : new Date(+y,+mo-1,+d,+h,+mi,+s);
}

function parseICS(text) {
  return (unfold(text).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || []).map(block => ({
    title: valueOf(block,"SUMMARY") || "Untitled concert",
    location: valueOf(block,"LOCATION"),
    start: parseDate(valueOf(block,"DTSTART"))
  })).filter(e => e.start && !isNaN(e.start));
}

function render(events) {
  const root = document.getElementById("events");
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events.filter(e => e.start >= today).sort((a,b)=>a.start-b.start).slice(0,12);

  if (!upcoming.length) {
    root.innerHTML = '<div class="empty">No upcoming concerts are currently listed.</div>';
    return;
  }

  root.innerHTML = "";
  upcoming.forEach(e => {
    const el = document.createElement("article");
    el.className = "event";
    const month = e.start.toLocaleString("en-US",{month:"short"}).toUpperCase();
    const day = e.start.getDate();
    const dateText = e.start.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
    el.innerHTML = `<div class="date"><div class="month">${month}</div><div class="day">${day}</div></div>
      <div><h3></h3><div class="meta"><span class="when"></span><br><span class="where"></span></div></div>`;
    el.querySelector("h3").textContent = e.title;
    el.querySelector(".when").textContent = dateText;
    el.querySelector(".where").textContent = e.location || "";
    root.appendChild(el);
  });
}

fetch(FEED,{cache:"no-store"})
  .then(r => {
    if (!r.ok) throw new Error("Calendar could not be loaded.");
    const lm = r.headers.get("Last-Modified");
    if (lm) document.getElementById("updated").textContent =
      "Updated " + new Date(lm).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
    return r.text();
  })
  .then(text => render(parseICS(text)))
  .catch(err => {
    console.error(err);
    document.getElementById("updated").textContent = "Calendar unavailable";
    document.getElementById("events").innerHTML =
      '<div class="empty">The calendar feed could not be loaded. The subscription buttons may still work.</div>';
  });