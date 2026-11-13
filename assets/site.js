/* Static HTML is the baseline. JSON refreshes let publishing stay data-driven. */
(() => {
  'use strict';
  const dataElement = document.getElementById('site-data');
  if (!dataElement) return;
  let snapshot;
  try { snapshot = JSON.parse(dataElement.textContent); }
  catch (error) { console.error('Cannot read the article snapshot.', error); return; }

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const path = (value) => String(value).split('/').map(encodeURIComponent).join('/');
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'hybrid';
  const params = new URLSearchParams(location.search);
  const safeHomes = new Set(['index.html', 'index-a.html', 'index-c.html']);
  const requestedHome = params.get('from');
  const home = document.body.dataset.home || (safeHomes.has(requestedHome) ? requestedHome : theme === 'dark' ? 'index-a.html' : 'index.html');
  const categoryUrl = (id) => 'category.html?' + new URLSearchParams({ category: id, theme, from: home }).toString();
  const getCover = (post, data) => data.postCovers[post.id] || data.covers[post.category] || data.covers.engine;

  function featureCard(post, category, lead, data) {
    return `<a class="feature-card${lead ? ' feature-lead' : ''}" href="${esc(path(post.url))}">
      <div class="feature-visual"><img src="${esc(getCover(post, data))}" width="800" height="460" alt="" decoding="async"></div>
      <div class="feature-body"><span class="feature-category">${esc(category.name)}</span><h3>${esc(post.title)}</h3><p class="feature-summary">${esc(post.oneLiner)}</p><div class="feature-bottom"><span>阅读文章</span>${data.arrow}</div></div>
    </a>`;
  }

  function topicCard(category, data) {
    return `<a class="topic-card" href="${esc(categoryUrl(category.id))}"><div class="topic-symbol">${data.icons[category.id] || data.icons.engine}</div><span class="topic-arrow">${data.arrow}</span><h3>${esc(category.name)}</h3><p>${esc(category.desc)}</p></a>`;
  }

  function renderHome(data) {
    const categories = new Map(data.catalog.categories.map((category) => [category.id, category]));
    const byId = new Map(data.catalog.posts.map((post) => [post.id, post]));
    const selected = data.featured.featured.map((item) => byId.get(item.id)).filter(Boolean).slice(0, 5);
    if (!selected.length) throw new Error('The recommendation list is empty.');
    document.getElementById('featured-grid').innerHTML = selected.map((post, index) => featureCard(post, categories.get(post.category) || { name: '' }, index === 0, data)).join('');
    document.getElementById('topic-grid').innerHTML = data.catalog.categories.map((category) => topicCard(category, data)).join('');
    const lines = data.catalog.site.heroLines;
    if (Array.isArray(lines)) document.querySelector('.hero-copy').innerHTML = lines.map((line) => `<span>${esc(line)}</span>`).join('');
  }

  function renderCategory(data) {
    const categories = data.catalog.categories;
    const selectedId = params.get('category') || categories[0]?.id;
    const category = categories.find((item) => item.id === selectedId);
    const anchors = { 'category-brand': home, 'recommended-link': home + '#recommended', 'topics-link': home + '#topics', 'return-link': home + '#topics', 'footer-home': home };
    Object.entries(anchors).forEach(([id, target]) => document.getElementById(id).setAttribute('href', target));
    document.getElementById('topic-tabs').innerHTML = categories.map((item) => `<a href="${esc(categoryUrl(item.id))}"${item.id === selectedId ? ' aria-current="page"' : ''}>${esc(item.name)}</a>`).join('');

    const list = document.getElementById('article-list');
    if (!category) {
      document.title = '未找到主题 · 铁甲依然在';
      document.getElementById('category-title').textContent = '未找到这个主题';
      document.getElementById('category-description').textContent = '请选择上方的一个主题继续阅读。';
      list.replaceChildren();
      return;
    }
    document.title = category.name + ' · 铁甲依然在';
    document.getElementById('category-title').textContent = category.name;
    document.getElementById('category-description').textContent = category.desc;
    const posts = data.catalog.posts.filter((post) => post.category === category.id);
    if (!posts.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-symbol">${data.icons[category.id] || data.icons.engine}</div><h2>这个主题，还在继续探索。</h2><p>这里暂时没有已发布的文章。</p><a href="${esc(home)}#recommended">先读推荐文章 <span aria-hidden="true">↗</span></a></div>`;
      return;
    }
    list.innerHTML = posts.map((post) => `<article class="article-item"><a class="article-main" href="${esc(path(post.url))}"><img class="article-cover" src="${esc(getCover(post, data))}" width="112" height="85" alt="" loading="lazy" decoding="async"><div class="article-text"><h2>${esc(post.title)}</h2><p>${esc(post.oneLiner)}</p></div></a><div class="article-links"><a href="${esc(path(post.url))}" aria-label="图解阅读：${esc(post.title)}">图解阅读 ↗</a><a href="${esc(path(post.md))}" aria-label="深入原文：${esc(post.title)}">深入原文 ↗</a></div></article>`).join('');
  }

  function observeCards() {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('reveal-enter');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    document.querySelectorAll('.feature-card, .topic-card').forEach((card) => observer.observe(card));
  }

  const page = document.body.dataset.page;
  if (page === 'category') renderCategory(snapshot);
  observeCards();

  // File URLs use the generated snapshot. A served site can pick up JSON-only edits.
  if (!['http:', 'https:'].includes(location.protocol)) return;
  async function readJson(name) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(name, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  Promise.all([readJson('posts.json'), readJson('featured.json')]).then(([catalog, featured]) => {
    if (!Array.isArray(catalog.posts) || !Array.isArray(catalog.categories) || !Array.isArray(featured.featured)) throw new Error('Invalid article data.');
    if (JSON.stringify(catalog) === JSON.stringify(snapshot.catalog) && JSON.stringify(featured) === JSON.stringify(snapshot.featured)) return;
    const fresh = { ...snapshot, catalog, featured };
    if (page === 'category') renderCategory(fresh);
    else renderHome(fresh);
    observeCards();
  }).catch((error) => {
    // Keep the working static page when the network or a data edit fails.
    console.warn('Using the saved article snapshot.', error.message);
  });
})();
