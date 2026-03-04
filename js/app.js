// app.js — メインアプリロジック
(async () => {
  // Load data
  await Database.loadAll();

  // Init modules
  Database.init();
  Flowchart.init();
  Generator.init();

  // Initial render
  Database.render();

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      target.classList.add('active');

      // Render flowchart when tab becomes visible
      if (tab.dataset.tab === 'flowchart') {
        Flowchart.render();
      }
    });
  });
})();
