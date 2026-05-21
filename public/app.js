const API_CARDS = '/api/cards';
const API_VISITS = '/api/visits';

let cardsCache = [];
let visitsCache = [];
let pendingPick = null;

// 画像オプション(ここに追記すれば選択肢が増える)
const IMAGE_OPTIONS = [
  { value: '', label: '画像なし' },
  { value: 'cafe.png', label: 'カフェ' },
  { value: 'shopping.png', label: 'ショッピング' },
  { value: 'wapper.jpg', label: 'ハンバーガー' },
];

// ---------- ユーティリティ ----------
function populateImageSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = IMAGE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function updateImagePreview(selectId, previewId) {
  const sel = document.getElementById(selectId);
  const img = document.getElementById(previewId);
  if (!sel || !img) return;
  if (sel.value) {
    img.src = `/images/${encodeURIComponent(sel.value)}`;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
    img.src = '';
  }
}

// タグ操作
function parseTags(str) {
  if (!str) return [];
  return [...new Set(str.split(',').map(t => t.trim()).filter(Boolean))];
}

function tagsToString(tags) {
  return tags.join(', ');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- fetch ----------
async function fetchCards() {
  const res = await fetch(API_CARDS);
  cardsCache = await res.json();
}
async function fetchVisits() {
  const res = await fetch(API_VISITS);
  visitsCache = await res.json();
}

// ---------- render ----------
function renderCards() {
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  if (cardsCache.length === 0) {
    list.innerHTML = '<li style="color:var(--muted);cursor:default;">まだカードがありません</li>';
    return;
  }
  cardsCache.forEach(card => {
    const li = document.createElement('li');
    li.dataset.id = card.id;
    const thumb = card.image_key
      ? `<img class="thumb" src="/images/${encodeURIComponent(card.image_key)}" alt="">`
      : `<div class="thumb-placeholder"></div>`;
    li.innerHTML = `
      ${thumb}
      <div class="card-main">
        <div class="card-title">${escapeHtml(card.title)}</div>
        ${parseTags(card.category).length
          ? `<div class="tags">${parseTags(card.category).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
          : ''}
      </div>
      <span class="chevron">›</span>
    `;
    li.addEventListener('click', () => openDetailModal(card.id));
    list.appendChild(li);
  });
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (visitsCache.length === 0) {
    list.innerHTML = '<li style="color:var(--muted)">まだ履歴はありません</li>';
    return;
  }
  visitsCache.forEach(v => {
    const date = new Date(v.visited_at + 'Z').toLocaleString('ja-JP');
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${escapeHtml(v.title || '(削除されたカード)')}</strong>
      <div class="card-meta">${date}</div>
      <div class="row-actions"><button class="visit-delete-btn" data-id="${v.id}">削除</button></div>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.visit-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteVisit(btn.dataset.id))
  );
}

function renderTagFilter() {
  const container = document.getElementById('filter-tags');
  const previouslySelected = getSelectedTags();
  const allTags = [...new Set(cardsCache.flatMap(c => parseTags(c.category)))].sort();
  container.innerHTML = allTags.map(t => `
    <button type="button" class="tag-btn ${previouslySelected.includes(t) ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>
  `).join('');
  container.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });
}

function getSelectedTags() {
  return [...document.querySelectorAll('#filter-tags .tag-btn.active')].map(b => b.dataset.tag);
}

// ---------- 初期化系 ----------
async function reloadAll() {
  await Promise.all([fetchCards(), fetchVisits()]);
  renderCards();
  renderHistory();
  renderTagFilter();
  renderWelcome();
}

function renderWelcome() {
  const area = document.getElementById('picked');
  // シャッフル中 or すでに何か表示中なら触らない
  if (isShuffling) return;
  if (area.innerHTML.trim() !== '') return;
  if (cardsCache.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🃏</div>
        <div class="empty-state-title">カードがまだありません</div>
        <div class="empty-state-desc">「Add a Card」からカードを追加するか、<br>サンプルカードを読み込んでみましょう。</div>
        <button id="load-samples-btn" class="ghost-btn" style="margin-top:0.8rem;">サンプルカードを追加する</button>
      </div>
    `;
    document.getElementById('load-samples-btn')?.addEventListener('click', loadSampleCards);
  }
}

const SAMPLE_CARDS = [
  { title: 'カフェでひとやすみ', description: '近くのカフェでコーヒーを飲みながらのんびりする', category: 'カフェ, ひとりOK', image_key: 'cafe.png' },
  { title: 'ショッピングへ行こう', description: 'ウィンドウショッピングや気になるお店を巡る', category: 'ショッピング, 友達と', image_key: 'shopping.png' },
  { title: 'ハンバーガーランチ', description: 'がっつりハンバーガーでランチタイム', category: 'ランチ, がっつり', image_key: 'wapper.jpg' },
  { title: '近所を散歩', description: '知らない路地や公園をぶらぶら歩いてみる', category: 'アウトドア, ひとりOK', image_key: '' },
  { title: '映画を観る', description: '話題の映画や気になっていた作品を観に行く', category: '映画, 友達と', image_key: '' },
];

async function loadSampleCards() {
  const btn = document.getElementById('load-samples-btn');
  if (btn) { btn.disabled = true; btn.textContent = '追加中…'; }
  for (const card of SAMPLE_CARDS) {
    await fetch(API_CARDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...card, created_by: 'サンプル', image_key: card.image_key || null }),
    });
  }
  await reloadAll();
}

