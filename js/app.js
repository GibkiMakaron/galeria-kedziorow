import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmO1U5cwObGeYDDyQz3n86U1EBQu5aX3A",
  authDomain: "galeriakedziorw.firebaseapp.com",
  projectId: "galeriakedziorw",
  storageBucket: "galeriakedziorw.firebasestorage.app",
  messagingSenderId: "802239661165",
  appId: "1:802239661165:web:c9272f7311bf80f19e2b64",
  measurementId: "G-HT69J03QL6"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser = null;

const photoGallery = document.getElementById('photo_galery');
const photoCountEl = document.getElementById('photo_count');
const adminLogBtn = document.getElementById('admin_log');
const addPhotoBtn = document.getElementById('add_photo_btn');
const logoutBtn = document.getElementById('logout_btn');

const uploadModal = document.getElementById('upload_modal');
const loginModal = document.getElementById('login_modal');
const adminPanelModal = document.getElementById('admin_panel_modal');
const lightboxModal = document.getElementById('lightbox_modal');

document.getElementById('close_upload').onclick = () => closeModal(uploadModal);
document.getElementById('close_login').onclick = () => closeModal(loginModal);
document.getElementById('close_admin_panel').onclick = () => closeModal(adminPanelModal);
document.getElementById('close_lightbox').onclick = () => closeModal(lightboxModal);

function openModal(modal) { modal.classList.add('active'); }
function closeModal(modal) { modal.classList.remove('active'); }

document.addEventListener('DOMContentLoaded', () => {
  setupAuthListener();
  setupPublicGalleryListener();
  setupUploadTabs();
  setupFormHandlers();
  setupAdminTabs();
});

function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAdminButtonState();

    if (user) {
      setupAdminQueueListeners();
    } else {
      closeModal(adminPanelModal);
    }
  });
}

function updateAdminButtonState() {
  if (currentUser) {
    adminLogBtn.textContent = 'Panel Admina';
    adminLogBtn.style.backgroundColor = '#4A7C59';
    adminLogBtn.style.color = '#FFFFFF';
  } else {
    adminLogBtn.textContent = 'Zaloguj';
    adminLogBtn.style.backgroundColor = '#DDD2BF';
    adminLogBtn.style.color = '#38352F';
  }
}

adminLogBtn.addEventListener('click', () => {
  if (currentUser) {
    openModal(adminPanelModal);
  } else {
    openModal(loginModal);
  }
});

document.getElementById('login_form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin_email').value.trim();
  const pass = document.getElementById('admin_password').value;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeModal(loginModal);
    document.getElementById('login_form').reset();
    openModal(adminPanelModal);
  } catch (error) {
    alert('Błąd logowania: ' + error.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  closeModal(adminPanelModal);
});

