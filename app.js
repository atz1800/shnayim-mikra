(() => {
  const grid = document.getElementById('projectsGrid');
  const template = document.getElementById('cardTemplate');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCountEl = document.getElementById('projectCount');

  function renderProjects() {
    grid.innerHTML = '';
    PROJECTS.forEach(p => {
      const card = template.content.cloneNode(true).querySelector('.project-card');
      card.dataset.category = p.category;

      // Placeholder emoji
      card.querySelector('.card-emoji').textContent = p.emoji;

      // Image (if provided)
      if (p.image) {
        const img = card.querySelector('.card-img');
        img.src = p.image;
        img.alt = p.title;
        img.addEventListener('load', () => img.classList.add('loaded'));
      }

      // Link
      const linkBtn = card.querySelector('.card-link-btn');
      if (p.link) {
        linkBtn.href = p.link;
      } else {
        linkBtn.textContent = 'בקרוב';
        linkBtn.style.pointerEvents = 'none';
        linkBtn.style.opacity = '0.6';
      }

      // Meta
      card.querySelector('.card-category-badge').textContent =
        p.category === 'app' ? 'אפליקציה' :
        p.category === 'web' ? 'אתר' : 'כלי';
      card.querySelector('.card-year').textContent = p.year;

      // Content
      card.querySelector('.card-title').textContent = p.title;
      card.querySelector('.card-desc').textContent = p.desc;

      // Tags
      const tagsEl = card.querySelector('.card-tags');
      p.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'card-tag';
        span.textContent = t;
        tagsEl.appendChild(span);
      });

      grid.appendChild(card);
    });

    // Update stat counter
    if (projectCountEl) {
      projectCountEl.textContent = PROJECTS.length > 9 ? PROJECTS.length + '+' : PROJECTS.length;
    }
  }

  function applyFilter(category) {
    document.querySelectorAll('.project-card').forEach(card => {
      const match = category === 'all' || card.dataset.category === category;
      card.classList.toggle('hidden', !match);
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter);
    });
  });

  renderProjects();
})();
