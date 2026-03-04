// app.js — メインアプリロジック + タブ切替ヘルパー
const App = (() => {
  function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');

    if (tabName === 'flowchart') {
      Flowchart.render();
    }
  }

  return { switchTab };
})();

(async () => {
  await Database.loadAll();

  // Dynamic header stats
  const allPhrases = Database.getAllPhrases();
  const platformCount = Object.keys(Database.allData).length;
  const catSet = new Set(allPhrases.map(p => p.category));
  document.getElementById('stat-phrases').textContent = allPhrases.length;
  document.getElementById('stat-platforms').textContent = platformCount;
  document.getElementById('stat-categories').textContent = catSet.size;

  Database.init();
  Flowchart.init();
  Generator.init();

  Database.render();

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      App.switchTab(tab.dataset.tab);
    });
  });
})();