// ---------- カード追加 ----------
document.getElementById('add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    category: tagsToString(parseTags(document.getElementById('category').value)),
    created_by: document.getElementById('created_by').value,
    image_key: document.getElementById('image_key').value || null,
  };
  await fetch(API_CARDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  e.target.reset();
  updateImagePreview('image_key', 'image-preview');
  reloadAll();
});

// ---------- カード削除 ----------
async function deleteCard(id) {
  if (!confirm('このカードを削除しますか?(関連する履歴も削除されます)')) return;
  await fetch(`${API_CARDS}/${id}`, { method: 'DELETE' });
  closeDetailModal();
  reloadAll();
}

// ---------- 編集モーダル ----------
function openEditModal(id) {
  const card = cardsCache.find(c => c.id == id);
  if (!card) return;
  document.getElementById('edit-id').value = card.id;
  document.getElementById('edit-title').value = card.title || '';
  document.getElementById('edit-description').value = card.description || '';
  document.getElementById('edit-category').value = card.category || '';
  document.getElementById('edit-created_by').value = card.created_by || '';
  document.getElementById('edit-image_key').value = card.image_key || '';
  updateImagePreview('edit-image_key', 'edit-image-preview');
  document.getElementById('edit-modal').showModal();
}
function closeEditModal() {
  document.getElementById('edit-modal').close();
}
document.getElementById('edit-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const payload = {
    title: document.getElementById('edit-title').value,
    description: document.getElementById('edit-description').value,
    category: tagsToString(parseTags(document.getElementById('edit-category').value)),
    created_by: document.getElementById('edit-created_by').value,
    image_key: document.getElementById('edit-image_key').value || null,
  };
  await fetch(`${API_CARDS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  closeEditModal();
  await reloadAll();
  // 詳細モーダルが開いていれば中身を更新
  if (document.getElementById('detail-modal').open) {
    openDetailModal(id);
  }
});
document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
// dialog のバックドロップクリックで閉じる
document.getElementById('edit-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});

// ---------- 詳細モーダル ----------
function openDetailModal(id) {
  const card = cardsCache.find(c => c.id == id);
  if (!card) return;
  renderDetailContent(card);
  document.getElementById('detail-modal').showModal();
}
function closeDetailModal() {
  document.getElementById('detail-modal').close();
}
function renderDetailContent(card) {
  const tags = parseTags(card.category);
  const cardVisits = visitsCache.filter(v => v.card_id == card.id);
  const container = document.getElementById('detail-content');
  container.innerHTML = `
    <h2>${escapeHtml(card.title)}</h2>
    ${card.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(card.image_key)}" alt="">` : ''}
    <div>${escapeHtml(card.description || '')}</div>
    ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="card-meta">${card.created_by ? 'BY: ' + escapeHtml(card.created_by) : ''}</div>

    <div class="detail-note">
      <label>メモ</label>
      <textarea id="detail-note-input">${escapeHtml(card.note || '')}</textarea>
      <button id="detail-save-note">メモを保存</button>
    </div>

    <div class="detail-history">
      <h3>このカードの履歴 (${cardVisits.length})</h3>
      ${cardVisits.length === 0 ? '<div style="color:var(--muted);font-size:0.85rem;">まだ訪問履歴はありません</div>' : ''}
      ${cardVisits.map(v => `
        <div class="detail-history-item">
          <span class="date">${new Date(v.visited_at + 'Z').toLocaleString('ja-JP')}</span>
          <button class="ghost-btn detail-visit-delete" data-id="${v.id}" style="font-size:0.7rem;padding:0.2rem 0.5rem;">削除</button>
        </div>
      `).join('')}
    </div>

    <div class="row-actions" style="margin-top:1.2rem;">
      <button id="detail-edit-btn">編集</button>
      <button id="detail-delete-btn" class="danger-btn">カード削除</button>
    </div>
  `;
  // イベント
  document.getElementById('detail-save-note').addEventListener('click', async () => {
    const note = document.getElementById('detail-note-input').value;
    await fetch(`${API_CARDS}/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: card.title,
        description: card.description,
        category: card.category,
        created_by: card.created_by,
        image_key: card.image_key,
        note,
      }),
    });
    await fetchCards();
    const updated = cardsCache.find(c => c.id == card.id);
    if (updated) renderDetailContent(updated);
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    closeDetailModal();
    openEditModal(card.id);
  });
  document.getElementById('detail-delete-btn').addEventListener('click', () => deleteCard(card.id));
  container.querySelectorAll('.detail-visit-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この履歴を削除しますか?')) return;
      await fetch(`${API_VISITS}/${btn.dataset.id}`, { method: 'DELETE' });
      await fetchVisits();
      const updated = cardsCache.find(c => c.id == card.id);
      if (updated) renderDetailContent(updated);
      renderHistory();
    });
  });
}
document.getElementById('detail-close').addEventListener('click', closeDetailModal);
// dialog のバックドロップクリックで閉じる
document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDetailModal();
});

