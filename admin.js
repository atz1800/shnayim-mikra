import { PROJECTS as STATIC_PROJECTS } from './projects.js';
import { FIREBASE_CONFIG, ADMIN_EMAIL, COLLECTION } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

// ── Firebase init ─────────────────────────────────────────────────────────────
const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ── State ─────────────────────────────────────────────────────────────────────
let projects = [];
let selectedDocId = null;
let pendingImageFile = null;
let unsubscribe = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loginScreen  = document.getElementById('loginScreen');
const dashboard    = document.getElementById('dashboard');
const loginBtn     = document.getElementById('loginBtn');
const loginError   = document.getElementById('loginError');
const logoutBtn    = document.getElementById('logoutBtn');
const addBtn       = document.getElementById('addBtn');
const seedBtn      = document.getElementById('seedBtn');
const projectsList = document.getElementById('projectsList');
const listEmpty    = document.getElementById('listEmpty');
const countBadge   = document.getElementById('projectCountBadge');
const editPanel    = document.getElementById('editPanel');
const closePanelBtn= document.getElementById('closePanelBtn');
const panelTitle   = document.getElementById('panelTitle');
const projectForm  = document.getElementById('projectForm');
const saveBtn      = document.getElementById('saveBtn');
const saveBtnText  = document.getElementById('saveBtnText');
const saveBtnSpinner=document.getElementById('saveBtnSpinner');
const deleteBtn    = document.getElementById('deleteBtn');
const deleteModal  = document.getElementById('deleteModal');
const deleteModalName = document.getElementById('deleteModalName');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn  = document.getElementById('cancelDeleteBtn');
const toast        = document.getElementById('toast');

const imageFile    = document.getElementById('imageFile');
const imageUrl     = document.getElementById('imageUrl');
const previewImg   = document.getElementById('previewImg');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Form fields
const fieldDocId   = document.getElementById('fieldDocId');
const fieldTitle   = document.getElementById('fieldTitle');
const fieldEmoji   = document.getElementById('fieldEmoji');
const fieldDesc    = document.getElementById('fieldDesc');
const fieldLink    = document.getElementById('fieldLink');
const fieldYear    = document.getElementById('fieldYear');
const fieldCategory= document.getElementById('fieldCategory');
const fieldOrder   = document.getElementById('fieldOrder');
const fieldTags    = document.getElementById('fieldTags');

// ── Auth ──────────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  loginError.textContent = '';
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    if (result.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      loginError.textContent = 'גישה מורשית לבעל האתר בלבד.';
    }
  } catch (e) {
    loginError.textContent = 'שגיאה בכניסה. נסה שוב.';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  if (user && user.email === ADMIN_EMAIL) {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    startListening();
  } else {
    loginScreen.classList.remove('hidden');
    dashboard.classList.add('hidden');
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  }
});

// ── Firestore real-time listener ──────────────────────────────────────────────
function startListening() {
  const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
  unsubscribe = onSnapshot(q,
    snap => {
      projects = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      renderSidebar();
      seedBtn.classList.toggle('hidden', projects.length > 0);
    },
    err => {
      // orderBy requires an index — fall back to unordered and sort client-side
      if (unsubscribe) unsubscribe();
      const q2 = collection(db, COLLECTION);
      unsubscribe = onSnapshot(q2, snap => {
        projects = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
        projects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        renderSidebar();
        seedBtn.classList.toggle('hidden', projects.length > 0);
      });
    }
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar() {
  projectsList.querySelectorAll('.list-item').forEach(el => el.remove());
  countBadge.textContent = `${projects.length} פרויקטים`;
  listEmpty.classList.toggle('hidden', projects.length > 0);

  projects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'list-item' + (p.docId === selectedDocId ? ' active' : '');
    item.dataset.id = p.docId;

    const thumb = p.imageUrl
      ? `<img class="list-item-img" src="${p.imageUrl}" alt="" />`
      : `<span class="list-item-emoji">${p.emoji || '📱'}</span>`;

    item.innerHTML = `
      ${thumb}
      <div class="list-item-info">
        <div class="list-item-title">${escHtml(p.title)}</div>
        <div class="list-item-meta">${catLabel(p.category)} · ${p.year || ''}</div>
      </div>
      <span class="list-item-order">${p.order ?? '-'}</span>
    `;
    item.addEventListener('click', () => openEditPanel(p.docId));
    projectsList.appendChild(item);
  });
}

// ── Add / Edit panel ──────────────────────────────────────────────────────────
addBtn.addEventListener('click', () => openNewPanel());
closePanelBtn.addEventListener('click', closePanel);

function openNewPanel() {
  selectedDocId = null;
  panelTitle.textContent = 'פרויקט חדש';
  projectForm.reset();
  fieldDocId.value = '';
  fieldYear.value = new Date().getFullYear().toString();
  fieldOrder.value = projects.length;
  clearImagePreview();
  pendingImageFile = null;
  deleteBtn.classList.add('hidden');
  editPanel.classList.remove('hidden');
  updateSidebarActive();
  fieldTitle.focus();
}

function openEditPanel(docId) {
  const p = projects.find(x => x.docId === docId);
  if (!p) return;
  selectedDocId = docId;
  panelTitle.textContent = 'עריכת פרויקט';
  fieldDocId.value = docId;
  fieldTitle.value = p.title || '';
  fieldEmoji.value = p.emoji || '';
  fieldDesc.value = p.desc || '';
  fieldLink.value = p.link || '';
  fieldYear.value = p.year || '';
  fieldCategory.value = p.category || 'app';
  fieldOrder.value = p.order ?? '';
  fieldTags.value = (p.tags || []).join(', ');
  imageUrl.value = '';
  pendingImageFile = null;
  if (p.imageUrl) {
    showImagePreview(p.imageUrl);
    imageUrl.value = p.imageUrl;
  } else {
    clearImagePreview();
  }
  deleteBtn.classList.remove('hidden');
  editPanel.classList.remove('hidden');
  updateSidebarActive();
}

