import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from './vendor/marked.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '工程/config/article_manifest.json'), 'utf8'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const localUrl = value => value.split('/').map(encodeURIComponent).join('/');
const strip = value => value.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();

for (const doc of manifest) {
  const source = fs.readFileSync(path.join(root, doc.markdown), 'utf8');
  let deep = marked.parse(source.replace(/^---\n[\s\S]*?\n---\n/, ''), { gfm: true });
  // Markdown images resolve from 原文/, whereas the reader lives in 阅读/.
  deep = deep.replace(/(?:href|src)="([^"]+)"/g, (whole, value) => {
    if (/^(?:https?:|mailto:|#|data:|\?)/.test(value)) return whole;
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { decoded = value; }
    const [file, fragment] = decoded.split('#');
    const resolved = path.resolve(root, path.dirname(doc.markdown), file);
    if (!resolved.startsWith(root + path.sep)) throw new Error(`Out-of-project dependency in ${doc.markdown}: ${value}`);
    const rel = path.relative(path.dirname(path.join(root, doc.html)), resolved).split(path.sep).join('/');
    return whole.replace(value, localUrl(rel) + (fragment ? '#' + fragment : ''));
  });
  let quick = fs.readFileSync(path.join(root, doc.quick), 'utf8');
  const mdUrl = localUrl(path.relative(path.dirname(doc.html), doc.markdown).split(path.sep).join('/'));
  quick = quick.replaceAll('{{MD_URL}}', mdUrl);
  // The complete reader shares this file with the illustrated view. Give it its
  // own IDs so a deep link never lands in a hidden quick-reading section.
  deep = deep.replace(/\bid="([^"]+)"/g, (_, id) => `id="deep-${id}"`)
    .replace(/href="#([^"]+)"/g, (_, id) => `href="#deep-${id}"`);
  quick = quick.replace(/\?view=deep#([^"\s<>]+)/g, (_, id) => `?view=deep#deep-${id}`);
  const groupedToc = [];
  const seenGroups = new Set();
  quick.replace(/<section\b[^>]*\bid="([^"]+)"[^>]*\bdata-toc-group="([^"]+)"[^>]*>/g, (_, id, label) => {
    if (!seenGroups.has(label)) { seenGroups.add(label); groupedToc.push({ id, label }); }
    return '';
  });
  const toc = [];
  quick.replace(/<h2(?:\s[^>]*?)?>([\s\S]*?)<\/h2>/g, (whole, label, offset) => {
    const previous = quick.slice(0, offset);
    const sectionId = previous.match(/<section[^>]*id="([^"]+)"[^>]*>(?:(?!<section)[\s\S])*$/)?.[1];
    const headingId = whole.match(/\bid="([^"]+)"/)?.[1];
    if (headingId || sectionId) toc.push({ id: headingId || sectionId, label: strip(label) });
    return whole;
  });
  const tocSource = groupedToc.length ? groupedToc : toc;
  const tocHtml = tocSource.map(item => `<a href="#${escape(item.id)}">${escape(item.label)}</a>`).join('');
  deep = deep.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  const document = `<!doctype html>
<html lang="zh-CN" data-theme="dark">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="document-id" content="${escape(doc.id)}"><meta name="document-version" content="${escape(doc.version)}">
<meta name="description" content="${escape(doc.summary)}"><meta name="color-scheme" content="dark">
<title>${escape(doc.title)} · 铁甲依然在</title><link rel="icon" href="../工程/assets/mark.svg" type="image/svg+xml">
<link rel="stylesheet" href="../工程/assets/article.css"><script src="../工程/assets/article.js" defer></script></head>
<body id="article-top" data-article="${escape(doc.id)}">
<a class="skip-link" href="#article-content">跳到正文</a>
<header class="article-nav"><div class="article-shell"><a class="article-brand" href="../index.html"><img src="../工程/assets/mark.svg" width="29" height="29" alt=""><span>铁甲依然在</span></a><a href="../index.html#recommended">← 推荐阅读</a></div></header>
<div class="article-shell article-heading"><p class="article-eyebrow">${escape(doc.category)}</p><h1>${escape(doc.title)}</h1><p class="article-summary">${escape(doc.summary)}</p><div class="reader-tabs" aria-label="阅读方式"><a href="?view=quick#article-top" data-view-link="quick">图解讲解</a><a href="?view=deep#deep-overview" data-view-link="deep">完整深入版</a><a class="markdown-link" href="${mdUrl}">Markdown 原文 ↗</a></div></div>
<div class="article-shell article-layout"><aside class="article-toc"><details open><summary>阅读导航</summary><nav aria-label="本文目录">${tocHtml}</nav></details><p>${escape(doc.dateNote)}</p></aside>
<main id="article-content"><div class="quick-content">${quick}</div><details class="deep-pane" id="deep-article"><summary>展开完整深入版</summary><article class="deep-content">${deep}</article></details></main></div>
<footer class="article-shell article-footer"><a href="../index.html#recommended">← 返回推荐阅读</a><span>铁甲依然在 · ${escape(doc.version)} · ${escape(doc.updated ?? '2026-11-13')}</span><a href="#article-top">回到顶部 ↑</a></footer>
<dialog class="figure-dialog" aria-label="放大图示"><button class="figure-close" type="button" aria-label="关闭放大图示">关闭 ×</button><div class="figure-dialog-content"></div></dialog>
</body></html>`;
  fs.writeFileSync(path.join(root, doc.html), document);
  console.log(`${doc.id}: ${doc.html} (${source.length} Markdown characters; ${toc.length} quick sections)`);
}