// ---------- 履歴削除 ----------
async function deleteVisit(id) {
  if (!confirm('この履歴を削除しますか?')) return;
  await fetch(`${API_VISITS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

// ---------- ピック ----------
let isShuffling = false;

function showPickedResult(picked) {
  const area = document.getElementById('picked');
  const actions = document.getElementById('pick-actions');
  const tags = parseTags(picked.category);
  area.innerHTML = `
    <strong>${escapeHtml(picked.title)}</strong>
    ${picked.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(picked.image_key)}" alt="">` : ''}
    <div>${escapeHtml(picked.description || '')}</div>
    ${tags.length ? `<div class="tags" style="justify-content:center;">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  `;
  area.classList.remove('shuffle-animating');
  area.classList.add('reveal-result');
  // アニメーションクラスを少し後に除去（再利用のため）
  setTimeout(() => area.classList.remove('reveal-result'), 600);
  actions.classList.remove('hidden');
}

function doPick() {
  if (isShuffling) return;

  const selectedTags = getSelectedTags();
  const andMode = document.getElementById('filter-mode-and').checked;
  const unvisitedOnly = document.getElementById('unvisited-only').checked;

  let candidates = cardsCache.slice();
  if (selectedTags.length > 0) {
    candidates = candidates.filter(c => {
      const cardTags = parseTags(c.category);
      return andMode
        ? selectedTags.every(t => cardTags.includes(t))
        : selectedTags.some(t => cardTags.includes(t));
    });
  }
  if (unvisitedOnly) {
    const visitedIds = new Set(visitsCache.map(v => v.card_id));
    candidates = candidates.filter(c => !visitedIds.has(c.id));
  }

  const area = document.getElementById('picked');
  const actions = document.getElementById('pick-actions');
  if (cardsCache.length === 0) {
    area.classList.remove('shuffle-animating');
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🃏</div>
        <div class="empty-state-title">カードがまだありません</div>
        <div class="empty-state-desc">「Add a Card」からカードを追加してみましょう。</div>
      </div>
    `;
    actions.classList.add('hidden');
    pendingPick = null;
    return;
  }
  if (candidates.length === 0) {
    area.classList.remove('shuffle-animating');
    area.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">該当するカードがありません</div><div class="empty-state-desc">フィルター条件を変えて再度お試しください。</div></div>`;
    actions.classList.add('hidden');
    pendingPick = null;
    return;
  }

  // 最終的に引くカードを先に決める
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  pendingPick = picked;

  // --- シャッフル演出 開始 ---
  isShuffling = true;
  actions.classList.add('hidden');
  area.classList.add('shuffle-animating');

  const TOTAL_MS   = 3500; // 3.5 秒
  const FAST_PHASE = 1200; // 最初は速い
  const MID_PHASE  = 1500; // 中速
  // 残り 800ms はゆっくり

  let elapsed = 0;

  function getInterval() {
    if (elapsed < FAST_PHASE)           return 80;
    if (elapsed < FAST_PHASE + MID_PHASE) return 180;
    return 350;
  }

  function showRandomCard() {
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    area.innerHTML = `<span class="shuffle-card-title">${escapeHtml(c.title)}</span>`;
  }

  function tick() {
    if (elapsed >= TOTAL_MS) {
      // シャッフル終了 → 結果表示
      isShuffling = false;
      showPickedResult(picked);
      return;
    }
    showRandomCard();
    const interval = getInterval();
    elapsed += interval;
    setTimeout(tick, interval);
  }

  showRandomCard();
  setTimeout(tick, getInterval());
}

document.getElementById('pick-btn').addEventListener('click', doPick);
document.getElementById('pick-reroll').addEventListener('click', doPick);

// ---------- 紙吹雪 ----------
const CONFETTI_COLORS = [
  '#ff6b6b','#ffa94d','#ffe066','#69db7c',
  '#4dabf7','#cc5de8','#f783ac','#ffffff',
];
const CONFETTI_SHAPES = ['rect', 'circle', 'ribbon'];

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const PARTICLE_COUNT = 140;
  const GRAVITY        = 0.45;
  const particles = [];

  // 左右から同時に打ち上げ
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const fromLeft = i < PARTICLE_COUNT / 2;
    const shape = CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)];
    particles.push({
      x:      fromLeft ? -10 : canvas.width + 10,
      y:      canvas.height * (0.5 + Math.random() * 0.4),  // 画面下半分から発射
      vx:     fromLeft
                ? 6  + Math.random() * 9          // 右方向
                : -(6 + Math.random() * 9),        // 左方向
      vy:     -(10 + Math.random() * 14),          // 上向き
      color:  CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      shape,
      w:      shape === 'ribbon' ? 3  + Math.random() * 3  : 7 + Math.random() * 7,
      h:      shape === 'ribbon' ? 14 + Math.random() * 10 : 7 + Math.random() * 7,
      angle:  Math.random() * Math.PI * 2,
      spin:   (Math.random() - 0.5) * 0.25,
      opacity: 1,
    });
  }

  let frame;
  const DURATION = 3500; // ms
  const start = performance.now();

  function draw(now) {
    const elapsed = now - start;
    const progress = elapsed / DURATION; // 0→1
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    for (const p of particles) {
      p.x      += p.vx;
      p.vy     += GRAVITY;
      p.y      += p.vy;
      p.angle  += p.spin;
      p.vx     *= 0.985; // 空気抵抗
      // 後半フェードアウト
      p.opacity = progress < 0.65 ? 1 : 1 - (progress - 0.65) / 0.35;

      if (p.y < canvas.height + 60) alive = true;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'ribbon') {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (alive && elapsed < DURATION) {
      frame = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
    }
  }

  frame = requestAnimationFrame(draw);
}

