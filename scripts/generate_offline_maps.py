#!/usr/bin/env python3
"""Turn downloaded OpenStreetMap way geometry into compact offline SVG basemaps."""

import json
import math
import sys
from pathlib import Path


def perpendicular_distance(point, start, end):
    if start == end:
        return math.dist(point, start)
    x, y = point
    x1, y1 = start
    x2, y2 = end
    den = (x2 - x1) ** 2 + (y2 - y1) ** 2
    t = max(0, min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / den))
    return math.dist(point, (x1 + t * (x2 - x1), y1 + t * (y2 - y1)))


def simplify(points, epsilon=1.25):
    if len(points) < 3:
        return points
    index, distance = 0, 0
    for i in range(1, len(points) - 1):
        current = perpendicular_distance(points[i], points[0], points[-1])
        if current > distance:
            index, distance = i, current
    if distance > epsilon:
        left = simplify(points[: index + 1], epsilon)
        right = simplify(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def render(source, destination, bounds):
    min_lat, min_lon, max_lat, max_lon = bounds
    width, height = 1200, 760
    data = json.loads(Path(source).read_text())
    layers = {"water": [], "motorway": [], "primary": [], "secondary": [], "rail": [], "subway": []}

    def project(lat, lon):
        x = (lon - min_lon) / (max_lon - min_lon) * width
        y = (max_lat - lat) / (max_lat - min_lat) * height
        return round(x, 1), round(y, 1)

    for element in data.get("elements", []):
        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue
        tags = element.get("tags", {})
        highway, railway, waterway = tags.get("highway"), tags.get("railway"), tags.get("waterway")
        if waterway == "river":
            layer = "water"
        elif railway == "subway":
            layer = "subway"
        elif railway == "rail":
            layer = "rail"
        elif highway in ("motorway", "trunk"):
            layer = "motorway"
        elif highway == "primary":
            layer = "primary"
        elif highway == "secondary":
            layer = "secondary"
        else:
            continue
        points = [project(point["lat"], point["lon"]) for point in geometry]
        points = simplify(points, 1.35 if layer not in ("water", "rail") else 1.8)
        if len(points) > 1:
            d = "M" + " L".join(f"{x},{y}" for x, y in points)
            layers[layer].append(d)

    styles = {
        "water": ("#8bb9c6", 6.5, ""),
        "secondary": ("#d5cdbd", 1.2, ""),
        "primary": ("#c8bda9", 2.0, ""),
        "motorway": ("#d8aa7f", 3.2, ""),
        "rail": ("#8f8173", 1.4, "5 4"),
        "subway": ("#798f86", 1.8, "2 3"),
    }
    order = ["water", "secondary", "primary", "motorway", "rail", "subway"]
    groups = []
    for layer in order:
        color, stroke_width, dash = styles[layer]
        paths = "".join(f'<path d="{d}"/>' for d in layers[layer])
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        groups.append(f'<g fill="none" stroke="{color}" stroke-width="{stroke_width}" stroke-linecap="round" stroke-linejoin="round"{dash_attr}>{paths}</g>')
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" '
        f'aria-label="OpenStreetMap 道路、铁路和河流离线底图"><rect width="{width}" height="{height}" fill="#e8ede5"/>'
        + "".join(groups)
        + '<text x="18" y="738" fill="#615f57" font-family="sans-serif" font-size="14">© OpenStreetMap contributors · offline extract</text></svg>'
    )
    Path(destination).write_text(svg)
    print(destination, len(svg))


if __name__ == "__main__":
    if len(sys.argv) != 7:
        raise SystemExit("usage: script source destination minLat minLon maxLat maxLon")
    render(sys.argv[1], sys.argv[2], tuple(map(float, sys.argv[3:7])))
