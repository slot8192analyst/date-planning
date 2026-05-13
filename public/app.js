const API_CARDS = '/api/cards';
const API_VISITS = '/api/visits';

let cardsCache = [];
let visitsCache = [];
let pendingPick = null; // ピックしたけどまだ確定していないカード

// ---------- 画像選択肢 ----------
const IMAGE_OPTIONS = [
  { value: '', label: '画像なし' },
  { value: 'cafe.png', label: 'カフェ' },
  { value: 'shopping.png', label: 'ショッピング' },
];

function populateImageSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = IMAGE_OPTIONS.map(o =>
    `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
  ).join('');
}

function updateImagePreview(selectId, previewId) {
  const select = document.getElementById(selectId);
  const preview = document.getElementById(previewId);
  if (!select || !preview) return;
  const value = select.value;
  if (value) {
    preview.src = `/images/${encodeURIComponent(value)}`;
    preview.classList.remove('hidden');
  } else {
    preview.src = '';
    preview.classList.add('hidden');
  }
}

// ---------- 取得 ----------
async function fetchCards() {
  const res = await fetch(API_CARDS);
  cardsCache = await res.json();
}
async function fetchVisits() {
  const res = await fetch(API_VISITS);
  visitsCache = await res.json();
}

// ---------- 描画：カード一覧（コンパクト） ----------
function renderCards() {
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  cardsCache.forEach(card => {
    const li = document.createElement('li');
    li.dataset.id = card.id;
    const thumb = card.image_key
      ? `<img class="compact-thumb" src="/images/${encodeURIComponent(card.image_key)}" alt="">`
      : `<div class="compact-thumb-placeholder"></div>`;
    li.innerHTML = `
      ${thumb}
      <div class="compact-body">
        <div class="compact-title">${escapeHtml(card.title)}</div>
        <div class="compact-meta">
          ${card.category ? escapeHtml(card.category) : ''}
          ${card.note ? ' / NOTE有' : ''}
        </div>
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
      <strong>${escapeHtml(v.title || '（削除されたカード）')}</strong>
      <div class="card-meta">${date}</div>
      <div class="row-actions">
        <button class="visit-delete-btn" data-id="${v.id}">削除</button>
      </div>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.visit-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteVisit(btn.dataset.id))
  );
}

function renderCategoryFilter() {
  const select = document.getElementById('filter-category');
  const current = select.value;
  const categories = [...new Set(cardsCache.map(c => c.category).filter(Boolean))];
  select.innerHTML = '<option value="">すべて</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = current;
}

async function reloadAll() {
  await Promise.all([fetchCards(), fetchVisits()]);
  renderCards();
  renderHistory();
  renderCategoryFilter();
  // 詳細モーダルが開いていれば再描画
  const detail = document.getElementById('detail-modal');
  if (!detail.classList.contains('hidden')) {
    const id = detail.dataset.currentId;
    if (id) renderDetailContent(id);
  }
}

// ---------- カード追加 ----------
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    category: document.getElementById('category').value,
    created_by: document.getElementById('created_by').value,
    image_key: document.getElementById('image_key').value || null,
    note: '',
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

// ---------- 詳細モーダル ----------
function openDetailModal(id) {
  const modal = document.getElementById('detail-modal');
  modal.dataset.currentId = id;
  renderDetailContent(id);
  modal.classList.remove('hidden');
}

function renderDetailContent(id) {
  const card = cardsCache.find(c => c.id == id);
  if (!card) {
    closeDetailModal();
    return;
  }

  document.getElementById('detail-title').textContent = card.title;

  const img = document.getElementById('detail-image');
  if (card.image_key) {
    img.src = `/images/${encodeURIComponent(card.image_key)}`;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }

  document.getElementById('detail-description').textContent = card.description || '';

  const meta = [];
  if (card.category) meta.push('CATEGORY: ' + card.category);
  if (card.created_by) meta.push('BY: ' + card.created_by);
  document.getElementById('detail-meta').textContent = meta.join(' / ');

  document.getElementById('detail-note').value = card.note || '';

  // このカードの履歴のみ表示
  const history = visitsCache.filter(v => v.card_id == id);
  const histList = document.getElementById('detail-history');
  histList.innerHTML = '';
  if (history.length === 0) {
    histList.innerHTML = '<li style="color:var(--muted)">履歴なし</li>';
  } else {
    history.forEach(v => {
      const date = new Date(v.visited_at + 'Z').toLocaleString('ja-JP');
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="card-meta">${date}</div>
        <div class="row-actions">
          <button class="visit-delete-btn" data-id="${v.id}">削除</button>
        </div>
      `;
      histList.appendChild(li);
    });
    histList.querySelectorAll('.visit-delete-btn').forEach(btn =>
      btn.addEventListener('click', () => deleteVisit(btn.dataset.id))
    );
  }
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
}

document.querySelectorAll('[data-close-detail]').forEach(el =>
  el.addEventListener('click', closeDetailModal)
);

document.getElementById('detail-save-note').addEventListener('click', async () => {
  const id = document.getElementById('detail-modal').dataset.currentId;
  const card = cardsCache.find(c => c.id == id);
  if (!card) return;
  const note = document.getElementById('detail-note').value;
  await fetch(`${API_CARDS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: card.title,
      description: card.description,
      category: card.category,
      created_by: card.created_by,
      image_key: card.image_key,
      note: note,
    }),
  });
  await reloadAll();
});

