// generator.js — 文章変換ジェネレーター
const Generator = (() => {
  let currentStyle = 'x_twitter';

  // SNS固有フォーマット設定
  const STYLE_CONFIG = {
    x_twitter: {
      label: 'X（旧Twitter）風',
      lineBreaks: 2,
      addHashtags: true,
      hashtagCount: 3,
      wrapEmoji: false,
      addCTA: true,
      maxSentencesPerBlock: 1,
      customHashtags: ['#朝活', '#人生変わる', '#行動が全て', '#副業', '#自己投資', '#マインドセット']
    },
    threads: {
      label: 'Threads風',
      lineBreaks: 2,
      addHashtags: false,
      wrapEmoji: true,
      emojiSet: ['✨', '🌟', '💫', '🙌', '🔥', '💪', '🌈', '❤️'],
      addCTA: true,
      maxSentencesPerBlock: 1
    },
    instagram: {
      label: 'Instagram風',
      lineBreaks: 2,
      addHashtags: true,
      hashtagCount: 10,
      wrapEmoji: true,
      emojiSet: ['✨', '💕', '🌿', '☀️', '🌸', '💎', '🫶', '🤍'],
      addCTA: true,
      maxSentencesPerBlock: 2,
      customHashtags: ['#丁寧な暮らし', '#自分磨き', '#毎日が学び', '#感謝', '#日常の幸せ', '#暮らしを楽しむ', '#自分らしく', '#マインドフルネス', '#おうち時間', '#シンプルライフ']
    },
    linkedin: {
      label: 'LinkedIn風',
      lineBreaks: 2,
      addHashtags: true,
      hashtagCount: 4,
      wrapEmoji: false,
      addCTA: true,
      maxSentencesPerBlock: 1,
      addAgree: true,
      customHashtags: ['#キャリア', '#学び', '#リーダーシップ', '#成長', '#ビジネス', '#働き方']
    },
    note_blog: {
      label: 'note/Blog風',
      lineBreaks: 2,
      addHashtags: false,
      wrapEmoji: false,
      addCTA: false,
      maxSentencesPerBlock: 2,
      addHeading: true
    }
  };

  function splitSentences(text) {
    return text.split(/(?<=[。！？\n])\s*/).filter(s => s.trim().length > 0);
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getPhrasesForStyle(platform, position) {
    const data = Database.allData[platform];
    if (!data) return [];
    const result = [];
    for (const cat of data.categories) {
      for (const p of cat.phrases) {
        if (p.position === position) result.push(p);
      }
    }
    return result;
  }

  function transform(inputText) {
    const config = STYLE_CONFIG[currentStyle];
    const sentences = splitSentences(inputText);
    if (sentences.length === 0) return { text: '', annotations: [] };

    const openings = getPhrasesForStyle(currentStyle, 'opening');
    const middles = getPhrasesForStyle(currentStyle, 'middle');
    const closings = getPhrasesForStyle(currentStyle, 'closing');

    const annotations = [];
    const resultParts = [];

    // note/blog: Add heading
    if (config.addHeading) {
      const heading = pickRandom(openings);
      if (heading) {
        resultParts.push(`【${heading.text}】`);
        annotations.push({ type: 'opening', text: heading.text, reality: heading.reality });
        resultParts.push('');
      }
    }

    // Process sentences
    sentences.forEach((sentence, i) => {
      let modified = sentence.replace(/\n/g, '').trim();

      // Opening phrase for first sentence (or random insertion)
      if (i === 0 && !config.addHeading && openings.length > 0) {
        const op = pickRandom(openings);
        modified = op.text + '、' + modified;
        annotations.push({ type: 'opening', text: op.text, reality: op.reality });
      } else if (i > 0 && i < sentences.length - 1 && Math.random() > 0.5 && middles.length > 0) {
        const mid = pickRandom(middles);
        modified = mid.text + modified;
        annotations.push({ type: 'middle', text: mid.text, reality: mid.reality });
      }

      // Wrap with emoji (Threads/Instagram)
      if (config.wrapEmoji && config.emojiSet) {
        const emoji = pickRandom(config.emojiSet);
        if (Math.random() > 0.4) {
          modified = emoji + ' ' + modified;
        }
      }

      resultParts.push(modified);

      // Add line breaks between sentences
      if (i < sentences.length - 1 && config.lineBreaks > 1) {
        resultParts.push('');
      }
    });

    // Closing phrase
    if (closings.length > 0) {
      resultParts.push('');
      const cl = pickRandom(closings);
      let closingText = cl.text;

      if (config.wrapEmoji && config.emojiSet) {
        closingText = pickRandom(config.emojiSet) + ' ' + closingText;
      }
      resultParts.push(closingText);
      annotations.push({ type: 'closing', text: cl.text, reality: cl.reality });
    }

    // LinkedIn "agree?" pattern
    if (config.addAgree) {
      resultParts.push('');
      resultParts.push('同意していただける方は「いいね」をお願いします。');
      annotations.push({ type: 'closing', text: '同意を求める', reality: 'エンゲージメント稼ぎの定番パターン' });
    }

    // Hashtags
    if (config.addHashtags && config.customHashtags) {
      resultParts.push('');
      const tags = [];
      const shuffled = [...config.customHashtags].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(config.hashtagCount, shuffled.length); i++) {
        tags.push(shuffled[i]);
      }
      resultParts.push(tags.join(' '));
    }

    return {
      text: resultParts.join('\n'),
      annotations
    };
  }

  function renderResult(result) {
    const outputEl = document.getElementById('gen-output');
    const resultEl = document.getElementById('gen-result');
    const annotEl = document.getElementById('gen-annotations');
    const labelEl = document.querySelector('.gen-output-label');
    const regenBtn = document.getElementById('regenerate-btn');

    outputEl.style.display = 'block';
    regenBtn.style.display = 'inline-block';
    labelEl.textContent = `${STYLE_CONFIG[currentStyle].label}に変換:`;

    resultEl.textContent = result.text;

    if (result.annotations.length > 0) {
      annotEl.innerHTML = '<div class="gen-annotations-title">使用した構文パーツ（実態暴露）</div>' +
        result.annotations.map(a => {
          const posLabel = Database.POSITION_LABELS[a.type] || a.type;
          return `<div class="annotation-item"><span class="annotation-highlight">[${posLabel}]</span> 「${a.text}」 → <em>${a.reality}</em></div>`;
        }).join('');
    } else {
      annotEl.innerHTML = '';
    }
  }

  function init() {
    // Style buttons
    document.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStyle = btn.dataset.style;
      });
    });

    // Generate
    const genBtn = document.getElementById('generate-btn');
    const regenBtn = document.getElementById('regenerate-btn');

    function doGenerate() {
      const input = document.getElementById('gen-input').value.trim();
      if (!input) return;
      const result = transform(input);
      renderResult(result);
    }

    genBtn.addEventListener('click', doGenerate);
    regenBtn.addEventListener('click', doGenerate);

    // Copy
    document.getElementById('copy-btn').addEventListener('click', () => {
      const text = document.getElementById('gen-result').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = 'コピー済み!';
        setTimeout(() => { btn.textContent = 'コピー'; }, 1500);
      });
    });
  }

  return { init };
})();
