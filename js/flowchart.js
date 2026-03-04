// flowchart.js — 構文フローチャート（D3.js）
const Flowchart = (() => {
  let currentPlatform = 'x_twitter';
  let selected = { opening: null, middle: null, closing: null };

  const COLUMN_CONFIG = {
    opening: { label: '文頭パーツ', color: '#51cf66' },
    middle:  { label: '文中パーツ', color: '#fcc419' },
    closing: { label: '文末パーツ', color: '#ff6b6b' }
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

    const phrases = getPhrasesByPosition(currentPlatform);
    const columns = ['opening', 'middle', 'closing'];

    // Layout
    const nodeH = 32;
    const nodeGap = 6;
    const colWidth = 280;
    const padX = 30;
    const padY = 50;
    const maxPerCol = Math.max(...columns.map(c => phrases[c].length), 1);
    const totalH = padY + maxPerCol * (nodeH + nodeGap) + 40;
    const totalW = padX * 2 + colWidth * 3 + 60;

    svg.attr('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.attr('width', '100%');
    svg.attr('height', Math.max(totalH, 500));

    // Column labels
    columns.forEach((col, i) => {
      const x = padX + i * (colWidth + 30) + colWidth / 2;
      svg.append('text')
        .attr('class', 'fc-column-label')
        .attr('x', x)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .text(COLUMN_CONFIG[col].label);
    });

    // Links group (drawn first, behind nodes)
    const linksG = svg.append('g').attr('class', 'links-group');

    // Nodes
    const nodePositions = {};
    columns.forEach((col, colIdx) => {
      const x = padX + colIdx * (colWidth + 30);
      phrases[col].forEach((phrase, idx) => {
        const y = padY + idx * (nodeH + nodeGap);
        const key = `${col}-${idx}`;
        nodePositions[key] = { x, y, col, phrase, idx, cx: x + colWidth / 2, cy: y + nodeH / 2 };

        const g = svg.append('g')
          .attr('class', 'fc-node')
          .attr('data-col', col)
          .attr('data-idx', idx)
          .on('click', () => handleNodeClick(col, idx, phrase));

        g.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', colWidth)
          .attr('height', nodeH)
          .attr('fill', selected[col] === idx ? COLUMN_CONFIG[col].color + '44' : '#252836')
          .attr('stroke', selected[col] === idx ? COLUMN_CONFIG[col].color : '#2a2d3a');

        // Truncate text
        const maxChars = 20;
        const displayText = phrase.text.length > maxChars ? phrase.text.slice(0, maxChars) + '…' : phrase.text;

        g.append('text')
          .attr('x', x + 10)
          .attr('y', y + nodeH / 2 + 4)
          .text(displayText);

        // Intensity dots
        const starX = x + colWidth - 10 - phrase.intensity * 8;
        for (let s = 0; s < phrase.intensity; s++) {
          g.append('circle')
            .attr('cx', starX + s * 8)
            .attr('cy', y + nodeH / 2)
            .attr('r', 2.5)
            .attr('fill', COLUMN_CONFIG[col].color);
        }
      });
    });

    // Draw links between selected nodes
    drawLinks(linksG, nodePositions, phrases, colWidth);

    updateComboResult(phrases);
  }

  function drawLinks(linksG, positions, phrases, colWidth) {
    // Only draw links when nodes are selected
    const pairs = [['opening', 'middle'], ['middle', 'closing']];
    pairs.forEach(([fromCol, toCol]) => {
      if (selected[fromCol] !== null && selected[toCol] !== null) {
        const from = positions[`${fromCol}-${selected[fromCol]}`];
        const to = positions[`${toCol}-${selected[toCol]}`];
        if (from && to) {
          linksG.append('path')
            .attr('class', 'fc-link active')
            .attr('d', `M${from.x + colWidth},${from.cy} C${from.x + colWidth + 30},${from.cy} ${to.x - 30},${to.cy} ${to.x},${to.cy}`);
        }
      }
    });
  }

  function handleNodeClick(col, idx, phrase) {
    selected[col] = selected[col] === idx ? null : idx;
    render();
  }

  function updateComboResult(phrases) {
    const el = document.getElementById('combo-result');
    const parts = [];
    const labels = [];
    for (const col of ['opening', 'middle', 'closing']) {
      if (selected[col] !== null && phrases[col][selected[col]]) {
        parts.push(phrases[col][selected[col]].text);
        labels.push(`${COLUMN_CONFIG[col].label}: ${phrases[col][selected[col]].text}`);
      }
    }
    if (parts.length === 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.innerHTML = `
      <div class="combo-text">${parts.join(' + ')}</div>
      <div class="combo-parts">${labels.join(' → ')}</div>
    `;
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

  function init() {
    // Platform buttons for flowchart
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

  return { init, render };
})();