document.getElementById('detail-edit-btn').addEventListener('click', () => {
  const id = document.getElementById('detail-modal').dataset.currentId;
  closeDetailModal();
  openEditModal(id);
});

document.getElementById('detail-delete-btn').addEventListener('click', async () => {
  const id = document.getElementById('detail-modal').dataset.currentId;
  if (!confirm('このカードを削除しますか？\n（関連する訪問履歴もすべて削除されます）')) return;
  await fetch(`${API_CARDS}/${id}`, { method: 'DELETE' });
  closeDetailModal();
  reloadAll();
});

// ---------- カード編集モーダル ----------
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

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const card = cardsCache.find(c => c.id == id);
  const payload = {
    title: document.getElementById('edit-title').value,
    description: document.getElementById('edit-description').value,
    category: document.getElementById('edit-category').value,
    created_by: document.getElementById('edit-created_by').value,
    image_key: document.getElementById('edit-image_key').value || null,
    note: card ? (card.note || '') : '', // noteは詳細モーダルで編集するのでここは保持
  };
  await fetch(`${API_CARDS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  closeEditModal();
  reloadAll();
});

document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
document.querySelector('#edit-modal .modal-backdrop').addEventListener('click', closeEditModal);

// Escキーで開いているモーダルを閉じる
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeDetailModal();
  }
});

// ---------- 履歴削除 ----------
async function deleteVisit(id) {
  if (!confirm('この履歴を削除しますか？')) return;
  await fetch(`${API_VISITS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

// ---------- ピック ----------
function doPick() {
  const filterCategory = document.getElementById('filter-category').value;
  const unvisitedOnly = document.getElementById('unvisited-only').checked;

  let candidates = cardsCache.slice();
  if (filterCategory) {
    candidates = candidates.filter(c => c.category === filterCategory);
  }
  if (unvisitedOnly) {
    const visitedIds = new Set(visitsCache.map(v => v.card_id));
    candidates = candidates.filter(c => !visitedIds.has(c.id));
  }

  const area = document.getElementById('picked');
  const actions = document.getElementById('pick-actions');

  if (candidates.length === 0) {
    area.textContent = '該当するカードがありません';
    actions.classList.add('hidden');
    pendingPick = null;
    return;
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  pendingPick = picked;
  area.innerHTML = `
    <strong>${escapeHtml(picked.title)}</strong>
    ${picked.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(picked.image_key)}" alt="">` : ''}
    <div>${escapeHtml(picked.description || '')}</div>
    <div class="meta">${picked.category ? escapeHtml(picked.category) : ''}</div>
  `;
  actions.classList.remove('hidden');
}

document.getElementById('pick-btn').addEventListener('click', doPick);
document.getElementById('pick-reroll').addEventListener('click', doPick);

document.getElementById('pick-confirm').addEventListener('click', async () => {
  if (!pendingPick) return;
  await fetch(API_VISITS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: pendingPick.id }),
  });
  pendingPick = null;
  document.getElementById('pick-actions').classList.add('hidden');
  document.getElementById('picked').innerHTML += '<div class="meta" style="margin-top:0.6rem">✓ 履歴に追加しました</div>';
  await reloadAll();
});

document.getElementById('pick-cancel').addEventListener('click', () => {
  pendingPick = null;
  document.getElementById('picked').textContent = 'キャンセルしました';
  document.getElementById('pick-actions').classList.add('hidden');
});

// ---------- 表示/非表示トグル ----------
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.target).classList.toggle('hidden');
  });
});

// ---------- ユーティリティ ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- 初期化 ----------
populateImageSelect('image_key');
populateImageSelect('edit-image_key');
document.getElementById('image_key').addEventListener('change', () => {
  updateImagePreview('image_key', 'image-preview');
});
document.getElementById('edit-image_key').addEventListener('change', () => {
  updateImagePreview('edit-image_key', 'edit-image-preview');
});
reloadAll();
