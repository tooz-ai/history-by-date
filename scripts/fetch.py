#!/usr/bin/env python3
"""Download the raw per-date JSON files from historybydate.com into raw/.

Polite: one request at a time with a short pause. Re-running skips files
that already exist unless --force is given.

    python3 scripts/fetch.py [--force]
"""
import json, sys, time, urllib.request
from pathlib import Path

BASE = "https://historybydate.com"
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
UA = "Mozilla/5.0 (personal archive mirror; CC BY-SA reuse)"
MONTH_LEN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


def dates():
    for m, n in enumerate(MONTH_LEN, 1):
        for d in range(1, n + 1):
            yield f"{m:02d}-{d:02d}"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    force = "--force" in sys.argv
    jobs = []
    for d in dates():
        jobs.append((f"{BASE}/data/{d}.json", RAW / "en" / f"{d}.json"))
        jobs.append((f"{BASE}/data/zh/{d}.json", RAW / "zh" / f"{d}.json"))
    jobs.append((f"{BASE}/data/atlas/world.json", RAW / "atlas" / "world.json"))
    failed = []
    for i, (url, out) in enumerate(jobs, 1):
        if out.exists() and not force:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        for attempt in range(3):
            try:
                body = get(url)
                json.loads(body)  # make sure it is valid JSON
                out.write_bytes(body)
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    failed.append(f"{url}: {e}")
                time.sleep(2 * (attempt + 1))
        if i % 50 == 0:
            print(f"{i}/{len(jobs)}", flush=True)
        time.sleep(0.2)
    print("done;", len(failed), "failed")
    for f in failed:
        print("  ", f)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
