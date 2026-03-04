// flowchart.js — 構文フローチャート（D3.js）+ DB連携 + Gemini例文生成
const Flowchart = (() => {
  let currentPlatform = 'x_twitter';
  let selected = { opening: null, middle: null, closing: null };
  let phrasesCache = { opening: [], middle: [], closing: [] };
  let isGenerating = false;

  const COLUMN_CONFIG = {
    opening: { label: '文頭パーツ', color: '#30d158' },
    middle:  { label: '文中パーツ', color: '#ffd60a' },
    closing: { label: '文末パーツ', color: '#ff453a' }
  };

  function getPhrasesByPosition(platform) {
    const data = Database.allData[platform];
    if (!data) return { opening: [], middle: [], closing: [] };
    const result = { opening: [], middle: [], closing: [] };
    for (const cat of data.categories) {
      for (const p of cat.phrases) {
        if (result[p.position]) {
          result[p.position].push({ ...p, categoryName: cat.name });
        }
      }
    }
    return result;
  }

  function render() {
    const svg = d3.select('#flowchart-svg');
    svg.selectAll('*').remove();

    phrasesCache = getPhrasesByPosition(currentPlatform);
    const columns = ['opening', 'middle', 'closing'];

    const nodeH = 34;
    const nodeGap = 5;
    const colWidth = 260;
    const gapX = 50;
    const padX = 20;
    const padY = 55;
    const maxPerCol = Math.max(...columns.map(c => phrasesCache[c].length), 1);
    const totalH = padY + maxPerCol * (nodeH + nodeGap) + 40;
    const totalW = padX * 2 + colWidth * 3 + gapX * 2;

    svg.attr('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.attr('width', '100%');
    svg.attr('height', Math.max(totalH, 500));

    columns.forEach((col, i) => {
      const x = padX + i * (colWidth + gapX) + colWidth / 2;
      svg.append('text')
        .attr('class', 'fc-column-label')
        .attr('x', x)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .text(`${COLUMN_CONFIG[col].label}`);
      svg.append('text')
        .attr('x', x).attr('y', 42)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b6f8d').attr('font-size', '10px').attr('font-family', 'inherit')
        .text(`${phrasesCache[col].length}個`);
    });

    const linksG = svg.append('g').attr('class', 'links-group');
    const nodePositions = {};

    columns.forEach((col, colIdx) => {
      const x = padX + colIdx * (colWidth + gapX);
      phrasesCache[col].forEach((phrase, idx) => {
        const y = padY + idx * (nodeH + nodeGap);
        const key = `${col}-${idx}`;
        const isSelected = selected[col] === idx;
        nodePositions[key] = { x, y, col, phrase, idx, cx: x + colWidth / 2, cy: y + nodeH / 2 };

        const g = svg.append('g')
          .attr('class', `fc-node ${isSelected ? 'selected' : ''}`)
          .on('click', () => handleNodeClick(col, idx, phrase));

        g.append('rect')
          .attr('x', x).attr('y', y)
          .attr('width', colWidth).attr('height', nodeH)
          .attr('fill', isSelected ? COLUMN_CONFIG[col].color + '25' : '#16162a')
          .attr('stroke', isSelected ? COLUMN_CONFIG[col].color : '#2a2d3a')
          .attr('stroke-width', isSelected ? 2 : 1);

        const maxChars = 18;
        const displayText = phrase.text.length > maxChars ? phrase.text.slice(0, maxChars) + '…' : phrase.text;
        g.append('text')
          .attr('x', x + 10).attr('y', y + nodeH / 2 + 4)
          .attr('font-weight', isSelected ? '700' : '500')
          .text(displayText);

        const dotX = x + colWidth - 8 - phrase.intensity * 7;
        for (let s = 0; s < phrase.intensity; s++) {
          g.append('circle')
            .attr('cx', dotX + s * 7).attr('cy', y + nodeH / 2).attr('r', 2.5)
            .attr('fill', isSelected ? COLUMN_CONFIG[col].color : COLUMN_CONFIG[col].color + '66');
        }
      });
    });

    drawLinks(linksG, nodePositions, colWidth);
    updateDetailPanel();
    updateComboResult();
    triggerGeneration();
  }

  function drawLinks(linksG, positions, colWidth) {
    const pairs = [['opening', 'middle'], ['middle', 'closing']];
    pairs.forEach(([fromCol, toCol]) => {
      if (selected[fromCol] !== null && selected[toCol] !== null) {
        const from = positions[`${fromCol}-${selected[fromCol]}`];
        const to = positions[`${toCol}-${selected[toCol]}`];
        if (from && to) {
          const x1 = from.x + colWidth;
          const x2 = to.x;
          linksG.append('path')
            .attr('class', 'fc-link active')
            .attr('d', `M${x1},${from.cy} C${x1 + 25},${from.cy} ${x2 - 25},${to.cy} ${x2},${to.cy}`);
        }
      }
    });
  }

  function handleNodeClick(col, idx) {
    selected[col] = selected[col] === idx ? null : idx;
    render();
  }

  function updateDetailPanel() {
    const el = document.getElementById('fc-detail-panel');
    const items = [];
    for (const col of ['opening', 'middle', 'closing']) {
      if (selected[col] !== null && phrasesCache[col][selected[col]]) {
        items.push({ col, phrase: phrasesCache[col][selected[col]] });
      }
    }
    if (items.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `
      <div class="fc-detail-title">選択中のパーツ</div>
      <div class="fc-detail-cards">
        ${items.map(({ col, phrase }) => `
          <div class="fc-detail-card" style="border-color: ${COLUMN_CONFIG[col].color}40">
            <div class="fc-detail-card-head">
              <span class="badge badge-${phrase.position}">${Database.POSITION_LABELS[phrase.position]}</span>
              <span class="fc-detail-card-text">「${Database.escHtml(phrase.text)}」</span>
            </div>
            <div class="toxic-meter">
              <div class="toxic-bar"><div class="toxic-fill" data-level="${phrase.intensity}"></div></div>
              <span class="toxic-label" data-level="${phrase.intensity}">${Database.TOXIC_LABELS[phrase.intensity] || ''}</span>
            </div>
            <div class="fc-detail-reality">${Database.escHtml(phrase.reality)}</div>
            <div class="fc-detail-example">${Database.escHtml(phrase.example)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function updateComboResult() {
    const el = document.getElementById('combo-result');
    const parts = [];
    for (const col of ['opening', 'middle', 'closing']) {
      if (selected[col] !== null && phrasesCache[col][selected[col]]) {
        parts.push({ col, text: phrasesCache[col][selected[col]].text, color: COLUMN_CONFIG[col].color });
      }
    }
    if (parts.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `
      <div class="combo-formula">
        ${parts.map((p, i) => `<span class="combo-part" style="color:${p.color}">「${p.text}」</span>${i < parts.length - 1 ? '<span class="combo-plus">＋</span>' : ''}`).join('')}
      </div>
    `;
  }

  // Gemini-powered generation when all 3 selected
  async function triggerGeneration() {
    const el = document.getElementById('fc-generated');
    const has3 = selected.opening !== null && selected.middle !== null && selected.closing !== null;

    if (!has3) {
      el.style.display = 'none';
      return;
    }

    const op = phrasesCache.opening[selected.opening];
    const mid = phrasesCache.middle[selected.middle];
    const cl = phrasesCache.closing[selected.closing];

    // Show loading state
    el.style.display = 'block';
    el.innerHTML = `
      <div class="fc-gen-header">
        <span class="fc-gen-title">この組み合わせで生成</span>
      </div>
      <div class="fc-gen-text fc-gen-loading">AIが生成中...</div>
    `;

    if (isGenerating) return;
    isGenerating = true;

    const result = await Generator.generateFromParts(op, mid, cl, currentPlatform);
    isGenerating = false;

    if (result && result.text) {
      renderGeneratedResult(result.text, result.annotations, op, mid, cl);
    } else {
      // Fallback to simple concatenation
      const fallbackText = buildFallbackSentence(op, mid, cl);
      renderGeneratedResult(fallbackText, [
        { type: 'opening', text: op.text, reality: op.reality },
        { type: 'middle', text: mid.text, reality: mid.reality },
        { type: 'closing', text: cl.text, reality: cl.reality },
      ], op, mid, cl, false);
    }
  }

  function renderGeneratedResult(text, annotations, op, mid, cl, isAI = true) {
    const el = document.getElementById('fc-generated');
    el.innerHTML = `
      <div class="fc-gen-header">
        <span class="fc-gen-title">この組み合わせで生成 ${isAI ? '<span class="ai-badge">AI</span>' : '<span class="rule-badge">ルールベース</span>'}</span>
        <button class="btn-copy fc-gen-copy" id="fc-copy-btn">コピー</button>
      </div>
      <div class="fc-gen-text">${Database.escHtml(text)}</div>
      <div class="fc-gen-annotations">
        ${annotations.map(a => {
          const posLabel = Database.POSITION_LABELS[a.type] || a.type;
          return `<div class="annotation-item"><span class="annotation-highlight">[${posLabel}]</span> 「${a.text}」 → <em>${a.reality}</em></div>`;
        }).join('')}
      </div>
      <div class="fc-gen-meta">
        <span style="color:${COLUMN_CONFIG.opening.color}">文頭: ${Database.escHtml(op.text)}</span>
        <span style="color:${COLUMN_CONFIG.middle.color}">文中: ${Database.escHtml(mid.text)}</span>
        <span style="color:${COLUMN_CONFIG.closing.color}">文末: ${Database.escHtml(cl.text)}</span>
      </div>
      <button class="btn-secondary fc-gen-retry" id="fc-retry-btn">別パターン</button>
    `;

    document.getElementById('fc-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('fc-copy-btn');
        btn.textContent = 'コピー済み';
        setTimeout(() => { btn.textContent = 'コピー'; }, 1500);
      });
    });

    document.getElementById('fc-retry-btn').addEventListener('click', () => {
      triggerGeneration();
    });
  }

  function buildFallbackSentence(op, mid, cl) {
    const topics = [
      '朝活を始めてから人生が変わりました',
      '副業で月5万円を達成しました',
      '転職してから毎日が充実しています',
      'フリーランスになって3年が経ちました',
      '毎朝5時に起きるようになりました',
    ];
    const fillers = [
      'これは本当に大事なことです。',
      '多くの人が気づいていません。',
      '正直、もっと早く始めればよかった。',
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    const filler = fillers[Math.floor(Math.random() * fillers.length)];
    return `${op.text}、${topic}。\n\n${mid.text}${filler}\n\n${cl.text}`;
  }

  function randomCombo() {
    const phrases = getPhrasesByPosition(currentPlatform);
    for (const col of ['opening', 'middle', 'closing']) {
      if (phrases[col].length > 0) {
        selected[col] = Math.floor(Math.random() * phrases[col].length);
      }
    }
    render();
  }

  function navigateTo(platform, text, position) {
    currentPlatform = platform;
    document.querySelectorAll('.flowchart-platform .platform-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.platform === platform);
    });
    const phrases = getPhrasesByPosition(platform);
    const idx = phrases[position]?.findIndex(p => p.text === text);
    selected = { opening: null, middle: null, closing: null };
    if (idx !== undefined && idx >= 0) {
      selected[position] = idx;
    }
    render();
  }

  function init() {
    document.querySelectorAll('.flowchart-platform .platform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.flowchart-platform .platform-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlatform = btn.dataset.platform;
        selected = { opening: null, middle: null, closing: null };
        render();
      });
    });

    document.getElementById('random-combo').addEventListener('click', randomCombo);
  }

  return { init, render, navigateTo };
})();