document.getElementById('pick-confirm').addEventListener('click', async () => {
  if (!pendingPick) return;
  await fetch(API_VISITS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: pendingPick.id }),
  });
  pendingPick = null;
  document.getElementById('pick-actions').classList.add('hidden');
  document.getElementById('picked').innerHTML = '<div style="color:var(--muted);font-size:0.9rem;">記録しました 🎉</div>';
  launchConfetti();
  await fetchVisits();
  renderHistory();
});

document.getElementById('pick-cancel').addEventListener('click', () => {
  pendingPick = null;
  document.getElementById('picked').innerHTML = '';
  document.getElementById('pick-actions').classList.add('hidden');
});

// ---------- トグル ----------
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const isHidden = target.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', String(!isHidden));
    // add-card-toggle のラベル切り替え
    if (btn.classList.contains('add-card-toggle')) {
      btn.textContent = isHidden ? '＋ カードを追加' : '✕ 閉じる';
    }
  });
});

// ---------- Esc キー（dialog は標準で Esc 対応済み。追加で edit も閉じる） ----------
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // dialog.close() は Esc で自動発火するが、念のため明示的に呼ぶ
    if (document.getElementById('edit-modal').open) closeEditModal();
    if (document.getElementById('detail-modal').open) closeDetailModal();
  }
});

// ---------- 初期化 ----------
populateImageSelect('image_key');
populateImageSelect('edit-image_key');
document.getElementById('image_key').addEventListener('change', () => updateImagePreview('image_key', 'image-preview'));
document.getElementById('edit-image_key').addEventListener('change', () => updateImagePreview('edit-image_key', 'edit-image-preview'));
reloadAll();
