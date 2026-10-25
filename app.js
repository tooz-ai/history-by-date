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
  let geo = { alias: {}, points: {} };
  const cache = new Map();
  const keyOf = c => geo.alias[c] || c; // merge "United States" / "United States of America" etc.

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
        if (country) {
          const k = keyOf(country);
          if (!kc[k]) kc[k] = { n: 0, label: meta?.countries?.[country] || label, en: country, seen: null };
          if (kc[k].seen !== e) { kc[k].n++; kc[k].seen = e; }
        }
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
    const countries = Object.entries(kc).filter(([k]) => !state.cont || state.events.some(e => e.loc.some(l => keyOf(l[0]) === k && l[1] === state.cont)));
    countries.sort((a, b) => b[1].n - a[1].n);
    $("#country").innerHTML = `<option value="">${t.allCountry}</option>` +
      countries.map(([k, v]) => `<option value="${esc(k)}"${state.country === k ? " selected" : ""}>${esc(state.lang === "en" ? v.en : v.label || v.en)} (${v.n})</option>`).join("");
    state.countryInfo = kc;
  }

  function filtered(skipCountry) {
    const q = state.q.trim().toLowerCase();
    let list = state.events.filter(e =>
      (!state.type || e.type === state.type) &&
      (!state.cont || e.loc.some(l => l[1] === state.cont)) &&
      (skipCountry || !state.country || e.loc.some(l => keyOf(l[0]) === state.country)) &&
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
    const locTags = e.loc.filter(l => l[0] && !seen.has(keyOf(l[0])) && seen.add(keyOf(l[0]))).slice(0, 6)
      .map(([c, , label]) => `<button class="tag" data-country="${esc(keyOf(c))}">${esc(state.lang === "en" ? c : label || c)}</button>`).join("");
    const more = e.loc.length > 6 ? `<span class="tag">+${e.loc.length - 6}</span>` : "";
    body += `<div class="tags"><button class="tag type" data-type="${esc(e.type)}">${esc(typeLabel(e.type))}</button>${locTags}${more}</div>`;
    const licUrl = /3\.0/.test(e.lic) ? "https://creativecommons.org/licenses/by-sa/3.0/" : "https://creativecommons.org/licenses/by-sa/4.0/";
    body += `<div class="src">${e.wiki ? `<a href="${esc(e.wiki)}" target="_blank" rel="noopener">${t.wiki}</a> · ` : ""}${e.kind === "excerpt" ? t.excerpt : t.editorial}${e.rev ? ` · <a href="${esc(e.rev)}" target="_blank" rel="noopener">${t.rev}</a>` : ""} · ${t.contrib} · <a href="${licUrl}" target="_blank" rel="noopener">${esc(e.lic)}</a></div>`;
    return `<article class="ev" id="${esc(e.id)}">${body}</article>`;
  }

  function render() {
    const list = filtered();
    const t = ui();
    Map2.update();
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

  // ---------- world map ----------
  // Libraries and the Natural Earth 1:110m atlas load from jsDelivr after the list
  // is shown. If they fail, the map card stays hidden and the rest still works.
  const CDN = "https://cdn.jsdelivr.net/npm/";
  const loadScript = src => new Promise((ok, no) => {
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  const Map2 = {
    ready: false, feats: {}, pos: {}, z: { k: 1, x: 0, y: 0 }, W: 960, H: 500,
    async init() {
      try {
        await loadScript(CDN + "d3-array@3.2.4/dist/d3-array.min.js");
        await loadScript(CDN + "d3-geo@3.1.1/dist/d3-geo.min.js");
        await loadScript(CDN + "topojson-client@3.1.0/dist/topojson-client.min.js");
        const atlas = await (await fetch(CDN + "world-atlas@2.0.2/countries-110m.json")).json();
        this.draw(atlas);
        this.ready = true;
        $("#mapcard").hidden = false;
        this.update();
      } catch (e) { /* map is optional */ }
    },
    draw(atlas) {
      const svg = $("#map");
      const land = topojson.feature(atlas, atlas.objects.countries).features.filter(f => f.properties.name !== "Antarctica");
      // fit to the land (not the whole globe) so there is no empty band where Antarctica would be
      const proj = d3.geoNaturalEarth1().fitWidth(this.W - 8, { type: "FeatureCollection", features: land });
      const path = d3.geoPath(proj);
      const [[, y0], [, y1]] = path.bounds({ type: "FeatureCollection", features: land });
      proj.translate([proj.translate()[0] + 4, proj.translate()[1] - y0 + 6]);
      this.H = Math.ceil(y1 - y0 + 12);
      svg.setAttribute("viewBox", `0 0 ${this.W} ${this.H}`);
      let html = `<g id="vp"><path class="sea" d="${path({ type: "Sphere" })}"/>`;
      for (const f of land) {
        const k = f.properties.name;
        if (k === "Antarctica") continue;
        // label anchor: centroid of the largest piece (keeps France on France, not French Guiana)
        let g = f.geometry;
        if (g.type === "MultiPolygon") {
          let best = null, ba = -1;
          for (const p of g.coordinates) { const a = path.area({ type: "Polygon", coordinates: p }); if (a > ba) { ba = a; best = p; } }
          g = { type: "Polygon", coordinates: best };
        }
        this.pos[k] = path.centroid(g);
        this.feats[k] = true;
        html += `<path class="land" data-k="${esc(k)}" d="${path(f)}"/>`;
      }
      for (const [k, ll] of Object.entries(geo.points)) if (!this.pos[k]) this.pos[k] = proj(ll);
      html += `<g id="bub"></g></g>`;
      svg.innerHTML = html;
      this.bindZoom(svg);
    },
    counts() {
      const c = {}; let none = 0;
      for (const e of filtered(true)) {
        const ks = new Set(e.loc.map(l => keyOf(l[0])).filter(k => this.pos[k]));
        if (!ks.size) none++;
        ks.forEach(k => c[k] = (c[k] || 0) + 1);
      }
      return { c, none };
    },
    label(k) {
      const info = state.countryInfo?.[k];
      if (info) return state.lang === "en" ? info.en : info.label || info.en;
      return k;
    },
    update() {
      if (!this.ready) return;
      const { c, none } = this.counts();
      this.c = c;
      const max = Math.max(1, ...Object.values(c));
      document.querySelectorAll("#map .land").forEach(p => {
        const n = c[p.dataset.k] || 0;
        p.classList.toggle("has", n > 0);
        p.classList.toggle("sel", state.country === p.dataset.k);
        p.style.fillOpacity = n ? (0.18 + 0.62 * Math.sqrt(n / max)).toFixed(2) : "";
      });
      this.drawBubbles();
      const t = state.lang === "en";
      const sel = state.country ? `<button class="chip on" id="mapClear">${esc(this.label(state.country))} ✕</button>` : "";
      $("#mapNote").innerHTML = `${sel}<span>${t ? "Tap a country to filter" : "点国家即可筛选"}${none ? (t ? ` · ${none} events without a place` : ` · ${none} 条没有具体地点`) : ""}</span>`;
    },
    drawBubbles() {
      const k = this.z.k, c = this.c || {};
      const max = Math.max(1, ...Object.values(c));
      const items = Object.entries(c).sort((a, b) => b[1] - a[1]);
      $("#bub").innerHTML = items.map(([key, n]) => {
        const [x, y] = this.pos[key];
        const r = (3.5 + 11 * Math.sqrt(n / max)) / Math.sqrt(k);
        const showN = r * k >= 8;
        return `<g class="b${state.country === key ? " sel" : ""}" data-k="${esc(key)}"><circle cx="${x}" cy="${y}" r="${r}"/>` +
          (showN ? `<text x="${x}" y="${y}" font-size="${(r * 0.95).toFixed(2)}">${n}</text>` : "") + `</g>`;
      }).join("");
    },
    apply() {
      const { k, x, y } = this.z;
      $("#vp").setAttribute("transform", `translate(${x},${y}) scale(${k})`);
      this.drawBubbles();
    },
    zoomAt(f, px, py) {
      const z = this.z, k = Math.min(16, Math.max(1, z.k * f)), r = k / z.k;
      z.x = px - (px - z.x) * r; z.y = py - (py - z.y) * r; z.k = k;
      this.clamp(); this.apply();
    },
    clamp() {
      const z = this.z;
      z.x = Math.min(0, Math.max(this.W - this.W * z.k, z.x));
      z.y = Math.min(0, Math.max(this.H - this.H * z.k, z.y));
    },
    svgPt(svg, cx, cy) {
      const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    },
    bindZoom(svg) {
      const ptrs = new Map(); let moved = false, last = null, pinch = null;
      svg.addEventListener("wheel", e => {
        e.preventDefault();
        const p = this.svgPt(svg, e.clientX, e.clientY);
        this.zoomAt(Math.exp(-e.deltaY * 0.0022), p.x, p.y);
      }, { passive: false });
      let downEl = null;
      svg.addEventListener("pointerdown", e => {
        downEl = e.target.closest?.("[data-k]") || null;
        ptrs.set(e.pointerId, e); moved = false; last = this.svgPt(svg, e.clientX, e.clientY);
        if (ptrs.size === 2) {
          const [a, b] = [...ptrs.values()];
          pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
        }
      });
      svg.addEventListener("pointermove", e => {
        if (!ptrs.has(e.pointerId)) { this.hover(e); return; }
        ptrs.set(e.pointerId, e);
        if (ptrs.size === 2 && pinch) {
          const [a, b] = [...ptrs.values()];
          const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const m = this.svgPt(svg, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
          this.zoomAt(d / pinch.d, m.x, m.y); pinch.d = d; moved = true; return;
        }
        const p = this.svgPt(svg, e.clientX, e.clientY);
        const dx = p.x - last.x, dy = p.y - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        if (moved && this.z.k > 1) {
          svg.setPointerCapture(e.pointerId);
          this.z.x += dx; this.z.y += dy; this.clamp(); this.apply();
          last = this.svgPt(svg, e.clientX, e.clientY);
        }
      });
      const end = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
      svg.addEventListener("pointerup", e => {
        end(e);
        if (moved) return;
        const el = downEl;
        if (!el || !(this.c || {})[el.dataset.k]) return;
        state.country = state.country === el.dataset.k ? "" : el.dataset.k;
        state.cont = ""; state.shown = PAGE; buildFilters(); render();
      });
      svg.addEventListener("pointercancel", end);
      svg.addEventListener("pointerleave", () => { $("#mapTip").hidden = true; });
      $("#zin").onclick = () => this.zoomAt(1.6, this.W / 2, this.H / 2);
      $("#zout").onclick = () => this.zoomAt(1 / 1.6, this.W / 2, this.H / 2);
      $("#zreset").onclick = () => { this.z = { k: 1, x: 0, y: 0 }; this.apply(); };
      $("#mapNote").addEventListener("click", e => {
        if (e.target.closest("#mapClear")) { state.country = ""; state.shown = PAGE; buildFilters(); render(); }
      });
    },
    hover(e) {
      const tip = $("#mapTip");
      const el = e.target.closest?.("[data-k]");
      const n = el && (this.c || {})[el.dataset.k];
      if (!n) { tip.hidden = true; return; }
      const box = $("#mapWrap").getBoundingClientRect();
      tip.textContent = state.lang === "en" ? `${this.label(el.dataset.k)} · ${n}` : `${this.label(el.dataset.k)} · ${n} 条`;
      tip.style.left = `${e.clientX - box.left + 12}px`;
      tip.style.top = `${e.clientY - box.top + 12}px`;
      tip.hidden = false;
    },
  };

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
  fetch("data/meta.json?v=3").then(r => r.json()).then(m => { meta = m; footMeta(); buildFilters(); render(); }).catch(() => {});
  fetch("data/geo.json?v=3").then(r => r.json()).catch(() => null).then(g => {
    if (g) geo = g;
    loadDay().then(() => Map2.init());
  });
})();
