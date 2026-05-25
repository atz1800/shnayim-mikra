import { PROJECTS as STATIC_PROJECTS } from './projects.js';
import { FIREBASE_CONFIG, COLLECTION } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

const grid = document.getElementById('projectsGrid');
const loadingEl = document.getElementById('projectsLoading');
const template = document.getElementById('cardTemplate');
const filterBtns = document.querySelectorAll('.filter-btn');
const projectCountEl = document.getElementById('projectCount');

function buildCard(p) {
  const card = template.content.cloneNode(true).querySelector('.project-card');
  card.dataset.category = p.category || 'app';

  card.querySelector('.card-emoji').textContent = p.emoji || '📱';

  const imgSrc = p.imageUrl || p.image || null;
  if (imgSrc) {
    const img = card.querySelector('.card-img');
    img.src = imgSrc;
    img.alt = p.title;
    img.addEventListener('load', () => img.classList.add('loaded'));
  }

  const linkBtn = card.querySelector('.card-link-btn');
  if (p.link) {
    linkBtn.href = p.link;
  } else {
    linkBtn.textContent = 'בקרוב';
    linkBtn.style.pointerEvents = 'none';
    linkBtn.style.opacity = '0.5';
  }

  card.querySelector('.card-category-badge').textContent =
    p.category === 'web' ? 'אתר' : p.category === 'tool' ? 'כלי' : 'אפליקציה';
  card.querySelector('.card-year').textContent = p.year || '';
  card.querySelector('.card-title').textContent = p.title;
  card.querySelector('.card-desc').textContent = p.desc;

  const tagsEl = card.querySelector('.card-tags');
  (p.tags || []).forEach(t => {
    const span = document.createElement('span');
    span.className = 'card-tag';
    span.textContent = t;
    tagsEl.appendChild(span);
  });

  return card;
}

function renderProjects(projects) {
  grid.innerHTML = '';
  projects.forEach(p => grid.appendChild(buildCard(p)));
  if (projectCountEl) {
    projectCountEl.textContent = projects.length > 9 ? `${projects.length}+` : projects.length;
  }
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.filter;
    document.querySelectorAll('.project-card').forEach(card => {
      card.classList.toggle('hidden', cat !== 'all' && card.dataset.category !== cat);
    });
  });
});

async function loadProjects() {
  try {
    const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    }
  } catch (_) {
    // Firestore not set up yet or network error — fall through
  }
  return STATIC_PROJECTS;
}

loadProjects().then(projects => {
  if (loadingEl) loadingEl.classList.add('hidden');
  renderProjects(projects);
});