function setupPublicGalleryListener() {
  const q = query(collection(db, "photos"), where("status", "==", "approved"));

  onSnapshot(q, (snapshot) => {
    const photos = [];
    snapshot.forEach(docSnap => {
      photos.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderGalleryUI(photos);
  }, (error) => {
    console.error("Błąd pobierania zdjęć:", error);
  });
}

function renderGalleryUI(photos) {
  photoCountEl.textContent = photos.length;
  photoGallery.innerHTML = '';

  if (photos.length === 0) {
    photoGallery.innerHTML = `
      <div class="empty-gallery">
        <h3>Brak zatwierdzonych zdjęć</h3>
        <p>Bądź pierwszy i dodaj zdjęcie do kolejki!</p>
      </div>
    `;
    return;
  }

  photos.forEach(photo => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    const formattedDate = photo.createdAt ? new Date(photo.createdAt.seconds * 1000).toLocaleDateString('pl-PL') : 'Niedawno';

    card.innerHTML = `
      <div class="gallery-img-wrapper" onclick="openLightbox('${photo.url}', '${escapeHtml(photo.title)} - ${escapeHtml(photo.author)}')">
        <img src="${photo.url}" alt="${escapeHtml(photo.title)}" loading="lazy">
      </div>
      <div class="gallery-info">
        <h3 class="gallery-title">${escapeHtml(photo.title)}</h3>
        <p class="gallery-author">Autor: ${escapeHtml(photo.author)}</p>
        <span class="gallery-date">Dodano: ${formattedDate}</span>
      </div>
    `;
    photoGallery.appendChild(card);
  });
}

function setupAdminQueueListeners() {
  const qPending = query(collection(db, "photos"), where("status", "==", "pending"));
  onSnapshot(qPending, (snapshot) => {
    const pending = [];
    snapshot.forEach(docSnap => pending.push({ id: docSnap.id, ...docSnap.data() }));
    document.getElementById('pending_count').textContent = pending.length;
    renderPendingUI(pending);
  });

  const qPublished = query(collection(db, "photos"), where("status", "==", "approved"));
  onSnapshot(qPublished, (snapshot) => {
    const published = [];
    snapshot.forEach(docSnap => published.push({ id: docSnap.id, ...docSnap.data() }));
    document.getElementById('published_count').textContent = published.length;
    renderPublishedAdminUI(published);
  });
}

function renderPendingUI(pending) {
  const container = document.getElementById('pending_queue_list');
  container.innerHTML = '';

  if (pending.length === 0) {
    container.innerHTML = '<p class="empty-gallery">Brak zdjęć oczekujących na akceptację.</p>';
    return;
  }

  pending.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'admin-card';
    item.innerHTML = `
      <img src="${photo.url}" alt="${escapeHtml(photo.title)}">
      <div class="admin-card-info">
        <h4>${escapeHtml(photo.title)}</h4>
        <p><strong>Autor:</strong> ${escapeHtml(photo.author)}</p>
      </div>
      <div class="admin-card-actions">
        <button class="btn btn-success" onclick="approvePhoto('${photo.id}')">Zaakceptuj</button>
        <button class="btn btn-danger" onclick="rejectPhoto('${photo.id}', '${photo.url}')">Odrzuć</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderPublishedAdminUI(published) {
  const container = document.getElementById('published_queue_list');
  container.innerHTML = '';

  if (published.length === 0) {
    container.innerHTML = '<p class="empty-gallery">Brak opublikowanych zdjęć.</p>';
    return;
  }

  published.forEach(photo => {
    const item = document.createElement('div');
    item.className = 'admin-card';
    item.innerHTML = `
      <img src="${photo.url}" alt="${escapeHtml(photo.title)}">
      <div class="admin-card-info">
        <h4>${escapeHtml(photo.title)}</h4>
        <p><strong>Autor:</strong> ${escapeHtml(photo.author)}</p>
      </div>
      <div class="admin-card-actions">
        <button class="btn btn-danger" onclick="deletePhoto('${photo.id}', '${photo.url}')">Usuń z galerii</button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.approvePhoto = async function(id) {
  try {
    await updateDoc(doc(db, "photos", id), { status: 'approved' });
  } catch (err) {
    alert('Błąd zatwierdzania: ' + err.message);
  }
};

window.rejectPhoto = async function(id, url) {
  if (confirm('Czy na pewno chcesz odrzucić to zdjęcie?')) {
    try {
      if (url && url.includes('firebasestorage')) {
        const photoRef = ref(storage, url);
        await deleteObject(photoRef);
      }
      await deleteDoc(doc(db, "photos", id));
    } catch (err) {
      alert('Błąd odrzucania: ' + err.message);
    }
  }
};

window.deletePhoto = async function(id, url) {
  if (confirm('Czy na pewno chcesz usunąć to zdjęcie?')) {
    try {
      if (url && url.includes('firebasestorage')) {
        const photoRef = ref(storage, url);
        await deleteObject(photoRef);
      }
      await deleteDoc(doc(db, "photos", id));
    } catch (err) {
      alert('Błąd usuwania: ' + err.message);
    }
  }
};

addPhotoBtn.addEventListener('click', () => openModal(uploadModal));

function setupFormHandlers() {
  const uploadForm = document.getElementById('upload_form');

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wysyłanie...';

    try {
      const title = document.getElementById('photo_title').value.trim();
      const author = document.getElementById('photo_author').value.trim();
      const fileInput = document.getElementById('photo_file');
      const urlInput = document.getElementById('photo_url');

      let imageUrl = '';

      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];

        if (file.size > 5 * 1024 * 1024) {
          throw new Error('Wybrany plik przekracza limit 5 MB.');
        }

        const fileRef = ref(storage, `photos/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(fileRef, file);
        imageUrl = await getDownloadURL(uploadResult.ref);
      } else if (urlInput.value.trim() !== '') {
        imageUrl = urlInput.value.trim();
      } else {
        throw new Error('Proszę wybrać plik ze zdjęciem lub podać adres URL.');
      }

      await addDoc(collection(db, "photos"), {
        title: title,
        author: author,
        url: imageUrl,
        status: "pending",
        createdAt: serverTimestamp()
      });

      uploadForm.reset();
      document.getElementById('image_preview_container').classList.add('hidden');
      closeModal(uploadModal);
      alert('Dziękujemy! Twoje zdjęcie zostało wysłane i oczekuje na akceptację administratora.');

    } catch (err) {
      alert('Błąd: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Wyślij do akceptacji';
    }
  });
}

function setupUploadTabs() {
  const tabFileBtn = document.getElementById('tab_file_btn');
  const tabUrlBtn = document.getElementById('tab_url_btn');
  const fileContainer = document.getElementById('file_input_container');
  const urlContainer = document.getElementById('url_input_container');
  const fileInput = document.getElementById('photo_file');
  const urlInput = document.getElementById('photo_url');
  const previewImg = document.getElementById('image_preview');
  const previewContainer = document.getElementById('image_preview_container');

  tabFileBtn.addEventListener('click', () => {
    tabFileBtn.classList.add('active');
    tabUrlBtn.classList.remove('active');
    fileContainer.classList.remove('hidden');
    urlContainer.classList.add('hidden');
    urlInput.value = '';
    previewContainer.classList.add('hidden');
  });

  tabUrlBtn.addEventListener('click', () => {
    tabUrlBtn.classList.add('active');
    tabFileBtn.classList.remove('active');
    urlContainer.classList.remove('hidden');
    fileContainer.classList.add('hidden');
    fileInput.value = '';
    previewContainer.classList.add('hidden');
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        previewImg.src = evt.target.result;
        previewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  urlInput.addEventListener('input', () => {
    if (urlInput.value.trim() !== '') {
      previewImg.src = urlInput.value.trim();
      previewContainer.classList.remove('hidden');
    } else {
      previewContainer.classList.add('hidden');
    }
  });
}

function setupAdminTabs() {
  const qTab = document.getElementById('admin_queue_tab');
  const pTab = document.getElementById('admin_published_tab');
  const qView = document.getElementById('queue_view');
  const pView = document.getElementById('published_view');

  qTab.addEventListener('click', () => {
    qTab.classList.add('active');
    pTab.classList.remove('active');
    qView.classList.remove('hidden');
    pView.classList.add('hidden');
  });

  pTab.addEventListener('click', () => {
    pTab.classList.add('active');
    qTab.classList.remove('active');
    pView.classList.remove('hidden');
    qView.classList.add('hidden');
  });
}

window.openLightbox = function(url, caption) {
  document.getElementById('lightbox_img').src = url;
  document.getElementById('lightbox_caption').textContent = caption;
  openModal(lightboxModal);
};

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
