// generator.js — 文章変換ジェネレーター（Gemini API連携 + ルールベースフォールバック）
const Generator = (() => {
  let currentStyle = 'x_twitter';
  const API_URL = 'https://sns-koubun-api.mizuki-tools.workers.dev';

  const STYLE_CONFIG = {
    x_twitter: {
      label: 'X（旧Twitter）風',
      desc: `X（旧Twitter）の情報商材・インフルエンサー界隈の投稿スタイル。
特徴: 断言調、改行多め（1文ごとに改行）、ハッシュタグ2-3個。
絵文字: 基本使わない。使っても箇条書きの記号として✅や⭐を1-2個程度。文中に絵文字を散りばめるのはNG。
口調: 「〜します」「〜です」の言い切り。体言止め多用。`
    },
    threads: {
      label: 'Threads風',
      desc: `Threadsの意識高い系・共感狙い投稿スタイル。テキスト主体のSNS。
特徴: 改行多め、前向きすぎるテンション、ポエミーな語り口、承認欲求にじみ出る。
絵文字: 控えめに1-2個。文末や段落の区切りにアクセントとして置く程度（例: 文末に✨）。絵文字まみれにはしない。
ハッシュタグ: 使わないか、あっても1-2個。`
    },
    instagram: {
      label: 'Instagram風',
      desc: `Instagramの丁寧な暮らし系キャプション。写真の補足テキスト。
特徴: 改行多め、ポエミー、丁寧語ベース、自分語り。
絵文字: ポイント的に2-3個。文頭や文末にアクセントとして置く（例: ☀️で始める、✨で締める）。大量に並べるのはNG。
ハッシュタグ: キャプション末尾にまとめて5-8個。本文中には入れない。`
    },
    linkedin: {
      label: 'LinkedIn風',
      desc: `LinkedInのビジネスポエム投稿。自慢を「学び」に偽装するスタイル。
特徴: 冒頭にキャッチーな1文（短く衝撃的）、1文ごとに改行、最後に「同意ですか？」「いいねで応援」系のCTA。
絵文字: 原則使わない。使っても見出しの先頭に→や■程度の記号的用途のみ。
ハッシュタグ: 末尾に3-4個。`
    },
    note_blog: {
      label: 'note/Blog風',
      desc: `noteの長文エッセイ風。読み物として成立する文体。
特徴: 【】で見出し、自分語り中心、読者への問いかけ、結論をあえて曖昧にして余韻を残す。
絵文字: 一切使わない。純粋なテキストのみ。
ハッシュタグ: 使わない。`
    },
    facebook: {
      label: 'Facebook風',
      desc: `Facebookの中高年・ビジネスパーソン投稿スタイル。
特徴: 近況報告、「◯◯に感謝」構文、長文だが改行少なめ、身内向け自慢。
絵文字: 控えめ。文末に1個程度（😊🙏）。大量使用はしない。
ハッシュタグ: 基本使わない。`
    },
    tiktok: {
      label: 'TikTok風',
      desc: `TikTokのキャプション・コメント風。Z世代向け。
特徴: 極端に短い文、スラング多用、煽り気味、「〜してみた」「〜な件」形式。
絵文字: 使わない。代わりにwwwや草を使う。
ハッシュタグ: キャプションに3-5個。`
    },
    youtube: {
      label: 'YouTube風',
      desc: `YouTubeのコメント欄・動画説明文風。
特徴: 「チャンネル登録お願いします」系CTA、タイムスタンプ、大げさなリアクション、サムネ的煽り文。
絵文字: 控えめ。見出しの装飾として1-2個程度。
ハッシュタグ: 説明文末尾に3-5個。`
    },
    fivech: {
      label: '5ch風',
      desc: `5ちゃんねる（旧2ちゃんねる）の匿名掲示板文体。
特徴: 匿名前提、煽り・皮肉、「〜だろ」「〜じゃね？」口調、安価(>>)参照、草（ｗｗｗ）。
絵文字: 一切使わない。代わりにｗｗｗ、（笑）、顔文字を使う。
ハッシュタグ: 使わない。`
    },
    niconico: {
      label: 'ニコニコ風',
      desc: `ニコニコ動画のコメント・大百科風。弾幕文化。
特徴: 短い感嘆、弾幕向きの繰り返し、「うぽつ」「8888」「草」、ネタコメント。
絵文字: 一切使わない。ニコニコ独自の表現（888、ｗｗｗ、wwwww）を使う。
ハッシュタグ: 使わない。`
    },
    line: {
      label: 'LINE風',
      desc: `LINEのトーク・オープンチャット風。日常会話テイスト。
特徴: 短い文を連投、スタンプの代わりの一言、既読スルーへの言及、「〜だよね」口調。
絵文字: 使わない。代わりに顔文字や「笑」を使う。LINEスタンプ文化。
ハッシュタグ: 使わない。`
    },
    mercari: {
      label: 'メルカリ風',
      desc: `メルカリの商品説明・プロフィール文風。独特のマナー文化。
特徴: 丁寧語ベース、「プロフ必読」「即購入禁止」系ルール、値下げ交渉テンプレ。
絵文字: 控えめ。見出しや区切りに1-2個（♡、☆程度）。
ハッシュタグ: 使わない。`
    },
    bereal: {
      label: 'BeReal風',
      desc: `BeRealの「リアル」を装った投稿キャプション風。
特徴: 極短キャプション、日常感演出、「盛ってない」アピール、無加工風。
絵文字: 使わない。素っ気ない文体が特徴。
ハッシュタグ: 使わない。`
    },
    bluesky: {
      label: 'Bluesky風',
      desc: `Blueskyのテック系・リベラル層投稿スタイル。旧Twitter文化の移住者多め。
特徴: X風だがより落ち着いた口調、分散型SNSへの言及、「こっちは平和」アピール。
絵文字: 基本使わない。Xよりさらに少ない。
ハッシュタグ: 使わないか1個程度。`
    },
    girls_channel: {
      label: 'ガールズちゃんねる風',
      desc: `ガールズちゃんねるの匿名女性掲示板風。
特徴: 共感・叩き・マウント、「〜だよね」「〜わ」口調、プラス/マイナス意識、主語が大きい。
絵文字: 基本使わない。「笑」「泣」を文末に使う程度。
ハッシュタグ: 使わない。`
    },
    komachi: {
      label: '発言小町風',
      desc: `読売新聞・発言小町の相談投稿風。既婚女性多め。
特徴: 丁寧な敬語、「トピ主です」、長文相談、正論レス、「それはおかしいです」系。
絵文字: 一切使わない。格式高い文体。
ハッシュタグ: 使わない。`
    },
    yahoo_chiebukuro: {
      label: 'Yahoo!知恵袋風',
      desc: `Yahoo!知恵袋のQ&A文体。
特徴: 「〜について教えてください」質問文、「ベストアンサー狙い」の長文回答、上から目線の解説。
絵文字: 一切使わない。
ハッシュタグ: 使わない。`
    },
    hatena: {
      label: 'はてな風',
      desc: `はてなブログ・はてなブックマークの文体。テック系・社会派。
特徴: 論理的風な文体、「〇〇についての私見」、ブクマカの一行コメント、増田（匿名ダイアリー）の告白体。
絵文字: 一切使わない。知的ぶった文体。
ハッシュタグ: 使わない。`
    },
    pixiv: {
      label: 'Pixiv風',
      desc: `Pixivの作品キャプション・タグ文化風。クリエイター文体。
特徴: 自虐的な「お目汚しすみません」、タグ芸、「○○が書きたかっただけ」、注意書き文化。
絵文字: 使わない。記号（※、■、▼）を装飾に使う。
ハッシュタグ: 使わない（Pixivはタグ文化だがハッシュタグ形式ではない）。`
    },
    lemon8: {
      label: 'Lemon8風',
      desc: `Lemon8のライフスタイル投稿風。Instagram系だがチュートリアル寄り。
特徴: 「〜するだけ」「〜3選」リスト形式、美容・暮らし系、丁寧だが押し付け感。
絵文字: ポイント的に2-3個。Instagram同様に文頭・文末アクセント。
ハッシュタグ: 末尾に3-5個。`
    },
    misskey: {
      label: 'Misskey風',
      desc: `Misskey/Fediverse分散SNSの投稿風。技術者・オタク層多め。
特徴: カスタム絵文字リアクション文化、MFM（Misskey Flavored Markdown）、「鯖」「連合」用語、脱中央集権アピール。
絵文字: カスタム絵文字を:emoji:形式で2-3個使う（例: :blobcat: :misskey:）。通常の絵文字は使わない。
ハッシュタグ: 使わないか1個。`
    }
  };

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

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Build prompt for Gemini
  function buildPrompt(inputText, style) {
    const config = STYLE_CONFIG[style];
    const openings = getPhrasesForStyle(style, 'opening');
    const middles = getPhrasesForStyle(style, 'middle');
    const closings = getPhrasesForStyle(style, 'closing');

    const op = openings.length > 0 ? pickRandom(openings) : null;
    const mid = middles.length > 0 ? pickRandom(middles) : null;
    const cl = closings.length > 0 ? pickRandom(closings) : null;

    const partsInstruction = [];
    const usedParts = [];
    if (op) {
      partsInstruction.push(`- 文頭に「${op.text}」を自然に組み込む`);
      usedParts.push({ type: 'opening', text: op.text, reality: op.reality });
    }
    if (mid) {
      partsInstruction.push(`- 文中に「${mid.text}」を自然に組み込む`);
      usedParts.push({ type: 'middle', text: mid.text, reality: mid.reality });
    }
    if (cl) {
      partsInstruction.push(`- 文末に「${cl.text}」を自然に組み込む`);
      usedParts.push({ type: 'closing', text: cl.text, reality: cl.reality });
    }

    const prompt = `あなたはSNS投稿の文体を完璧に模倣するエキスパートです。

以下の普通の文章を「${config.label}」に変換してください。

【変換元の文章】
${inputText}

【SNSスタイル指定】
${config.desc}

【必須：以下の構文パーツを自然に組み込むこと】
${partsInstruction.join('\n')}

【ルール】
- 変換後の文章のみを出力（説明・注釈は一切不要）
- 元の文章の意味を保ちつつ、指定SNSの空気感を完全再現
- 改行を多めに使い、SNSの投稿らしいフォーマットに
- 構文パーツは自然に文章に溶け込ませる（無理な挿入はNG）
- 絵文字の量はSNSスタイル指定に厳密に従うこと（「使わない」と指定されたら絶対に使わない）
- 100〜300文字程度`;

    return { prompt, usedParts };
  }

  // Call API
  async function callAPI(prompt) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error || 'APIエラー' };
      }
      return { ok: true, text: data.text };
    } catch (e) {
      return { ok: false, error: 'ネットワークエラー。ルールベース生成にフォールバックします。' };
    }
  }

  // Fallback: rule-based generation (original logic)
  function transformRuleBased(inputText) {
    const sentences = inputText.split(/(?<=[。！？\n])\s*/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return { text: '', annotations: [] };

    const openings = getPhrasesForStyle(currentStyle, 'opening');
    const middles = getPhrasesForStyle(currentStyle, 'middle');
    const closings = getPhrasesForStyle(currentStyle, 'closing');

    const annotations = [];
    const resultParts = [];

    sentences.forEach((sentence, i) => {
      let modified = sentence.replace(/\n/g, '').trim();
      if (i === 0 && openings.length > 0) {
        const op = pickRandom(openings);
        modified = op.text + '、' + modified;
        annotations.push({ type: 'opening', text: op.text, reality: op.reality });
      } else if (i > 0 && i < sentences.length - 1 && Math.random() > 0.5 && middles.length > 0) {
        const mid = pickRandom(middles);
        modified = mid.text + modified;
        annotations.push({ type: 'middle', text: mid.text, reality: mid.reality });
      }
      resultParts.push(modified);
      if (i < sentences.length - 1) resultParts.push('');
    });

    if (closings.length > 0) {
      resultParts.push('');
      const cl = pickRandom(closings);
      resultParts.push(cl.text);
      annotations.push({ type: 'closing', text: cl.text, reality: cl.reality });
    }

    return { text: resultParts.join('\n'), annotations };
  }

  function renderResult(text, annotations, isAI) {
    const outputEl = document.getElementById('gen-output');
    const resultEl = document.getElementById('gen-result');
    const annotEl = document.getElementById('gen-annotations');
    const labelEl = document.querySelector('.gen-output-label');
    const regenBtn = document.getElementById('regenerate-btn');

    outputEl.style.display = 'block';
    regenBtn.style.display = 'inline-block';
    labelEl.innerHTML = `${STYLE_CONFIG[currentStyle].label}に変換${isAI ? ' <span class="ai-badge">AI生成</span>' : ' <span class="rule-badge">ルールベース</span>'}`;
    resultEl.textContent = text;

    if (annotations.length > 0) {
      annotEl.innerHTML = '<div class="gen-annotations-title">使用した構文パーツ（実態暴露）</div>' +
        annotations.map(a => {
          const posLabel = Database.POSITION_LABELS[a.type] || a.type;
          return `<div class="annotation-item"><span class="annotation-highlight">[${posLabel}]</span> 「${a.text}」 → <em>${a.reality}</em></div>`;
        }).join('');
    } else {
      annotEl.innerHTML = '';
    }
  }

  function setLoading(on) {
    const btn = document.getElementById('generate-btn');
    const regen = document.getElementById('regenerate-btn');
    if (on) {
      btn.disabled = true;
      regen.disabled = true;
      btn.textContent = '生成中...';
    } else {
      btn.disabled = false;
      regen.disabled = false;
      btn.textContent = '変換する';
    }
  }

  async function doGenerate() {
    const input = document.getElementById('gen-input').value.trim();
    if (!input) return;

    setLoading(true);

    const { prompt, usedParts } = buildPrompt(input, currentStyle);
    const result = await callAPI(prompt);

    if (result.ok) {
      renderResult(result.text, usedParts, true);
    } else {
      // Fallback to rule-based
      console.warn('AI fallback:', result.error);
      const fallback = transformRuleBased(input);
      renderResult(fallback.text, fallback.annotations, false);
    }

    setLoading(false);
  }

  // Public: generate from specific parts (called by Flowchart)
  async function generateFromParts(opening, middle, closing, platform) {
    const config = STYLE_CONFIG[platform];
    if (!config) return null;

    const partsInstruction = [];
    const usedParts = [];
    if (opening) {
      partsInstruction.push(`- 文頭に「${opening.text}」を自然に組み込む`);
      usedParts.push({ type: 'opening', text: opening.text, reality: opening.reality });
    }
    if (middle) {
      partsInstruction.push(`- 文中に「${middle.text}」を自然に組み込む`);
      usedParts.push({ type: 'middle', text: middle.text, reality: middle.reality });
    }
    if (closing) {
      partsInstruction.push(`- 文末に「${closing.text}」を自然に組み込む`);
      usedParts.push({ type: 'closing', text: closing.text, reality: closing.reality });
    }

    const prompt = `あなたはSNS投稿の文体を完璧に模倣するエキスパートです。

以下の構文パーツを全て使って、「${config.label}」の典型的な投稿を1つ生成してください。

【必須：以下の構文パーツを自然に組み込むこと】
${partsInstruction.join('\n')}

【SNSスタイル指定】
${config.desc}

【ルール】
- 生成した投稿文のみを出力（説明・注釈は一切不要）
- 指定SNSの空気感を完全再現（改行の使い方、ハッシュタグ等）
- 絵文字の量はSNSスタイル指定に厳密に従うこと（「使わない」なら絶対に使わない、「1-2個」なら1-2個まで）
- 構文パーツは自然に文章に溶け込ませる
- テーマは自己啓発・副業・キャリア・朝活・マインドセット等からランダムに選択
- 100〜250文字程度`;

    const result = await callAPI(prompt);
    if (result.ok) {
      return { text: result.text, annotations: usedParts, isAI: true };
    }
    return null;
  }

  function init() {
    document.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentStyle = btn.dataset.style;
      });
    });

    document.getElementById('generate-btn').addEventListener('click', doGenerate);
    document.getElementById('regenerate-btn').addEventListener('click', doGenerate);

    document.getElementById('copy-btn').addEventListener('click', () => {
      const text = document.getElementById('gen-result').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = 'コピー済み';
        setTimeout(() => { btn.textContent = 'コピー'; }, 1500);
      });
    });
  }

  return { init, generateFromParts };
})();
