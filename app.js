(() => {
  "use strict";
  const MONTH_LEN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTH_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const PAGE = 60;
  const T = {
    zh: { brand:"历史上的今天", brandSub:"存档版 · 中英对照", today:"今天", allDates:"全部日期", random:"随机一天",
      search:"在这一天里搜索…", oldFirst:"年代：从早到晚", newFirst:"年代：从晚到早", more:"显示更多",
      allTypes:"全部", allCont:"全部大洲", allCountry:"全部国家/地区", orig:"查看英文原文", origZh:"查看中文译文",
      wiki:"维基百科", rev:"原始修订版本", excerpt:"维基百科摘录", editorial:"编辑整理", contrib:"维基百科贡献者",
      stat:(n,t)=> n===t ? `共 ${t} 条` : `显示 ${n} / ${t} 条`, empty:"没有符合条件的事件。", loading:"加载中…",
      fail:"数据加载失败，请刷新重试。", bce:y=>`公元前${-y}年`, yr:y=>`${y}年`, title:(m,d)=>`${m}月${d}日`,
      meta:(n,g)=>`共收录 ${n.toLocaleString()} 条事件 · 数据存档于 ${g}`,
      foot1:"事件文字来自维基百科及其编辑摘录，保留每条的修订版本与许可。中文由 AI 辅助翻译，未经人工审校，每条均附英文原文。" },
    en: { brand:"On This Day", brandSub:"Archive · bilingual", today:"Today", allDates:"All dates", random:"Random day",
      search:"Search this day…", oldFirst:"Oldest first", newFirst:"Newest first", more:"Show more",
      allTypes:"All", allCont:"All continents", allCountry:"All countries", orig:"Show Chinese", origZh:"Show Chinese",
      wiki:"Wikipedia", rev:"recorded revision", excerpt:"Wikipedia excerpt", editorial:"Editorial summary", contrib:"Wikipedia contributors",
      stat:(n,t)=> n===t ? `${t} events` : `Showing ${n} of ${t}`, empty:"No matching events.", loading:"Loading…",
      fail:"Failed to load data. Please refresh.", bce:y=>`${-y} BC`, yr:y=>`${y}`, title:(m,d)=>`${MONTH_EN[m-1]} ${d}`,
      meta:(n,g)=>`${n.toLocaleString()} events · archived ${g}`,
      foot1:"Event text comes from Wikipedia and editorial excerpts, with each entry's revision and license kept. Chinese text is AI-assisted and not human-reviewed." },
  };

  const $ = s => document.querySelector(s);
  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const state = { lang: store.get("lang", "both"), m: 1, d: 1, events: [], type: "", cont: "", country: "", q: "", sort: "asc", shown: PAGE };
  let meta = null;
  const cache = new Map();

  const ui = () => T[state.lang === "en" ? "en" : "zh"];
  const pad = n => String(n).padStart(2, "0");
  const key = (m, d) => `${pad(m)}-${pad(d)}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const typeLabel = t => state.lang === "en" ? t : (meta?.types?.[t]?.zh || t);
  const contLabel = c => state.lang === "en" ? c : (meta?.continents?.[c] || c);

  function readHash() {
    const m = location.hash.match(/^#(\d{2})-(\d{2})/);
    if (m) {
      const mm = +m[1], dd = +m[2];
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= MONTH_LEN[mm - 1]) { state.m = mm; state.d = dd; return; }
    }
    const now = new Date(); state.m = now.getMonth() + 1; state.d = now.getDate();
  }

  function applyI18n() {
    const t = ui();
    document.documentElement.lang = state.lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-i18n]").forEach(el => { const v = t[el.dataset.i18n]; if (typeof v === "string") el.textContent = v; });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = t[el.dataset.i18nPh]; });
    document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("on", b.dataset.lang === state.lang));
    fillMonthDay();
  }

  function fillMonthDay() {
    const t = ui();
    $("#month").innerHTML = MONTH_LEN.map((_, i) =>
      `<option value="${i + 1}"${i + 1 === state.m ? " selected" : ""}>${state.lang === "en" ? MONTH_EN[i] : (i + 1) + "月"}</option>`).join("");
    $("#day").innerHTML = Array.from({ length: MONTH_LEN[state.m - 1] }, (_, i) =>
      `<option value="${i + 1}"${i + 1 === state.d ? " selected" : ""}>${state.lang === "en" ? i + 1 : (i + 1) + "日"}</option>`).join("");
    $("#dateTitle").textContent = t.title(state.m, state.d);
    document.title = `${t.title(state.m, state.d)} · ${t.brand}`;
  }

  async function loadDay() {
    const k = key(state.m, state.d);
    $("#timeline").innerHTML = `<p class="empty">${ui().loading}</p>`;
    try {
      if (!cache.has(k)) {
        const r = await fetch(`data/d/${k}.json`);
        if (!r.ok) throw new Error(r.status);
        cache.set(k, (await r.json()).events);
      }
      if (k !== key(state.m, state.d)) return; // user moved on
      state.events = cache.get(k);
      state.shown = PAGE;
      buildFilters();
      render();
    } catch (e) {
      $("#timeline").innerHTML = `<p class="empty">${ui().fail}</p>`;
    }
  }

  function buildFilters() {
    const t = ui();
    const tc = {}, cc = {}, kc = {};
    for (const e of state.events) {
      tc[e.type] = (tc[e.type] || 0) + 1;
      const seenC = new Set();
      for (const [country, cont, label] of e.loc) {
        if (cont && !seenC.has(cont)) { cc[cont] = (cc[cont] || 0) + 1; seenC.add(cont); }
        if (country) kc[country] = kc[country] || { n: 0, label }, kc[country].n++;
      }
    }
    if (state.type && !tc[state.type]) state.type = "";
    if (state.cont && !cc[state.cont]) state.cont = "";
    if (state.country && !kc[state.country]) state.country = "";
    const types = Object.entries(tc).sort((a, b) => b[1] - a[1]);
    $("#typeChips").innerHTML =
      `<button class="chip${state.type ? "" : " on"}" data-type="">${t.allTypes}<small>${state.events.length}</small></button>` +
      types.map(([k, n]) => `<button class="chip${state.type === k ? " on" : ""}" data-type="${esc(k)}">${esc(typeLabel(k))}<small>${n}</small></button>`).join("");
    $("#continent").innerHTML = `<option value="">${t.allCont}</option>` +
      Object.entries(cc).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${esc(k)}"${state.cont === k ? " selected" : ""}>${esc(contLabel(k))} (${n})</option>`).join("");
    const countries = Object.entries(kc).filter(([k]) => !state.cont || state.events.some(e => e.loc.some(l => l[0] === k && l[1] === state.cont)));
    countries.sort((a, b) => b[1].n - a[1].n);
    $("#country").innerHTML = `<option value="">${t.allCountry}</option>` +
      countries.map(([k, v]) => `<option value="${esc(k)}"${state.country === k ? " selected" : ""}>${esc(state.lang === "en" ? k : v.label || k)} (${v.n})</option>`).join("");
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    let list = state.events.filter(e =>
      (!state.type || e.type === state.type) &&
      (!state.cont || e.loc.some(l => l[1] === state.cont)) &&
      (!state.country || e.loc.some(l => l[0] === state.country)) &&
      (!q || [e.zh.t, e.zh.s, e.en.t, e.en.s, String(e.y)].some(s => s && String(s).toLowerCase().includes(q))));
    if (state.sort === "desc") list = list.slice().reverse();
    return list;
  }

  const hl = s => {
    const q = state.q.trim();
    const h = esc(s);
    if (!q) return h;
    const re = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return h.replace(re, m => `<mark>${m}</mark>`);
  };

  function card(e) {
    const t = ui();
    const yr = e.y < 0 ? t.bce(e.y) : t.yr(e.y);
    const zh = e.zh, en = e.en;
    const primary = state.lang === "en" ? en : (zh.t ? zh : en);
    const secondary = state.lang === "en" ? zh : en;
    let body = `<div class="ev-head"><span class="yr">${esc(yr)}</span><h3>${hl(primary.t)}</h3></div>
      <p>${hl(primary.s)}</p>${primary.n ? `<p class="sub">${esc(primary.n)}</p>` : ""}`;
    if (state.lang === "both" && secondary.t) {
      body += `<div class="en-block" lang="en"><h4>${hl(secondary.t)}</h4><p>${hl(secondary.s)}</p></div>`;
    } else if (secondary.t) {
      body += `<details class="orig"><summary>${state.lang === "en" ? t.origZh : t.orig}</summary>
        <div lang="${state.lang === "en" ? "zh" : "en"}"><p><b>${esc(secondary.t)}</b></p><p>${esc(secondary.s)}</p></div></details>`;
    }
    const seen = new Set();
    const locTags = e.loc.filter(l => l[0] && !seen.has(l[0]) && seen.add(l[0])).slice(0, 6)
      .map(([c, , label]) => `<button class="tag" data-country="${esc(c)}">${esc(state.lang === "en" ? c : label || c)}</button>`).join("");
    const more = e.loc.length > 6 ? `<span class="tag">+${e.loc.length - 6}</span>` : "";
    body += `<div class="tags"><button class="tag type" data-type="${esc(e.type)}">${esc(typeLabel(e.type))}</button>${locTags}${more}</div>`;
    const licUrl = /3\.0/.test(e.lic) ? "https://creativecommons.org/licenses/by-sa/3.0/" : "https://creativecommons.org/licenses/by-sa/4.0/";
    body += `<div class="src">${e.wiki ? `<a href="${esc(e.wiki)}" target="_blank" rel="noopener">${t.wiki}</a> · ` : ""}${e.kind === "excerpt" ? t.excerpt : t.editorial}${e.rev ? ` · <a href="${esc(e.rev)}" target="_blank" rel="noopener">${t.rev}</a>` : ""} · ${t.contrib} · <a href="${licUrl}" target="_blank" rel="noopener">${esc(e.lic)}</a></div>`;
    return `<article class="ev" id="${esc(e.id)}">${body}</article>`;
  }

  function render() {
    const list = filtered();
    const t = ui();
    $("#stat").textContent = t.stat(list.length, state.events.length);
    if (!list.length) { $("#timeline").innerHTML = `<p class="empty">${t.empty}</p>`; $("#more").hidden = true; return; }
    $("#timeline").innerHTML = list.slice(0, state.shown).map(card).join("");
    $("#more").hidden = list.length <= state.shown;
  }

  function go(m, d) {
    state.m = m; state.d = d;
    history.replaceState(null, "", `#${key(m, d)}`);
    fillMonthDay(); loadDay(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function shift(delta) {
    const dt = new Date(2024, state.m - 1, state.d + delta); // 2024 is a leap year
    go(dt.getMonth() + 1, dt.getDate());
  }

  function buildCalendar() {
    const max = Math.max(...Object.values(meta.counts));
    $("#calBody").innerHTML = MONTH_LEN.map((n, i) => {
      const m = i + 1;
      const days = Array.from({ length: n }, (_, j) => {
        const d = j + 1, c = meta.counts[key(m, d)] || 0;
        const a = 0.08 + 0.6 * Math.sqrt(c / max);
        return `<a href="#${key(m, d)}" data-m="${m}" data-d="${d}" title="${c}" class="${m === state.m && d === state.d ? "cur" : ""}"
          style="background:color-mix(in srgb,var(--accent) ${Math.round(a * 100)}%,transparent);color:${a > .45 ? "var(--paper)" : "inherit"}">${d}</a>`;
      }).join("");
      return `<div class="month"><h3>${state.lang === "en" ? MONTH_EN[i] : m + "月"}</h3><div class="days">${days}</div></div>`;
    }).join("");
  }

  // events
  document.querySelector(".lang").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.lang = b.dataset.lang; store.set("lang", state.lang);
    applyI18n(); buildFilters(); render(); footMeta();
  });
  $("#prev").onclick = () => shift(-1);
  $("#next").onclick = () => shift(1);
  $("#today").onclick = () => { const n = new Date(); go(n.getMonth() + 1, n.getDate()); };
  $("#random").onclick = () => { const i = Math.floor(Math.random() * 366); const dt = new Date(2024, 0, 1 + i); go(dt.getMonth() + 1, dt.getDate()); };
  $("#month").onchange = e => { const m = +e.target.value; go(m, Math.min(state.d, MONTH_LEN[m - 1])); };
  $("#day").onchange = e => go(state.m, +e.target.value);
  $("#typeChips").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; state.type = b.dataset.type; state.shown = PAGE; buildFilters(); render(); };
  $("#continent").onchange = e => { state.cont = e.target.value; state.country = ""; state.shown = PAGE; buildFilters(); render(); };
  $("#country").onchange = e => { state.country = e.target.value; state.shown = PAGE; render(); };
  $("#sort").onchange = e => { state.sort = e.target.value; render(); };
  let qt; $("#q").oninput = e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; render(); }, 150); };
  $("#more").onclick = () => { state.shown += PAGE; render(); };
  $("#timeline").onclick = e => {
    const b = e.target.closest(".tag[data-type],.tag[data-country]"); if (!b) return;
    if (b.dataset.type) state.type = b.dataset.type;
    if (b.dataset.country) { state.country = b.dataset.country; state.cont = ""; }
    state.shown = PAGE; buildFilters(); render(); $(".filters").scrollIntoView({ behavior: "smooth" });
  };
  $("#openCal").onclick = () => { if (meta) { buildCalendar(); $("#cal").showModal(); } };
  $("#closeCal").onclick = () => $("#cal").close();
  $("#cal").addEventListener("click", e => {
    if (e.target === $("#cal")) return $("#cal").close();
    const a = e.target.closest("a[data-m]"); if (!a) return;
    e.preventDefault(); $("#cal").close(); go(+a.dataset.m, +a.dataset.d);
  });
  window.addEventListener("hashchange", () => { readHash(); fillMonthDay(); loadDay(); });
  document.addEventListener("keydown", e => {
    if (e.target.matches("input,select,textarea") || $("#cal").open) return;
    if (e.key === "ArrowLeft") shift(-1);
    if (e.key === "ArrowRight") shift(1);
  });

  function footMeta() { if (meta) $("#metaLine").textContent = ui().meta(meta.total, meta.generated); }

  readHash();
  applyI18n();
  fetch("data/meta.json").then(r => r.json()).then(m => { meta = m; footMeta(); buildFilters(); render(); }).catch(() => {});
  loadDay();
})();
