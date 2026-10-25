# 历史上的今天 · 存档版

按日期浏览世界历史事件，中英对照，每条附维基百科来源、修订版本与许可；带世界地图，点国家即可筛选。

- 在线访问：https://tooz-ai.github.io/history-by-date/
- 数据规模：366 天（含 2 月 29 日），66,040 条事件，中英文齐全
- 数据存档时间：2026-10-25

---

## 一、项目原则

1. **零外部依赖**：网站运行时只读本仓库里的文件，不从任何 CDN 或第三方服务器加载代码、字体或数据；不用任何前端框架或库。
2. **脚本只用 Python 标准库**：不需要 `pip install` 任何东西。
3. **纯静态**：没有构建步骤，改完直接推送就上线。
4. **保留出处**：每条事件保留维基百科链接、修订版本和许可，改代码时不要删掉这些字段的显示。

以后加功能也请遵守上面几条。真要用第三方代码，就把它下载进 `vendor/`，并注明来源和许可。

---

## 二、目录结构

```
index.html            页面结构
app.js                全部交互逻辑（日期切换、筛选、搜索、语言、日历、地图）
style.css             样式（自动跟随系统浅色/深色）
favicon.svg           图标
.nojekyll             让 GitHub Pages 原样发布文件

data/d/MM-DD.json     366 个文件，每天的事件（网站实际读取的数据）
data/meta.json        每天条数、分类中文名、大洲、国家中文名
data/map.json         预先算好的世界地图形状（由 build_map.py 生成）
data/geo.json         国家名对照表 + 小国/小岛坐标（手工维护）

raw-gz/en/*.json.gz   原站英文原始数据的完整备份（含所有核查字段）
raw-gz/zh/*.json.gz   原站中文原始数据的完整备份
vendor/countries-110m.json   Natural Earth 1:110m 国界（地图原始数据）

scripts/fetch.py      从原站重新下载原始数据到 raw/
scripts/build.py      原始数据 → data/d/*.json、data/meta.json（顺带更新 raw-gz/）
scripts/build_map.py  vendor/ 地图 + data/geo.json → data/map.json
```

`raw/` 是下载的临时目录，已写进 `.gitignore`，不会提交。

---

## 三、本地预览

```bash
git clone https://github.com/tooz-ai/history-by-date
cd history-by-date
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

不能直接双击打开 `index.html`，因为浏览器会拦截本地文件读取，必须用上面的本地服务器。

---

## 四、常见维护操作

### 1. 原站有新内容，想同步数据

```bash
python3 scripts/fetch.py --force   # 重新下载全部 733 个文件（约 3–5 分钟，183 MB）
python3 scripts/build.py           # 生成 data/，并更新 raw-gz/ 备份
git add -A && git commit -m "Update data" && git push
```

- `fetch.py` 需要能访问 historybydate.com，在自己的 Mac 终端里运行即可。
- 不加 `--force` 时只补下载缺失的文件，适合中途断网后续传。
- 推送后 1–2 分钟网站自动更新。
- 更新前后可以对比 `data/meta.json` 里的 `total`，确认条数变化合理。

### 2. 只改了 build.py 的处理逻辑，不想重新下载

```bash
python3 scripts/build.py
```

没有 `raw/` 目录时，脚本会自动从仓库里的 `raw-gz/` 备份读取，**不需要联网**。所以就算原站以后下线了，也能随时重新生成网站数据。

### 3. 改了页面（app.js / style.css / index.html）

改完后**一定要把 `index.html` 里的版本号加 1**，不然访客浏览器会继续用缓存里的旧文件：

```html
<link rel="stylesheet" href="style.css?v=5">   ← 改成 v=6
<script src="app.js?v=5"></script>             ← 改成 v=6
```

如果改了 `data/meta.json`、`data/geo.json` 或 `data/map.json` 的格式，也要同步修改 `app.js` 里 `fetch("data/....json?v=N")` 的版本号。

### 4. 地图上某个国家没显示、或位置不对

1. 地图里的国家名用的是 Natural Earth 的写法，比如 `United States of America`、`Dem. Rep. Congo`；事件数据里可能写成 `United States`、`Democratic Republic of the Congo`。
2. 在 `data/geo.json` 的 `alias` 里加一行对照：`"事件里的名字": "地图里的名字"`。
3. 太小、在 1:110m 地图上没有形状的地方（新加坡、马耳他、香港等），在 `points` 里加经纬度：`"名字": [经度, 纬度]`。
4. 运行 `python3 scripts/build_map.py` 重新生成 `data/map.json`。
5. 按第 3 条把版本号加 1，然后推送。

### 5. 网页没更新？

- GitHub Pages 部署需要 1–2 分钟，可以在仓库的 **Actions** 页面看进度。
- 浏览器缓存约 10 分钟，强制刷新：Mac 按 `Cmd+Shift+R`。
- 发布设置在仓库 **Settings → Pages**：`Deploy from a branch`，分支 `main`，目录 `/ (root)`。

---

## 五、数据格式（data/d/MM-DD.json）

```json
{
  "date": "10-25",
  "events": [{
    "id": "source-…",              // 原站事件 ID
    "y": 1147,                     // 年份，公元前为负数
    "type": "War & conflict",      // 8 个分类之一（中文名在 meta.json）
    "loc": [["Portugal", "Europe", "葡萄牙"]],   // [国家, 大洲, 中文地点]，可能为空
    "wiki": "https://en.wikipedia.org/wiki/…",
    "rev": "https://en.wikipedia.org/w/index.php?oldid=…",   // 引用的维基修订版本
    "lic": "CC BY-SA 4.0",
    "kind": "excerpt",             // excerpt = 维基摘录；editorial = 编辑整理
    "attr": "Wikipedia contributors; …",
    "en": { "t": "标题", "s": "摘要", "n": "日期说明（可选）" },
    "zh": { "t": "标题", "s": "摘要", "n": "日期说明（可选）" }
  }]
}
```

原站的完整字段（核查证据、哈希、翻译方式等）都在 `raw-gz/` 里，`build.py` 只挑出网站要用的部分。

---

## 六、已知情况

- **中文是 AI 辅助翻译**，原站说明未经人工审校，所以每条都保留了英文原文。
- **约三分之一的事件没有具体地点**，地图下方会显示当天有多少条。
- **5 月初和 11 月初条数特别多**（11 月 8 日 1,959 条），这不是重复数据，主要是各国选举记录（"政治与社会"类）。
- 国家筛选使用现在的国名，不代表历史上的主权归属（原站同样如此）。

---

## 七、来源与许可

数据存档自 [historybydate.com](https://historybydate.com/)。该站声明：编辑改写内容采用 CC BY-SA 4.0；
维基百科摘录保留各条注明的许可（CC BY-SA 3.0 / 4.0）、文章和修订版本署名；部分地理数据来自 GeoNames（CC BY 4.0）。
地图国界来自 [Natural Earth](https://www.naturalearthdata.com/)（公共领域），经 world-atlas 2.0.2（ISC）转换。

- 本仓库的**数据**（`data/`、`raw-gz/`）按相同条件以 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 发布，每条保留原始维基百科链接、修订版本与许可。
- 本仓库的**代码**（html / js / css / scripts）为独立编写，以 MIT 许可发布，见 [LICENSE](LICENSE)。

本项目为个人存档，独立于 historybydate.com 与维基媒体基金会。
