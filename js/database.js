// database.js — 構文DB閲覧機能
const Database = (() => {
  let allData = {};        // { platform_id: { platform_name, categories: [...] } }
  let allPhrases = [];     // flattened: [{ text, position, ... , platform, platformName, category, categoryName }]
  let currentPlatform = 'all';
  let currentCategory = null;
  let currentPosition = 'all';
  let currentIntensity = 'all';
  let searchQuery = '';

  const PLATFORM_FILES = [
    'x_twitter', 'threads', 'instagram', 'linkedin', 'note_blog'
  ];

  const POSITION_LABELS = {
    opening: '文頭',
    middle: '文中',
    closing: '文末'
  };

  async function loadAll() {
    const promises = PLATFORM_FILES.map(async (id) => {
      const res = await fetch(`data/${id}.json`);
      return res.json();
    });
    const results = await Promise.all(promises);
    results.forEach((data) => {
      allData[data.platform] = data;
    });
    flattenPhrases();
    return allData;
  }

  function flattenPhrases() {
    allPhrases = [];
    for (const [platformId, data] of Object.entries(allData)) {
      for (const cat of data.categories) {
        for (const phrase of cat.phrases) {
          allPhrases.push({
            ...phrase,
            platform: platformId,
            platformName: data.platform_name,
            category: cat.id,
            categoryName: cat.name
          });
        }
      }
    }
  }

  function getFiltered() {
    return allPhrases.filter(p => {
      if (currentPlatform !== 'all' && p.platform !== currentPlatform) return false;
      if (currentCategory && p.category !== currentCategory) return false;
      if (currentPosition !== 'all' && p.position !== currentPosition) return false;
      if (currentIntensity !== 'all' && p.intensity < parseInt(currentIntensity)) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.text.toLowerCase().includes(q) ||
          p.example.toLowerCase().includes(q) ||
          p.reality.toLowerCase().includes(q) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
        );
      }
      return true;
    });
  }

  function getCategories() {
    const target = currentPlatform === 'all'
      ? Object.values(allData)
      : [allData[currentPlatform]].filter(Boolean);

    const catMap = {};
    for (const data of target) {
      for (const cat of data.categories) {
        if (!catMap[cat.id]) {
          catMap[cat.id] = { id: cat.id, name: cat.name, count: 0 };
        }
        catMap[cat.id].count += cat.phrases.length;
      }
    }
    return Object.values(catMap).sort((a, b) => b.count - a.count);
  }

  function renderCategories() {
    const el = document.getElementById('category-list');
    const cats = getCategories();
    el.innerHTML = cats.map(c => `
      <button class="category-chip ${currentCategory === c.id ? 'active' : ''}" data-category="${c.id}">
        ${c.name}<span class="count">${c.count}</span>
      </button>
    `).join('');

    el.querySelectorAll('.category-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = currentCategory === btn.dataset.category ? null : btn.dataset.category;
        render();
      });
    });
  }

  function renderPhrases() {
    const filtered = getFiltered();
    document.getElementById('result-count').textContent = filtered.length;

    const grid = document.getElementById('phrase-grid');
    if (filtered.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">該当する構文がありません</div></div>`;
      return;
    }

    const TOXIC_LABELS = { 1: '微毒', 2: '弱毒', 3: '中毒', 4: '猛毒', 5: '致死量' };

    grid.innerHTML = filtered.map(p => `
      <div class="phrase-card" data-intensity="${p.intensity}">
        <div class="phrase-card-inner">
          <div class="phrase-card-header">
            <span class="phrase-text">「${escHtml(p.text)}」</span>
            <div class="phrase-badges">
              <span class="badge badge-${p.position}">${POSITION_LABELS[p.position] || p.position}</span>
              ${currentPlatform === 'all' ? `<span class="badge badge-platform">${escHtml(shortPlatform(p.platform))}</span>` : ''}
            </div>
          </div>
          <div class="toxic-meter">
            <div class="toxic-bar"><div class="toxic-fill" data-level="${p.intensity}"></div></div>
            <span class="toxic-label" data-level="${p.intensity}">${TOXIC_LABELS[p.intensity] || ''}</span>
          </div>
          <div class="phrase-reality">${escHtml(p.reality)}</div>
          <div class="phrase-example">${escHtml(p.example)}</div>
          ${p.tags ? `<div class="phrase-tags">${p.tags.map(t => `<span class="tag">#${escHtml(t)}</span>`).join('')}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  function shortPlatform(id) {
    const map = { x_twitter: 'X', threads: 'Threads', instagram: 'Insta', linkedin: 'LinkedIn', note_blog: 'note' };
    return map[id] || id;
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function render() {
    renderCategories();
    renderPhrases();
  }

  function init() {
    // Platform buttons
    document.querySelectorAll('#tab-database .platform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tab-database .platform-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlatform = btn.dataset.platform;
        currentCategory = null;
        render();
      });
    });

    // Position filter
    document.querySelectorAll('[data-position]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-position]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPosition = btn.dataset.position;
        render();
      });
    });

    // Intensity filter
    document.querySelectorAll('[data-intensity]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-intensity]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentIntensity = btn.dataset.intensity;
        render();
      });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        render();
      }, 200);
    });
  }

  return { loadAll, init, render, allData, getAllPhrases: () => allPhrases, POSITION_LABELS };
})();
