/**
 * Password Manager Web Application
 * Frontend JavaScript per l'interfaccia web
 */

// Stato dell'applicazione
const state = {
  isLocked: true,
  masterKey: null,
  vault: null,
  currentEditingId: null,
  currentTab: 'all',
  currentPIN: null,
  passwords: [],
  cards: [],
  documents: [],
  selectedItem: null
};

// Utility per crittografia (simulata per demo)
const cryptoUtils = {
  async deriveKey(pin) {
    // In produzione, usare PBKDF2 con il backend
    return { pin, timestamp: Date.now() };
  },
  
  async encrypt(data, key) {
    // In produzione, usare AES-256-GCM
    return btoa(JSON.stringify(data));
  },
  
  async decrypt(encrypted, key) {
    // In produzione, usare AES-256-GCM
    return JSON.parse(atob(encrypted));
  }
};

// Storage locale
const storage = {
  save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },
  
  load(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  
  remove(key) {
    localStorage.removeItem(key);
  }
};

// Generatore password
function generateSecurePassword() {
  const length = 16;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  console.log('Initializing app...');
  
  // Carica tema salvato
  loadTheme();
  
  // Carica dati salvati
  const savedPasswords = storage.load('passwords');
  if (savedPasswords) {
    state.passwords = savedPasswords;
    console.log('Loaded', savedPasswords.length, 'passwords from storage');
  }
  
  const savedCards = storage.load('cards');
  if (savedCards) {
    state.cards = savedCards;
    console.log('Loaded', savedCards.length, 'cards from storage');
  }
  
  const savedDocuments = storage.load('documents');
  if (savedDocuments) {
    state.documents = savedDocuments;
    console.log('Loaded', savedDocuments.length, 'documents from storage');
  }
  
  // Setup event listeners
  setupEventListeners();
  
  // Check biometric availability
  checkBiometricAvailability();
  
  // Mostra schermata login
  showScreen('login-screen');
  
  console.log('App initialized');
}

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
    console.log('Login form listener attached');
  } else {
    console.error('Login form not found!');
  }
  
  // Main screen buttons
  const addBtn = document.getElementById('add-item-btn');
  if (addBtn) {
    addBtn.addEventListener('click', toggleAddMenu);
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.querySelector('.dropdown');
    const menu = document.getElementById('add-menu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
      menu.classList.remove('show');
    }
  });
  
  const backupBtn = document.getElementById('backup-btn');
  if (backupBtn) backupBtn.addEventListener('click', () => openBackupModal());
  
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => openSettingsModal());
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  
  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', handleSearch);
  
  // Filter dropdown
  const filterType = document.getElementById('filter-type');
  if (filterType) filterType.addEventListener('change', handleFilterChange);
  
  // Password form
  const passwordForm = document.getElementById('password-form');
  if (passwordForm) passwordForm.addEventListener('submit', handlePasswordSave);
  
  // Card form
  const cardForm = document.getElementById('card-form');
  if (cardForm) cardForm.addEventListener('submit', handleCardSave);
  
  // Document form
  const documentForm = document.getElementById('document-form');
  if (documentForm) documentForm.addEventListener('submit', handleDocumentSave);
  
  // Change PIN form
  const changePinForm = document.getElementById('change-pin-form');
  if (changePinForm) changePinForm.addEventListener('submit', handleChangePIN);
  
  // Biometric button
  const biometricBtn = document.getElementById('biometric-btn');
  if (biometricBtn) biometricBtn.addEventListener('click', handleBiometricLogin);
  
  // Document image preview
  const docImageInput = document.getElementById('doc-image');
  if (docImageInput) {
    docImageInput.addEventListener('change', handleDocumentImagePreview);
  }
  
  // Card number formatting
  const cardNumberInput = document.getElementById('card-number');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', formatCardNumber);
  }
  
  // Expiry formatting
  const cardExpiryInput = document.getElementById('card-expiry');
  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', formatExpiry);
  }
}

async function handleLogin(e) {
  console.log('handleLogin called');
  e.preventDefault();
  
  const pin = document.getElementById('pin').value;
  console.log('PIN entered:', pin);
  
  // Validazione PIN
  if (!/^\d{4,8}$/.test(pin)) {
    alert('PIN deve essere di 4-8 cifre numeriche');
    return;
  }
  
  console.log('PIN valid, unlocking...');
  
  // Deriva chiave master
  state.masterKey = { pin, timestamp: Date.now() };
  state.currentPIN = pin;
  state.isLocked = false;
  
  // Mostra schermata principale
  showScreen('main-screen');
  renderUnifiedList();
  
  console.log('Vault unlocked!');
}

function handleLogout() {
  state.isLocked = true;
  state.masterKey = null;
  state.currentPIN = null;
  document.getElementById('pin').value = '';
  showScreen('login-screen');
}

function showScreen(screenId) {
  console.log('showScreen called with:', screenId);
  
  const allScreens = document.querySelectorAll('.screen');
  console.log('Found screens:', allScreens.length);
  
  allScreens.forEach(screen => {
    screen.classList.remove('active');
    console.log('Removed active from:', screen.id);
  });
  
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    console.log('Added active to:', screenId);
  } else {
    console.error('Screen not found:', screenId);
  }
}

