#!/usr/bin/env python3
"""Turn raw/{en,zh}/MM-DD.json into the slim files the site reads.

Output:
  data/d/MM-DD.json   one file per date, both languages merged
  data/meta.json      counts per date, totals, label tables
  raw-gz/...          gzip copies of the full raw files (complete archive)

    python3 scripts/build.py
"""
import gzip, json, shutil
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
OUT = ROOT / "data"
RAWGZ = ROOT / "raw-gz"

TYPE_ZH = {
    "Politics & society": "政治与社会",
    "War & conflict": "战争与冲突",
    "Sport": "体育",
    "Arts & culture": "艺术与文化",
    "Disasters": "灾难",
    "Exploration": "探索",
    "Technology & industry": "科技与工业",
    "Science & discovery": "科学与发现",
}
CONTINENT_ZH = {
    "Africa": "非洲", "Asia": "亚洲", "Europe": "欧洲",
    "North America": "北美洲", "South America": "南美洲",
    "Oceania": "大洋洲", "Antarctica": "南极洲",
}
EDITORIAL_LICENSE = "CC BY-SA 4.0"


def slim(e, z):
    c = e.get("content") or {}
    locs = e.get("locations") or []
    labels = (z or {}).get("locationLabels") or []
    rev = c.get("revision")
    if not rev:
        rev = next((s for s in e.get("sources") or [] if "oldid=" in s), None)
    out = {
        "id": e["id"],
        "y": e.get("year"),
        "type": e.get("type"),
        "loc": [
            [l.get("country"), l.get("continent"), labels[i] if i < len(labels) else l.get("label")]
            for i, l in enumerate(locs)
        ],
        "wiki": e.get("wikipedia"),
        "rev": rev,
        "lic": c.get("license") or EDITORIAL_LICENSE,
        "kind": "excerpt" if c.get("method") == "source-excerpt" else "editorial",
        "en": {"t": e.get("title"), "s": e.get("summary")},
        "zh": {"t": (z or {}).get("title"), "s": (z or {}).get("summary")},
    }
    if e.get("dateNote"):
        out["en"]["n"] = e["dateNote"]
    if z and z.get("dateNote"):
        out["zh"]["n"] = z["dateNote"]
    if c.get("attribution"):
        out["attr"] = c["attribution"]
    return out


def main():
    (OUT / "d").mkdir(parents=True, exist_ok=True)
    counts, types, continents, countries = {}, Counter(), Counter(), {}
    total = missing_zh = 0
    for f in sorted((RAW / "en").glob("*.json")):
        d = f.stem
        en = json.loads(f.read_text("utf-8"))
        zh = json.loads((RAW / "zh" / f.name).read_text("utf-8")).get("events", {})
        events = []
        for e in en["events"]:
            z = zh.get(e["id"])
            if not z:
                missing_zh += 1
            s = slim(e, z)
            events.append(s)
            types[s["type"]] += 1
            for country, cont, label in s["loc"]:
                continents[cont] += 1
                countries.setdefault(country, Counter())[label] += 1
        events.sort(key=lambda x: (x["y"] if x["y"] is not None else 0))
        (OUT / "d" / f"{d}.json").write_text(
            json.dumps({"date": d, "events": events}, ensure_ascii=False, separators=(",", ":")),
            "utf-8",
        )
        counts[d] = len(events)
        total += len(events)

    meta = {
        "generated": date.today().isoformat(),
        "source": "https://historybydate.com/",
        "total": total,
        "counts": counts,
        "types": {k: {"zh": TYPE_ZH.get(k, k), "n": n} for k, n in types.most_common()},
        "continents": {k: CONTINENT_ZH.get(k, k) for k, _ in continents.most_common() if k},
        # Chinese country name = the most common location label (labels can carry a city, e.g. "法国巴黎")
        "countries": {k: v.most_common(1)[0][0] for k, v in sorted(countries.items(), key=lambda kv: kv[0] or "")},
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")

    # gzip copy of the complete raw archive
    for src in RAW.rglob("*.json"):
        dst = RAWGZ / src.relative_to(RAW).with_suffix(".json.gz")
        dst.parent.mkdir(parents=True, exist_ok=True)
        with open(src, "rb") as fi, gzip.open(dst, "wb", compresslevel=9) as fo:
            shutil.copyfileobj(fi, fo)

    print(f"dates={len(counts)} events={total} missing_zh={missing_zh} types={len(types)} countries={len(countries)}")


if __name__ == "__main__":
    main()
