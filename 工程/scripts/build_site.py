#!/usr/bin/env python3
"""Build static entry pages and their offline data snapshot using only stdlib."""

import html
import json
import os
from pathlib import Path
import re
from urllib.parse import quote, urlencode

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = Path(__file__).resolve().parent / "site-templates"
ARROW = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
SYMBOL_PATHS = {
    "reliability": '<path d="m20 3 13 5v11c0 8-8 14-13 18C15 33 7 27 7 19V8l13-5Z"/><path d="m13 19 5 5 10-12"/>',
    "aiNative": '<path d="m20 3 15 9-15 9-15-9 15-9Z"/><path d="m5 20 15 9 15-9M5 28l15 9 15-9M20 21v16"/>',
    "engine": '<rect x="10" y="10" width="20" height="20" rx="5"/><rect x="16" y="16" width="8" height="8" rx="2"/><path d="M15 3v7m10-7v7M15 30v7m10-7v7M3 15h7m-7 10h7m20-10h7m-7 10h7"/>',
    "trends": '<circle cx="20" cy="20" r="13"/><ellipse cx="20" cy="20" rx="6" ry="13"/><path d="M7 20h26M10 12h20M10 28h20M31 4l5 1-1 5M36 5l-8 8"/>',
    "practice": '<path d="m12 10-9 10 9 10m16-20 9 10-9 10M24 5l-8 30"/>',
}
ICONS = {key: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>' for key, paths in SYMBOL_PATHS.items()}
COVERS = {
    "reliability": "工程/assets/covers/context.svg",
    "aiNative": "工程/assets/covers/evidence.svg",
    "engine": "工程/assets/covers/boundary.svg",
    "trends": "工程/assets/covers/world.svg",
    "practice": "工程/assets/covers/code.svg",
}
POST_COVERS = {"04": "工程/assets/covers/boundary.svg", "11": "工程/assets/covers/loop.svg", "12": "工程/assets/covers/world.svg", "13": "工程/assets/covers/boundary.svg", "14": "工程/assets/covers/code.svg", "15": "工程/assets/covers/work-organization.svg"}


def esc(value):
    return html.escape(str(value), quote=True)


def href(path):
    return quote(path, safe="/")


def cover(post):
    return POST_COVERS.get(post["id"], COVERS.get(post["category"], COVERS["engine"]))


def category_url(category):
    return href("工程/pages/category.html") + "?" + urlencode({"category": category})


def feature_card(post, category, lead=False, summary=None):
    lead_class = " feature-lead" if lead else ""
    return f'''<a class="feature-card{lead_class}" href="{esc(href(post['url']))}">
  <div class="feature-visual"><img src="{esc(cover(post))}" width="800" height="460" alt="" decoding="async"></div>
  <div class="feature-body"><span class="feature-category">{esc(category['name'])}</span><h3>{esc(post['title'])}</h3><p class="feature-summary">{esc(summary or post['oneLiner'])}</p><div class="feature-bottom"><span>阅读文章</span>{ARROW}</div></div>
</a>'''


def topic_card(category):
    symbol = ICONS.get(category["id"], ICONS["engine"])
    return f'''<a class="topic-card" href="{esc(category_url(category['id']))}"><div class="topic-symbol">{symbol}</div><span class="topic-arrow">{ARROW}</span><h3>{esc(category['name'])}</h3><p>{esc(category['desc'])}</p></a>'''


def fill(template, values):
    def substitute(match):
        key = match.group(1)
        if key not in values:
            raise ValueError(f"Missing template variable: {key}")
        return str(values[key])
    return re.sub(r"\{\{([A-Z_]+)\}\}", substitute, template)


def build():
    project = json.loads((ROOT / "工程/config/project.json").read_text())
    layout = project["repository_layout"]
    allowed = set(layout["root_files"] + layout["root_directories"] + [".git", ".DS_Store"])
    unexpected = sorted(item.name for item in ROOT.iterdir() if item.name not in allowed)
    if unexpected:
        raise ValueError(f"Files outside the agreed repository layout: {unexpected}")
    catalog = json.loads((ROOT / "工程/config/posts.json").read_text())
    featured = json.loads((ROOT / "工程/config/featured.json").read_text())
    posts = {post["id"]: post for post in catalog["posts"]}
    categories = {category["id"]: category for category in catalog["categories"]}
    if len(posts) != len(catalog["posts"]) or len(categories) != len(catalog["categories"]):
        raise ValueError("Post and category IDs must be unique")
    featured_items = featured["featured"]
    chosen = [item["id"] for item in featured_items]
    if not 3 <= len(chosen) <= 5 or len(set(chosen)) != len(chosen):
        raise ValueError("Choose 3–5 distinct featured posts; the first is the lead")
    for post in posts.values():
        if post["category"] not in categories:
            raise ValueError(f"Unknown category: {post['category']}")
        for field in ("url", "md"):
            target = (ROOT / post[field]).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file():
                raise ValueError(f"Missing or invalid article path: {post[field]}")
        if not (ROOT / cover(post)).is_file():
            raise ValueError(f"Missing cover: {cover(post)}")
    for post_id in chosen:
        if post_id not in posts:
            raise ValueError(f"Unknown featured post: {post_id}")

    data = {"catalog": catalog, "featured": featured, "icons": ICONS, "arrow": ARROW, "covers": COVERS, "postCovers": POST_COVERS}
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    content = "\n".join(feature_card(posts[post_id], categories[posts[post_id]["category"]], index == 0, featured_items[index].get("summary")) for index, post_id in enumerate(chosen))
    template = (TEMPLATES / "home.html").read_text()
    bootstrap = """<script>(()=>{let t='dark';try{t=localStorage.getItem('show-theme')||t;}catch{}const q=new URLSearchParams(location.search).get('theme');if(q==='dark'||q==='hybrid')t=q;document.documentElement.dataset.theme=t==='hybrid'?'hybrid':'dark';})();</script>"""
    sun = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    shared = {"DATA": serialized, "THEME_BOOTSTRAP": bootstrap, "THEME_ICON": sun}
    values = {
        **shared,
        "TITLE": esc(catalog["site"]["title"]),
        "DESCRIPTION": esc(catalog["site"]["tagline"]),
        "HERO_COPY": "".join(f"<span>{esc(line)}</span>" for line in catalog["site"]["heroLines"]),
        "FEATURED": content,
        "TOPICS": "\n".join(topic_card(category) for category in catalog["categories"]),
        "HOME": "index.html",
        "MARK": href("工程/assets/mark.svg"),
        "CSS": href("工程/assets/site.css"),
        "JS": href("工程/assets/site.js"),
    }
    (ROOT / "index.html").write_text(fill(template, values))
    category = ROOT / layout["category_page"]
    relative = lambda target: href(os.path.relpath(ROOT / target, category.parent).replace(os.sep, "/"))
    category_values = {
        **shared, "HOME": relative("index.html"),
        "MARK": relative("工程/assets/mark.svg"),
        "CSS": relative("工程/assets/site.css"),
        "JS": relative("工程/assets/site.js"),
    }
    category.write_text(fill((TEMPLATES / "category.html").read_text(), category_values))
    print(f"Built index.html and {category.relative_to(ROOT)}; validated {len(posts)} article pairs and {len(chosen)} recommendations.")


if __name__ == "__main__":
    build()
