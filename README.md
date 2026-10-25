# 历史上的今天 · 存档版

按日期浏览世界历史事件，中英对照，每条附维基百科来源与修订版本。
在线访问：https://toozwu.github.io/history-by-date/

## 内容
- `index.html` `app.js` `style.css`：网站本体（纯静态，无需构建）
- `data/d/MM-DD.json`：366 天的事件数据（中英合并、精简字段）
- `data/meta.json`：每天条数、分类、国家等统计
- `data/map.json`：预先投影好的世界地图（由 `scripts/build_map.py` 生成）
- `data/geo.json`：国家名对照与小国坐标
- `vendor/countries-110m.json`：Natural Earth 1:110m 国界（world-atlas 2.0.2，公共领域）
- `raw-gz/`：原始数据完整存档（gzip），字段与来源站一致，含所有核查信息
- `scripts/fetch.py`：重新抓取原始数据；`scripts/build.py`：从原始数据生成 `data/`

## 更新数据
```bash
python3 scripts/fetch.py --force   # 重新下载
python3 scripts/build.py           # 重新生成 data/
python3 scripts/build_map.py       # 重新生成地图
```

## 零外部依赖
网站运行时只读取本仓库里的文件，不从任何第三方服务器加载代码或数据；没有使用任何前端库。
脚本只用 Python 标准库。

## 来源与许可
数据存档自 [historybydate.com](https://historybydate.com/)。该站声明：编辑改写内容采用 CC BY-SA 4.0；
维基百科摘录保留各条注明的许可（CC BY-SA 3.0 / 4.0）、文章和修订版本署名；部分地理数据来自 GeoNames（CC BY 4.0）。
地图国界来自 [Natural Earth](https://www.naturalearthdata.com/)（公共领域），经 world-atlas 2.0.2（ISC）转换。

本仓库的**数据**按相同条件以 CC BY-SA 4.0 发布，每条保留原始维基百科链接、修订版本与许可。
本仓库的**网站代码**（html/js/css/scripts）为独立编写，MIT 许可。
本项目为个人存档，独立于 historybydate.com 与维基媒体基金会。中文内容由 AI 辅助翻译，未经人工审校。
