const API_CARDS = '/api/cards';
const API_VISITS = '/api/visits';

let cardsCache = [];
let visitsCache = [];

// ---------- 取得 ----------
async function fetchCards() {
  const res = await fetch(API_CARDS);
  cardsCache = await res.json();
}
async function fetchVisits() {
  const res = await fetch(API_VISITS);
  visitsCache = await res.json();
}

// ---------- 描画 ----------
function renderCards() {
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  cardsCache.forEach(card => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${escapeHtml(card.title)}</strong>
      <div>${escapeHtml(card.description || '')}</div>
      <div class="card-meta">
        ${card.category ? 'CATEGORY: ' + escapeHtml(card.category) + ' / ' : ''}
        ${card.created_by ? 'BY: ' + escapeHtml(card.created_by) : ''}
      </div>
      <div class="row-actions">
        <button class="edit-btn" data-id="${card.id}">編集</button>
        <button class="delete-btn" data-id="${card.id}">削除</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteCard(btn.dataset.id))
  );
  list.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', () => editCard(btn.dataset.id))
  );
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

// ---------- 操作 ----------
async function reloadAll() {
  await Promise.all([fetchCards(), fetchVisits()]);
  renderCards();
  renderHistory();
  renderCategoryFilter();
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    category: document.getElementById('category').value,
    created_by: document.getElementById('created_by').value,
  };
  await fetch(API_CARDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  e.target.reset();
  reloadAll();
});

async function deleteCard(id) {
  if (!confirm('このカードを削除しますか？')) return;
  await fetch(`${API_CARDS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

async function editCard(id) {
  const card = cardsCache.find(c => c.id == id);
  const title = prompt('タイトル', card.title);
  if (title === null) return;
  const description = prompt('説明', card.description || '');
  if (description === null) return;
  const category = prompt('カテゴリ', card.category || '');
  if (category === null) return;
  const created_by = prompt('追加した人', card.created_by || '');
  if (created_by === null) return;
  await fetch(`${API_CARDS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, category, created_by }),
  });
  reloadAll();
}

async function deleteVisit(id) {
  if (!confirm('この履歴を削除しますか？')) return;
  await fetch(`${API_VISITS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

// ---------- ピック ----------
document.getElementById('pick-btn').addEventListener('click', async () => {
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
  if (candidates.length === 0) {
    area.textContent = '該当するカードがありません';
    return;
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  area.innerHTML = `
    <strong>${escapeHtml(picked.title)}</strong>
    <div>${escapeHtml(picked.description || '')}</div>
    <div class="meta">${picked.category ? escapeHtml(picked.category) : ''}</div>
  `;

  // 履歴に記録
  await fetch(API_VISITS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: picked.id }),
  });
  await fetchVisits();
  renderHistory();
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
reloadAll();