function closePanel() {
  editPanel.classList.add('hidden');
  selectedDocId = null;
  updateSidebarActive();
}

function updateSidebarActive() {
  document.querySelectorAll('.list-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === selectedDocId);
  });
}

// ── Image preview ─────────────────────────────────────────────────────────────
imageFile.addEventListener('change', () => {
  const file = imageFile.files[0];
  if (!file) return;
  pendingImageFile = file;
  imageUrl.value = '';
  const reader = new FileReader();
  reader.onload = e => showImagePreview(e.target.result);
  reader.readAsDataURL(file);
});

imageUrl.addEventListener('input', () => {
  const url = imageUrl.value.trim();
  if (url) {
    pendingImageFile = null;
    imageFile.value = '';
    showImagePreview(url);
  } else {
    clearImagePreview();
  }
});

function showImagePreview(src) {
  previewImg.src = src;
  previewImg.classList.remove('hidden');
  previewPlaceholder.classList.add('hidden');
}
function clearImagePreview() {
  previewImg.src = '';
  previewImg.classList.add('hidden');
  previewPlaceholder.classList.remove('hidden');
}

// ── Upload image to Storage ───────────────────────────────────────────────────
async function uploadImage(file, docId) {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, `portfolio-images/${docId}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    uploadProgress.classList.remove('hidden');
    task.on('state_changed',
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `מעלה... ${pct}%`;
      },
      err => {
        uploadProgress.classList.add('hidden');
        reject(err);
      },
      async () => {
        uploadProgress.classList.add('hidden');
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

// ── Save project ──────────────────────────────────────────────────────────────
projectForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!fieldTitle.value.trim()) {
    showToast('יש למלא שם פרויקט', 'error');
    fieldTitle.focus();
    return;
  }
  setSaving(true);

  try {
    const docId = fieldDocId.value || crypto.randomUUID();
    let finalImageUrl = imageUrl.value.trim() || null;

    if (pendingImageFile) {
      try {
        finalImageUrl = await uploadImage(pendingImageFile, docId);
      } catch (uploadErr) {
        showToast('שגיאה בהעלאת תמונה — ודא שהפעלת Firebase Storage', 'error');
        setSaving(false);
        return;
      }
    }

    const data = {
      title:    fieldTitle.value.trim(),
      emoji:    fieldEmoji.value.trim() || '📱',
      desc:     fieldDesc.value.trim(),
      link:     fieldLink.value.trim() || null,
      year:     fieldYear.value.trim() || new Date().getFullYear().toString(),
      category: fieldCategory.value,
      order:    parseInt(fieldOrder.value) || 0,
      tags:     fieldTags.value.split(',').map(t => t.trim()).filter(Boolean),
      imageUrl: finalImageUrl
    };

    await setDoc(doc(db, COLLECTION, docId), data);
    pendingImageFile = null;
    showToast('נשמר בהצלחה ✓', 'success');
    selectedDocId = docId;
    fieldDocId.value = docId;
    deleteBtn.classList.remove('hidden');
    panelTitle.textContent = 'עריכת פרויקט';
    updateSidebarActive();
  } catch (err) {
    showToast('שגיאה בשמירה: ' + err.message, 'error');
  } finally {
    setSaving(false);
  }
});

function setSaving(on) {
  saveBtn.disabled = on;
  saveBtnText.textContent = on ? 'שומר...' : 'שמור';
  saveBtnSpinner.classList.toggle('hidden', !on);
}

// ── Delete project ────────────────────────────────────────────────────────────
deleteBtn.addEventListener('click', () => {
  const p = projects.find(x => x.docId === selectedDocId);
  if (!p) return;
  deleteModalName.textContent = p.title;
  deleteModal.classList.remove('hidden');
});

cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));

confirmDeleteBtn.addEventListener('click', async () => {
  deleteModal.classList.add('hidden');
  if (!selectedDocId) return;
  try {
    await deleteDoc(doc(db, COLLECTION, selectedDocId));
    closePanel();
    showToast('הפרויקט נמחק', 'success');
  } catch (err) {
    showToast('שגיאה במחיקה: ' + err.message, 'error');
  }
});

// ── Seed from static data ─────────────────────────────────────────────────────
seedBtn.addEventListener('click', async () => {
  if (!confirm(`לייבא ${STATIC_PROJECTS.length} פרויקטים ל-Firestore?`)) return;
  seedBtn.disabled = true;
  try {
    for (let i = 0; i < STATIC_PROJECTS.length; i++) {
      const p = STATIC_PROJECTS[i];
      const { image, ...rest } = p;
      await setDoc(doc(db, COLLECTION, p.id), {
        ...rest,
        imageUrl: image || null,
        order: i
      });
    }
    showToast(`יובאו ${STATIC_PROJECTS.length} פרויקטים ✓`, 'success');
  } catch (err) {
    showToast('שגיאה בייבוא: ' + err.message, 'error');
  } finally {
    seedBtn.disabled = false;
  }
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast show${type ? ' ' + type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function catLabel(cat) {
  return cat === 'web' ? 'אתר' : cat === 'tool' ? 'כלי' : 'אפליקציה';
}
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
