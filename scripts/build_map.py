#!/usr/bin/env python3
"""Pre-project the world map so the site needs no map library at runtime.

Input:  vendor/countries-110m.json  (world-atlas 2.0.2, Natural Earth 1:110m, public domain)
        data/geo.json               (name aliases + points for very small places)
Output: data/map.json               {w, h, shapes: {name: {d, c}}, points: {name: [x, y]}}

Projection: Natural Earth I (Šavrič, Patterson, Jenny 2015), fitted to 960 px wide.
Standard library only.

    python3 scripts/build_map.py
"""
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
W, PAD = 960, 6


def natural_earth(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p
    p4 = p2 * p2
    x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, -y  # screen y grows downwards


def decode_arcs(topo):
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)
    return arcs


def ring(arcs, idx):
    out = []
    for i in idx:
        pts = arcs[i] if i >= 0 else arcs[~i][::-1]
        out.extend(pts if not out else pts[1:])
    return out


def polygons(geom):
    if geom["type"] == "Polygon":
        return [geom["arcs"]]
    if geom["type"] == "MultiPolygon":
        return geom["arcs"]
    return []


def area_centroid(pts):
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        f = x0 * y1 - x1 * y0
        a += f
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    a /= 2
    if abs(a) < 1e-12:
        return 0.0, pts[0]
    return abs(a), (cx / (6 * a), cy / (6 * a))


def main():
    topo = json.loads((ROOT / "vendor" / "countries-110m.json").read_text("utf-8"))
    geo = json.loads((ROOT / "data" / "geo.json").read_text("utf-8"))
    arcs = decode_arcs(topo)

    raw = {}  # name -> list of polygons -> list of rings (projected, unscaled)
    jumps = 0
    for g in topo["objects"]["countries"]["geometries"]:
        name = g["properties"]["name"]
        if name == "Antarctica":
            continue
        polys = []
        for poly in polygons(g):
            rings = []
            for r in poly:
                ll = ring(arcs, r)
                if any(abs(a[0] - b[0]) > 180 for a, b in zip(ll, ll[1:])):
                    # ring crosses the 180° meridian (Russia's far east, Fiji): unwrap it onto the
                    # side where most of it lies; the overhang falls outside the map edge and is clipped
                    jumps += 1
                    east = sum(1 for lon, _ in ll if lon > 0) >= len(ll) / 2
                    ll = [((lon + 360) if east and lon < 0 else (lon - 360) if not east and lon > 0 else lon, lat)
                          for lon, lat in ll]
                rings.append([natural_earth(lon, lat) for lon, lat in ll])
            polys.append(rings)
        raw[name] = polys

    # width = the whole globe at the equator; height = the land actually drawn
    x0, x1 = natural_earth(-180, 0)[0], natural_earth(180, 0)[0]
    ys = [y for polys in raw.values() for rings in polys for r in rings for _, y in r]
    y0, y1 = min(ys), max(ys)
    k = (W - 2 * PAD) / (x1 - x0)
    H = math.ceil((y1 - y0) * k + 2 * PAD)
    fit = lambda x, y: ((x - x0) * k + PAD, (y - y0) * k + PAD)

    shapes = {}
    for name, polys in raw.items():
        parts, best = [], (-1, None)
        for rings in polys:
            for i, r in enumerate(rings):
                pts = [fit(x, y) for x, y in r]
                if i == 0:  # outer ring decides where the label goes
                    a, c = area_centroid(pts)
                    if a > best[0]:
                        best = (a, c)
                d, last = [], None
                for x, y in pts:
                    q = (round(x, 1), round(y, 1))
                    if q != last:
                        d.append(f"{q[0]:g},{q[1]:g}")
                        last = q
                if len(d) >= 3:
                    parts.append("M" + "L".join(d) + "Z")
        shapes[name] = {"d": "".join(parts), "c": [round(best[1][0], 1), round(best[1][1], 1)]}

    points = {}
    for name, (lon, lat) in geo["points"].items():
        x, y = fit(*natural_earth(lon, lat))
        points[name] = [round(x, 1), round(y, 1)]

    out = {"w": W, "h": H, "source": "Natural Earth 1:110m via world-atlas 2.0.2 (public domain)",
           "shapes": shapes, "points": points}
    (ROOT / "data" / "map.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), "utf-8")
    print(f"shapes={len(shapes)} points={len(points)} size={W}x{H} antimeridian_jumps={jumps}")


if __name__ == "__main__":
    main()