function renderUnifiedList(filteredItems = null) {
  const list = document.getElementById('unified-list');
  
  // Combina tutti gli elementi
  let allItems = [];
  
  if (state.currentTab === 'all') {
    allItems = [
      ...state.passwords.map(p => ({ ...p, itemType: 'password' })),
      ...state.cards.map(c => ({ ...c, itemType: 'card' })),
      ...state.documents.map(d => ({ ...d, itemType: 'document' }))
    ];
  } else if (state.currentTab === 'passwords') {
    allItems = state.passwords.map(p => ({ ...p, itemType: 'password' }));
  } else if (state.currentTab === 'cards') {
    allItems = state.cards.map(c => ({ ...c, itemType: 'card' }));
  } else if (state.currentTab === 'documents') {
    allItems = state.documents.map(d => ({ ...d, itemType: 'document' }));
  }
  
  // Ordina per data di aggiornamento (più recenti prima)
  allItems.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  // Applica filtro se presente
  const items = filteredItems || allItems;
  
  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Nessun elemento trovato</p>
        <button class="btn btn-primary" onclick="openAddMenu()">
          Aggiungi elemento
        </button>
      </div>
    `;
    return;
  }
  
  list.innerHTML = items.map(item => {
    if (item.itemType === 'password') {
      return renderPasswordCard(item);
    } else if (item.itemType === 'card') {
      return renderCardCard(item);
    } else if (item.itemType === 'document') {
      return renderDocumentCard(item);
    }
  }).join('');
}

function renderPasswordCard(item) {
  return `
    <div class="unified-card password-card" data-id="${item.id}" data-type="password" onclick="selectCard(event, '${item.id}', 'password')">
      <div class="card-header">
        <div class="card-icon">🔑</div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-subtitle">Password</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-field">
          <span class="field-label">User:</span>
          <span class="field-value" onclick="copyField(event, '${escapeHtml(item.username)}')">${escapeHtml(item.username)}</span>
        </div>
        <div class="card-field">
          <span class="field-label">Pass:</span>
          <span class="field-value" onclick="copyField(event, '${escapeHtml(item.password)}')">••••••••</span>
        </div>
        ${item.url ? `<div class="card-field"><span class="field-label">URL:</span><span class="field-value" onclick="copyField(event, '${escapeHtml(item.url)}')">${escapeHtml(item.url)}</span></div>` : ''}
      </div>
      ${item.tags && item.tags.length > 0 ? `
        <div class="card-tags">
          ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderCardCard(item) {
  const maskedNumber = maskCardNumber(item.cardNumber);
  const isExpiring = checkExpiring(item.expiryDate);
  
  return `
    <div class="unified-card card-card" data-id="${item.id}" data-type="card" onclick="selectCard(event, '${item.id}', 'card')">
      <div class="card-header">
        <div class="card-icon">💳</div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-subtitle">Carta ${isExpiring ? '⚠️' : ''}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="card-field">
          <span class="field-label">Numero:</span>
          <span class="field-value" onclick="copyField(event, '${item.cardNumber}')">${maskedNumber}</span>
        </div>
        <div class="card-field">
          <span class="field-label">CVV:</span>
          <span class="field-value" onclick="copyField(event, '${item.cvv}')">•••</span>
        </div>
        <div class="card-field">
          <span class="field-label">Scad:</span>
          <span class="field-value" onclick="copyField(event, '${escapeHtml(item.expiryDate)}')">${escapeHtml(item.expiryDate)}</span>
        </div>
      </div>
      ${item.tags && item.tags.length > 0 ? `
        <div class="card-tags">
          ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderDocumentCard(item) {
  const typeIcon = getDocTypeIcon(item.docType);
  const isExpiring = item.expiryDate && checkDocExpiring(item.expiryDate);
  
  return `
    <div class="unified-card document-card" data-id="${item.id}" data-type="document" onclick="selectCard(event, '${item.id}', 'document')">
      <div class="card-header">
        <div class="card-icon">${typeIcon}</div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-subtitle">Documento ${isExpiring ? '⚠️' : ''}</div>
        </div>
      </div>
      <div class="card-body">
        ${item.docNumber ? `<div class="card-field"><span class="field-label">N°:</span><span class="field-value" onclick="copyField(event, '${escapeHtml(item.docNumber)}')">${escapeHtml(item.docNumber)}</span></div>` : ''}
        ${item.expiryDate ? `<div class="card-field"><span class="field-label">Scad:</span><span class="field-value" onclick="copyField(event, '${formatDate(item.expiryDate)}')">${formatDate(item.expiryDate)}</span></div>` : ''}
      </div>
      ${item.tags && item.tags.length > 0 ? `
        <div class="card-tags">
          ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function toggleAddMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('add-menu');
  if (menu) {
    menu.classList.toggle('show');
  }
}

function openAddMenu() {
  const menu = document.getElementById('add-menu');
  if (menu) {
    menu.classList.add('show');
  }
}

// Selection and Actions
function selectCard(event, id, type) {
  // Prevent selection if clicking on a field value
  if (event.target.classList.contains('field-value')) {
    return;
  }
  
  event.stopPropagation();
  
  // Deselect all cards
  document.querySelectorAll('.unified-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Select this card
  const card = event.currentTarget;
  card.classList.add('selected');
  
  // Update state
  state.selectedItem = { id, type };
  
  // Enable toolbar buttons
  document.getElementById('edit-btn').disabled = false;
  document.getElementById('duplicate-btn').disabled = false;
  document.getElementById('delete-btn').disabled = false;
}

function copyField(event, value) {
  event.stopPropagation();
  
  const element = event.target;
  
  navigator.clipboard.writeText(value).then(() => {
    // Visual feedback
    element.classList.add('copied');
    setTimeout(() => {
      element.classList.remove('copied');
    }, 1000);
    
    // Auto-clear after 30 seconds
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 30000);
  }).catch(err => {
    console.error('Errore copia:', err);
  });
}

function editSelected() {
  if (!state.selectedItem) return;
  
  const { id, type } = state.selectedItem;
  
  if (type === 'password') {
    editPassword(id);
  } else if (type === 'card') {
    editCard(id);
  } else if (type === 'document') {
    editDocument(id);
  }
}

function duplicateSelected() {
  if (!state.selectedItem) return;
  
  const { id, type } = state.selectedItem;
  let item, newItem;
  
  if (type === 'password') {
    item = state.passwords.find(p => p.id === id);
    if (!item) return;
    
    newItem = {
      ...item,
      id: generateId(),
      title: item.title + ' (copia)',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    state.passwords.push(newItem);
    storage.save('passwords', state.passwords);
  } else if (type === 'card') {
    item = state.cards.find(c => c.id === id);
    if (!item) return;
    
    newItem = {
      ...item,
      id: generateId(),
      title: item.title + ' (copia)',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    state.cards.push(newItem);
    storage.save('cards', state.cards);
  } else if (type === 'document') {
    item = state.documents.find(d => d.id === id);
    if (!item) return;
    
    newItem = {
      ...item,
      id: generateId(),
      title: item.title + ' (copia)',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    state.documents.push(newItem);
    storage.save('documents', state.documents);
  }
  
  renderUnifiedList();
}

function deleteSelected() {
  if (!state.selectedItem) return;
  
  if (!confirm('Sei sicuro di voler eliminare questo elemento?')) {
    return;
  }
  
  const { id, type } = state.selectedItem;
  
  if (type === 'password') {
    deletePassword(id);
  } else if (type === 'card') {
    deleteCard(id);
  } else if (type === 'document') {
    deleteDocument(id);
  }
  
  // Clear selection
  state.selectedItem = null;
  document.getElementById('edit-btn').disabled = true;
  document.getElementById('duplicate-btn').disabled = true;
  document.getElementById('delete-btn').disabled = true;
}

function renderPasswordList(filteredPasswords = null) {
  const list = document.getElementById('password-list');
  const passwords = filteredPasswords || state.passwords;
  
  if (passwords.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Nessuna password salvata</p>
        <button class="btn btn-primary" onclick="openPasswordModal()">
          Aggiungi la prima password
        </button>
      </div>
    `;
    return;
  }
  
  list.innerHTML = passwords.map(item => `
    <div class="password-item">
      <div class="password-item-header">
        <div>
          <div class="password-item-title">${escapeHtml(item.title)}</div>
          ${item.url ? `<div class="password-item-url">${escapeHtml(item.url)}</div>` : ''}
        </div>
        <div class="password-item-actions">
          <button class="btn btn-small btn-secondary" onclick="copyToClipboard('${item.id}', 'username')">
            📋 Username
          </button>
          <button class="btn btn-small btn-secondary" onclick="copyToClipboard('${item.id}', 'password')">
            📋 Password
          </button>
          <button class="btn btn-small btn-secondary" onclick="editPassword('${item.id}')">
            ✏️
          </button>
          <button class="btn btn-small btn-danger" onclick="deletePassword('${item.id}')">
            🗑️
          </button>
        </div>
      </div>
      <div class="password-item-body">
        <div class="password-field">
          <span class="password-field-label">Username:</span>
          <span class="password-field-value">${escapeHtml(item.username)}</span>
        </div>
        <div class="password-field">
          <span class="password-field-label">Password:</span>
          <span class="password-field-value">••••••••</span>
        </div>
        ${item.notes ? `
          <div class="password-field">
            <span class="password-field-label">Note:</span>
            <span class="password-field-value">${escapeHtml(item.notes)}</span>
          </div>
        ` : ''}
      </div>
      ${item.tags && item.tags.length > 0 ? `
        <div class="password-tags">
          ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    renderUnifiedList();
    return;
  }
  
  // Combina tutti gli elementi
  let allItems = [
    ...state.passwords.map(p => ({ ...p, itemType: 'password' })),
    ...state.cards.map(c => ({ ...c, itemType: 'card' })),
    ...state.documents.map(d => ({ ...d, itemType: 'document' }))
  ];
  
  // Filtra in base al tab corrente
  if (state.currentTab === 'passwords') {
    allItems = allItems.filter(item => item.itemType === 'password');
  } else if (state.currentTab === 'cards') {
    allItems = allItems.filter(item => item.itemType === 'card');
  } else if (state.currentTab === 'documents') {
    allItems = allItems.filter(item => item.itemType === 'document');
  }
  
  // Filtra per query
  const filtered = allItems.filter(item => {
    const searchFields = [
      item.title,
      item.username,
      item.url,
      item.notes,
      item.holderName,
      item.cardNumber,
      item.docNumber,
      item.issuer,
      ...(item.tags || [])
    ].filter(Boolean).map(f => f.toLowerCase());
    
    return searchFields.some(field => field.includes(query));
  });
  
  renderUnifiedList(filtered);
}

function openPasswordModal(id = null) {
  const modal = document.getElementById('password-modal');
  const form = document.getElementById('password-form');
  const title = document.getElementById('modal-title');
  
  if (id) {
    // Edit mode
    const item = state.passwords.find(p => p.id === id);
    if (!item) return;
    
    state.currentEditingId = id;
    title.textContent = 'Modifica Password';
    document.getElementById('item-title').value = item.title;
    document.getElementById('item-username').value = item.username;
    document.getElementById('item-password').value = item.password;
    document.getElementById('item-url').value = item.url || '';
    document.getElementById('item-notes').value = item.notes || '';
    document.getElementById('item-tags').value = item.tags ? item.tags.join(', ') : '';
  } else {
    // Add mode
    state.currentEditingId = null;
    title.textContent = 'Nuova Password';
    form.reset();
  }
  
  modal.classList.add('active');
}

function closePasswordModal() {
  document.getElementById('password-modal').classList.remove('active');
  document.getElementById('password-form').reset();
  state.currentEditingId = null;
}

function handlePasswordSave(e) {
  e.preventDefault();
  
  const item = {
    id: state.currentEditingId || generateId(),
    type: 'password',
    title: document.getElementById('item-title').value,
    username: document.getElementById('item-username').value,
    password: document.getElementById('item-password').value,
    url: document.getElementById('item-url').value,
    notes: document.getElementById('item-notes').value,
    tags: document.getElementById('item-tags').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  if (state.currentEditingId) {
    // Update existing
    const index = state.passwords.findIndex(p => p.id === state.currentEditingId);
    if (index !== -1) {
      state.passwords[index] = item;
    }
  } else {
    // Add new
    state.passwords.push(item);
  }
  
  // Save to storage
  storage.save('passwords', state.passwords);
  
  // Update UI
  renderUnifiedList();
  closePasswordModal();
}

function editPassword(id) {
  openPasswordModal(id);
}

function deletePassword(id) {
  if (!confirm('Sei sicuro di voler eliminare questa password?')) {
    return;
  }
  
  state.passwords = state.passwords.filter(p => p.id !== id);
  storage.save('passwords', state.passwords);
  renderUnifiedList();
}

function copyToClipboard(id, field) {
  const item = state.passwords.find(p => p.id === id);
  if (!item) return;
  
  const text = field === 'username' ? item.username : item.password;
  
  navigator.clipboard.writeText(text).then(() => {
    alert(`${field === 'username' ? 'Username' : 'Password'} copiato negli appunti!`);
    
    // Auto-cancellazione dopo 30 secondi
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 30000);
  }).catch(err => {
    console.error('Errore copia:', err);
  });
}

function togglePasswordVisibility() {
  const input = document.getElementById('item-password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

function generatePassword() {
  const password = generateSecurePassword();
  document.getElementById('item-password').value = password;
}

function openBackupModal() {
  const modal = document.getElementById('backup-modal');
  document.getElementById('backup-count').textContent = state.passwords.length;
  
  const lastModified = state.passwords.length > 0
    ? new Date(Math.max(...state.passwords.map(p => p.updatedAt))).toLocaleString('it-IT')
    : '-';
  document.getElementById('backup-date').textContent = lastModified;
  
  modal.classList.add('active');
}

function closeBackupModal() {
  document.getElementById('backup-modal').classList.remove('active');
}

async function createBackup() {
  try {
    const backup = {
      version: 1,
      createdAt: Date.now(),
      passwords: state.passwords
    };
    
    const encrypted = await cryptoUtils.encrypt(backup, state.masterKey);
    const blob = new Blob([encrypted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `password-manager-backup-${Date.now()}.vault`;
    a.click();
    
    URL.revokeObjectURL(url);
    alert('Backup creato con successo!');
    closeBackupModal();
  } catch (error) {
    alert('Errore durante la creazione del backup');
    console.error(error);
  }
}

// Utility functions
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Esporta funzioni globali per onclick handlers
window.openPasswordModal = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.editPassword = editPassword;
window.deletePassword = deletePassword;
window.copyToClipboard = copyToClipboard;
window.togglePasswordVisibility = togglePasswordVisibility;
window.generatePassword = generatePassword;
window.openBackupModal = openBackupModal;
window.closeBackupModal = closeBackupModal;
window.createBackup = createBackup;


// ===== CREDIT CARD MANAGEMENT =====

function switchTab(tab) {
  state.currentTab = tab;
  renderUnifiedList();
}

function handleFilterChange(e) {
  state.currentTab = e.target.value;
  renderUnifiedList();
}

function handleAddItem() {
  openAddMenu();
}

function openCardModal(id = null) {
  const modal = document.getElementById('card-modal');
  const form = document.getElementById('card-form');
  const title = document.getElementById('card-modal-title');
  
  if (id) {
    // Edit mode
    const item = state.cards.find(c => c.id === id);
    if (!item) return;
    
    state.currentEditingId = id;
    title.textContent = 'Modifica Carta';
    document.getElementById('card-title').value = item.title;
    document.getElementById('card-number').value = item.cardNumber;
    document.getElementById('card-holder').value = item.holderName;
    document.getElementById('card-expiry').value = item.expiryDate;
    document.getElementById('card-cvv').value = item.cvv;
    document.getElementById('card-notes').value = item.notes || '';
    document.getElementById('card-tags').value = item.tags ? item.tags.join(', ') : '';
  } else {
    // Add mode
    state.currentEditingId = null;
    title.textContent = 'Nuova Carta di Credito';
    form.reset();
  }
  
  modal.classList.add('active');
}

function closeCardModal() {
  document.getElementById('card-modal').classList.remove('active');
  document.getElementById('card-form').reset();
  state.currentEditingId = null;
}

function handleCardSave(e) {
  e.preventDefault();
  
  const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
  
  // Validate card number with Luhn algorithm
  if (!validateLuhn(cardNumber)) {
    alert('Numero carta non valido');
    return;
  }
  
  const item = {
    id: state.currentEditingId || generateId(),
    type: 'creditcard',
    title: document.getElementById('card-title').value,
    cardNumber: cardNumber,
    holderName: document.getElementById('card-holder').value,
    expiryDate: document.getElementById('card-expiry').value,
    cvv: document.getElementById('card-cvv').value,
    notes: document.getElementById('card-notes').value,
    tags: document.getElementById('card-tags').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  if (state.currentEditingId) {
    // Update existing
    const index = state.cards.findIndex(c => c.id === state.currentEditingId);
    if (index !== -1) {
      state.cards[index] = item;
    }
  } else {
    // Add new
    state.cards.push(item);
  }
  
  // Save to storage
  storage.save('cards', state.cards);
  
  // Update UI
  renderUnifiedList();
  closeCardModal();
}

function renderCardList(filteredCards = null) {
  const list = document.getElementById('card-list');
  const cards = filteredCards || state.cards;
  
  if (cards.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Nessuna carta salvata</p>
        <button class="btn btn-primary" onclick="openCardModal()">
          Aggiungi la prima carta
        </button>
      </div>
    `;
    return;
  }
  
  list.innerHTML = cards.map(item => {
    const maskedNumber = maskCardNumber(item.cardNumber);
    const isExpiring = checkExpiring(item.expiryDate);
    
    return `
      <div class="card-item">
        <div class="password-item-header">
          <div>
            <div class="password-item-title">💳 ${escapeHtml(item.title)}</div>
            <div class="password-item-url">${maskedNumber}</div>
            ${isExpiring ? '<div class="expiry-warning">⚠️ In scadenza tra 30 giorni</div>' : ''}
          </div>
          <div class="password-item-actions">
            <button class="btn btn-small btn-secondary" onclick="copyCardNumber('${item.id}')">
              📋 Numero
            </button>
            <button class="btn btn-small btn-secondary" onclick="copyCVV('${item.id}')">
              📋 CVV
            </button>
            <button class="btn btn-small btn-secondary" onclick="editCard('${item.id}')">
              ✏️
            </button>
            <button class="btn btn-small btn-danger" onclick="deleteCard('${item.id}')">
              🗑️
            </button>
          </div>
        </div>
        <div class="password-item-body">
          <div class="password-field">
            <span class="password-field-label">Titolare:</span>
            <span class="password-field-value">${escapeHtml(item.holderName)}</span>
          </div>
          <div class="password-field">
            <span class="password-field-label">Scadenza:</span>
            <span class="password-field-value">${escapeHtml(item.expiryDate)}</span>
          </div>
          <div class="password-field">
            <span class="password-field-label">CVV:</span>
            <span class="password-field-value">•••</span>
          </div>
          ${item.notes ? `
            <div class="password-field">
              <span class="password-field-label">Note:</span>
              <span class="password-field-value">${escapeHtml(item.notes)}</span>
            </div>
          ` : ''}
        </div>
        ${item.tags && item.tags.length > 0 ? `
          <div class="password-tags">
            ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function editCard(id) {
  openCardModal(id);
}

function deleteCard(id) {
  if (!confirm('Sei sicuro di voler eliminare questa carta?')) {
    return;
  }
  
  state.cards = state.cards.filter(c => c.id !== id);
  storage.save('cards', state.cards);
  renderUnifiedList();
}

function copyCardNumber(id) {
  const item = state.cards.find(c => c.id === id);
  if (!item) return;
  
  navigator.clipboard.writeText(item.cardNumber).then(() => {
    alert('Numero carta copiato negli appunti!');
    
    // Auto-cancellazione dopo 30 secondi
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 30000);
  }).catch(err => {
    console.error('Errore copia:', err);
  });
}

function copyCVV(id) {
  const item = state.cards.find(c => c.id === id);
  if (!item) return;
  
  navigator.clipboard.writeText(item.cvv).then(() => {
    alert('CVV copiato negli appunti!');
    
    // Auto-cancellazione dopo 30 secondi
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 30000);
  }).catch(err => {
    console.error('Errore copia:', err);
  });
}

// Utility functions for credit cards

function maskCardNumber(cardNumber) {
  if (!cardNumber || cardNumber.length < 4) return '****';
  const last4 = cardNumber.slice(-4);
  return '**** **** **** ' + last4;
}

function validateLuhn(cardNumber) {
  // Remove spaces and non-digits
  const digits = cardNumber.replace(/\D/g, '');
  
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  // Loop through values starting from the rightmost digit
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

function checkExpiring(expiryDate) {
  // Format: MM/YY
  const [month, year] = expiryDate.split('/');
  const expiry = new Date(2000 + parseInt(year), parseInt(month) - 1);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return expiry <= thirtyDaysFromNow && expiry >= now;
}

function formatCardNumber(e) {
  let value = e.target.value.replace(/\s/g, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  e.target.value = formattedValue;
}

function formatExpiry(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.slice(0, 2) + '/' + value.slice(2, 4);
  }
  e.target.value = value;
}

// Export card functions
window.switchTab = switchTab;
window.openCardModal = openCardModal;
window.closeCardModal = closeCardModal;
window.editCard = editCard;
window.deleteCard = deleteCard;
window.copyCardNumber = copyCardNumber;
window.copyCVV = copyCVV;
window.openAddMenu = openAddMenu;
window.toggleAddMenu = toggleAddMenu;
window.selectCard = selectCard;
window.copyField = copyField;
window.editSelected = editSelected;
window.duplicateSelected = duplicateSelected;
window.deleteSelected = deleteSelected;


// ===== DOCUMENT MANAGEMENT =====

function openDocumentModal(id = null) {
  const modal = document.getElementById('document-modal');
  const form = document.getElementById('document-form');
  const title = document.getElementById('document-modal-title');
  const preview = document.getElementById('doc-preview');
  
  if (id) {
    // Edit mode
    const item = state.documents.find(d => d.id === id);
    if (!item) return;
    
    state.currentEditingId = id;
    title.textContent = 'Modifica Documento';
    document.getElementById('doc-type').value = item.docType;
    document.getElementById('doc-title').value = item.title;
    document.getElementById('doc-number').value = item.docNumber || '';
    document.getElementById('doc-issuer').value = item.issuer || '';
    document.getElementById('doc-issue-date').value = item.issueDate || '';
    document.getElementById('doc-expiry-date').value = item.expiryDate || '';
    document.getElementById('doc-notes').value = item.notes || '';
    document.getElementById('doc-tags').value = item.tags ? item.tags.join(', ') : '';
    
    // Show existing image
    if (item.imageData) {
      preview.innerHTML = `<img src="${item.imageData}" alt="Preview">`;
    }
  } else {
    // Add mode
    state.currentEditingId = null;
    title.textContent = 'Nuovo Documento';
    form.reset();
    preview.innerHTML = '';
  }
  
  modal.classList.add('active');
}

function closeDocumentModal() {
  document.getElementById('document-modal').classList.remove('active');
  document.getElementById('document-form').reset();
  document.getElementById('doc-preview').innerHTML = '';
  state.currentEditingId = null;
}

function handleDocumentImagePreview(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('File troppo grande! Massimo 5MB');
    e.target.value = '';
    return;
  }
  
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (!validTypes.includes(file.type)) {
    alert('Formato non supportato! Usa JPG, PNG o PDF');
    e.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
    const preview = document.getElementById('doc-preview');
    if (file.type === 'application/pdf') {
      preview.innerHTML = `<p>📄 PDF: ${file.name}</p>`;
    } else {
      preview.innerHTML = `<img src="${event.target.result}" alt="Preview">`;
    }
  };
  reader.readAsDataURL(file);
}

function handleDocumentSave(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('doc-image');
  const file = fileInput.files[0];
  
  const saveDocument = (imageData = null) => {
    const item = {
      id: state.currentEditingId || generateId(),
      type: 'document',
      docType: document.getElementById('doc-type').value,
      title: document.getElementById('doc-title').value,
      docNumber: document.getElementById('doc-number').value,
      issuer: document.getElementById('doc-issuer').value,
      issueDate: document.getElementById('doc-issue-date').value,
      expiryDate: document.getElementById('doc-expiry-date').value,
      imageData: imageData,
      notes: document.getElementById('doc-notes').value,
      tags: document.getElementById('doc-tags').value
        .split(',')
        .map(t => t.trim())
        .filter(t => t),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    if (state.currentEditingId) {
      // Update existing
      const index = state.documents.findIndex(d => d.id === state.currentEditingId);
      if (index !== -1) {
        // Keep existing image if no new one
        if (!imageData && state.documents[index].imageData) {
          item.imageData = state.documents[index].imageData;
        }
        state.documents[index] = item;
      }
    } else {
      // Add new
      state.documents.push(item);
    }
    
    // Save to storage
    storage.save('documents', state.documents);
    
    // Update UI
    renderUnifiedList();
    closeDocumentModal();
  };
  
  // If there's a file, read it first
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      saveDocument(event.target.result);
    };
    reader.readAsDataURL(file);
  } else {
    saveDocument();
  }
}

function renderDocumentList(filteredDocs = null) {
  const list = document.getElementById('document-list');
  const documents = filteredDocs || state.documents;
  
  if (documents.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>Nessun documento salvato</p>
        <button class="btn btn-primary" onclick="openDocumentModal()">
          Aggiungi il primo documento
        </button>
      </div>
    `;
    return;
  }
  
  list.innerHTML = documents.map(item => {
    const typeIcon = getDocTypeIcon(item.docType);
    const isExpiring = item.expiryDate && checkDocExpiring(item.expiryDate);
    
    return `
      <div class="document-item">
        <div class="password-item-header">
          <div>
            <div class="password-item-title">${typeIcon} ${escapeHtml(item.title)}</div>
            ${item.docNumber ? `<div class="password-item-url">N° ${escapeHtml(item.docNumber)}</div>` : ''}
            ${isExpiring ? '<div class="expiry-warning">⚠️ In scadenza tra 30 giorni</div>' : ''}
          </div>
          <div class="password-item-actions">
            ${item.imageData ? `<button class="btn btn-small btn-secondary" onclick="viewDocImage('${item.id}')">👁️ Vedi</button>` : ''}
            <button class="btn btn-small btn-secondary" onclick="editDocument('${item.id}')">
              ✏️
            </button>
            <button class="btn btn-small btn-danger" onclick="deleteDocument('${item.id}')">
              🗑️
            </button>
          </div>
        </div>
        <div class="password-item-body">
          ${item.issuer ? `
            <div class="password-field">
              <span class="password-field-label">Emittente:</span>
              <span class="password-field-value">${escapeHtml(item.issuer)}</span>
            </div>
          ` : ''}
          ${item.issueDate ? `
            <div class="password-field">
              <span class="password-field-label">Rilascio:</span>
              <span class="password-field-value">${formatDate(item.issueDate)}</span>
            </div>
          ` : ''}
          ${item.expiryDate ? `
            <div class="password-field">
              <span class="password-field-label">Scadenza:</span>
              <span class="password-field-value">${formatDate(item.expiryDate)}</span>
            </div>
          ` : ''}
          ${item.notes ? `
            <div class="password-field">
              <span class="password-field-label">Note:</span>
              <span class="password-field-value">${escapeHtml(item.notes)}</span>
            </div>
          ` : ''}
          ${item.imageData ? `
            <div class="password-field">
              <img src="${item.imageData}" class="doc-thumbnail" onclick="viewDocImage('${item.id}')" alt="Thumbnail">
            </div>
          ` : ''}
        </div>
        ${item.tags && item.tags.length > 0 ? `
          <div class="password-tags">
            ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function editDocument(id) {
  openDocumentModal(id);
}

function deleteDocument(id) {
  if (!confirm('Sei sicuro di voler eliminare questo documento?')) {
    return;
  }
  
  state.documents = state.documents.filter(d => d.id !== id);
  storage.save('documents', state.documents);
  renderUnifiedList();
}

function viewDocImage(id) {
  const item = state.documents.find(d => d.id === id);
  if (!item || !item.imageData) return;
  
  // Open in new window
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>${item.title}</title>
        <style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
          img { max-width: 100%; max-height: 100vh; }
        </style>
      </head>
      <body>
        <img src="${item.imageData}" alt="${item.title}">
      </body>
    </html>
  `);
}

// Utility functions for documents

function getDocTypeIcon(type) {
  const icons = {
    'passport': '🛂',
    'id-card': '🪪',
    'driver-license': '🚗',
    'other': '📄'
  };
  return icons[type] || '📄';
}

function checkDocExpiring(expiryDate) {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return expiry <= thirtyDaysFromNow && expiry >= now;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT');
}

// Export document functions
window.openDocumentModal = openDocumentModal;
window.closeDocumentModal = closeDocumentModal;
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
window.viewDocImage = viewDocImage;


// ===== SETTINGS MANAGEMENT =====

function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  
  // Update statistics
  document.getElementById('stats-passwords').textContent = state.passwords.length;
  document.getElementById('stats-cards').textContent = state.cards.length;
  document.getElementById('stats-documents').textContent = state.documents.length;
  
  modal.classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.remove('active');
  document.getElementById('change-pin-form').reset();
}

function handleChangePIN(e) {
  e.preventDefault();
  
  const currentPin = document.getElementById('current-pin').value;
  const newPin = document.getElementById('new-pin').value;
  const confirmPin = document.getElementById('confirm-pin').value;
  
  // Validate current PIN
  if (currentPin !== state.currentPIN) {
    alert('PIN attuale non corretto!');
    return;
  }
  
  // Validate new PIN format
  if (!/^\d{4,8}$/.test(newPin)) {
    alert('Il nuovo PIN deve essere di 4-8 cifre numeriche');
    return;
  }
  
  // Validate PIN confirmation
  if (newPin !== confirmPin) {
    alert('I PIN non corrispondono!');
    return;
  }
  
  // Check if new PIN is different
  if (newPin === currentPin) {
    alert('Il nuovo PIN deve essere diverso da quello attuale');
    return;
  }
  
  // Update PIN
  state.currentPIN = newPin;
  state.masterKey = { pin: newPin, timestamp: Date.now() };
  
  // In a real app, you would re-encrypt all data with the new PIN
  // For this demo, we just update the state
  
  alert('✅ PIN cambiato con successo!');
  closeSettingsModal();
}

function clearAllData() {
  const confirmation = prompt(
    'ATTENZIONE: Questa azione cancellerà TUTTI i dati del vault in modo permanente!\n\n' +
    'Per confermare, digita "CANCELLA TUTTO" (maiuscolo):'
  );
  
  if (confirmation === 'CANCELLA TUTTO') {
    // Clear all data
    localStorage.clear();
    state.passwords = [];
    state.cards = [];
    state.documents = [];
    
    alert('✅ Tutti i dati sono stati cancellati');
    
    // Logout
    handleLogout();
  } else {
    alert('Operazione annullata');
  }
}

// Export settings functions
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.clearAllData = clearAllData;


// ===== BIOMETRIC AUTHENTICATION =====

async function checkBiometricAvailability() {
  console.log('Checking biometric availability...');
  
  // Check if WebAuthn is available
  if (!window.PublicKeyCredential) {
    console.log('WebAuthn not supported');
    return;
  }
  
  try {
    // Check if biometric is available
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    console.log('Biometric available:', available);
    
    if (available) {
      console.log('Biometric authentication available');
      
      // Check if already configured
      const biometricCredential = storage.load('biometric_credential');
      console.log('Biometric credential stored:', !!biometricCredential);
      
      if (biometricCredential) {
        // Show biometric button on login screen
        const biometricBtn = document.getElementById('biometric-btn');
        if (biometricBtn) {
          biometricBtn.style.display = 'flex';
          console.log('Biometric button shown');
          
          // Update text based on platform
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          
          if (isMac) {
            document.getElementById('biometric-text').textContent = 'Sblocca con Touch ID';
            document.getElementById('biometric-icon').textContent = '👆';
          } else if (isIOS) {
            document.getElementById('biometric-text').textContent = 'Sblocca con Face ID';
            document.getElementById('biometric-icon').textContent = '👤';
          } else {
            document.getElementById('biometric-text').textContent = 'Sblocca con Biometria';
            document.getElementById('biometric-icon').textContent = '🔐';
          }
        }
      } else {
        console.log('Biometric not configured yet - go to Settings to set it up');
      }
    } else {
      console.log('Biometric authentication not available on this device');
    }
  } catch (error) {
    console.error('Error checking biometric availability:', error);
  }
}

async function setupBiometric() {
  if (!window.PublicKeyCredential) {
    alert('Il tuo browser non supporta l\'autenticazione biometrica');
    return;
  }
  
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) {
    alert('L\'autenticazione biometrica non è disponibile su questo dispositivo');
    return;
  }
  
  try {
    // Generate a challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Create credential
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: {
          name: "Password Manager",
          id: window.location.hostname
        },
        user: {
          id: new Uint8Array(16),
          name: "user@passwordmanager.local",
          displayName: "Password Manager User"
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    });
    
    if (credential) {
      // Save credential ID
      const credentialData = {
        id: credential.id,
        rawId: Array.from(new Uint8Array(credential.rawId)),
        pin: state.currentPIN // Store encrypted PIN (in production, use proper encryption)
      };
      
      storage.save('biometric_credential', credentialData);
      
      alert('✅ Autenticazione biometrica configurata con successo!');
      
      // Update UI
      updateBiometricStatus();
      checkBiometricAvailability();
    }
  } catch (error) {
    console.error('Biometric setup error:', error);
    if (error.name === 'NotAllowedError') {
      alert('Autenticazione biometrica annullata');
    } else {
      alert('Errore durante la configurazione: ' + error.message);
    }
  }
}

async function handleBiometricLogin() {
  const biometricCredential = storage.load('biometric_credential');
  if (!biometricCredential) {
    alert('Autenticazione biometrica non configurata');
    return;
  }
  
  try {
    // Generate a challenge
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    
    // Get credential
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        rpId: window.location.hostname,
        allowCredentials: [{
          id: new Uint8Array(biometricCredential.rawId),
          type: 'public-key'
        }],
        userVerification: "required",
        timeout: 60000
      }
    });
    
    if (assertion) {
      // Biometric authentication successful
      const pin = biometricCredential.pin;
      
      // Login with stored PIN
      state.masterKey = { pin, timestamp: Date.now() };
      state.currentPIN = pin;
      state.isLocked = false;
      
      showScreen('main-screen');
      renderPasswordList();
      
      console.log('Biometric login successful');
    }
  } catch (error) {
    console.error('Biometric login error:', error);
    if (error.name === 'NotAllowedError') {
      alert('Autenticazione biometrica annullata o fallita');
    } else {
      alert('Errore durante l\'autenticazione: ' + error.message);
    }
  }
}

function removeBiometric() {
  if (!confirm('Vuoi rimuovere l\'autenticazione biometrica?')) {
    return;
  }
  
  storage.remove('biometric_credential');
  alert('✅ Autenticazione biometrica rimossa');
  
  // Update UI
  updateBiometricStatus();
  
  // Hide biometric button on login screen
  const biometricBtn = document.getElementById('biometric-btn');
  if (biometricBtn) {
    biometricBtn.style.display = 'none';
  }
}

function updateBiometricStatus() {
  const biometricCredential = storage.load('biometric_credential');
  const statusElement = document.getElementById('biometric-status');
  const setupBtn = document.getElementById('setup-biometric-btn');
  const removeBtn = document.getElementById('remove-biometric-btn');
  
  if (biometricCredential) {
    if (statusElement) statusElement.textContent = '✅ Configurata';
    if (setupBtn) setupBtn.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'block';
  } else {
    if (statusElement) statusElement.textContent = 'Non configurata';
    if (setupBtn) setupBtn.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

// Update biometric status when opening settings
const originalOpenSettingsModal = openSettingsModal;
openSettingsModal = function() {
  originalOpenSettingsModal();
  updateBiometricStatus();
};

// Export biometric functions
window.setupBiometric = setupBiometric;
window.removeBiometric = removeBiometric;


// ===== DARK MODE / THEME MANAGEMENT =====

function loadTheme() {
  const savedTheme = storage.load('theme') || 'auto';
  applyTheme(savedTheme);
  updateThemeSelector(savedTheme);
}

function setTheme(theme) {
  storage.save('theme', theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  const html = document.documentElement;
  
  console.log('Applying theme:', theme);
  
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
    console.log('Dark theme applied, data-theme:', html.getAttribute('data-theme'));
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
    console.log('Light theme applied, data-theme:', html.getAttribute('data-theme'));
  } else {
    // Auto mode - use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    console.log('Auto theme applied, prefersDark:', prefersDark, 'data-theme:', html.getAttribute('data-theme'));
  }
  
  console.log('Theme applied:', theme);
}

function updateThemeSelector(theme) {
  const radios = document.querySelectorAll('input[name="theme"]');
  radios.forEach(radio => {
    if (radio.value === theme) {
      radio.checked = true;
    }
  });
}

// Listen for system theme changes when in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const currentTheme = storage.load('theme') || 'auto';
  if (currentTheme === 'auto') {
    applyTheme('auto');
  }
});

// Update theme selector when opening settings
const originalOpenSettingsModal2 = openSettingsModal;
openSettingsModal = function() {
  originalOpenSettingsModal2();
  updateBiometricStatus();
  const currentTheme = storage.load('theme') || 'auto';
  updateThemeSelector(currentTheme);
};

// Export theme functions
window.setTheme = setTheme;
