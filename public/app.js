const API = '/api/cards';

// 一覧を取得して表示
async function loadCards() {
  const res = await fetch(API);
  const cards = await res.json();
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  cards.forEach(card => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${card.title}</strong><br>${card.description || ''}`;
    list.appendChild(li);
  });
}

// 追加フォーム
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description })
  });
  e.target.reset();
  loadCards();
});

// ランダムピック
document.getElementById('pick-btn').addEventListener('click', async () => {
  const res = await fetch(API);
  const cards = await res.json();
  if (cards.length === 0) {
    document.getElementById('picked').textContent = 'カードがありません';
    return;
  }
  const picked = cards[Math.floor(Math.random() * cards.length)];
  document.getElementById('picked').innerHTML =
    `🎯 <strong>${picked.title}</strong><br>${picked.description || ''}`;
});

loadCards();
