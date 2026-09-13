const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Element refs ---
const loadingScreen = document.getElementById('loadingScreen');
const appShell = document.getElementById('appShell');
const logoutBtn = document.getElementById('confirmLogoutBtn');
const messagesEl = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const avatarCircle = document.getElementById('avatarCircle');
const sidebarEmail = document.getElementById('sidebarEmail');
const newConversationBtn = document.getElementById('newConversationBtn');
const conversationListEl = document.getElementById('conversationList');
const planBadge = document.getElementById('planBadge');
const sidebarPlanName = document.getElementById('sidebarPlanName');
const sidebarPlanUsage = document.getElementById('sidebarPlanUsage');
const sidebarPlanCta = document.getElementById('sidebarPlanCta');
const voiceStopRow = document.getElementById('voiceStopRow');
const stopVoiceBtn = document.getElementById('stopVoiceBtn');

// Maximo identity response. These are local assets so this special response
// does not consume an AI request. Add the two real photos to assets/ using
// these exact filenames.
const MAXIMO_PHOTOS = [
  'assets/maximo-1.jpg',
  'assets/maximo-2.jpg'
];
const MAXIMO_IDENTITY_REPLY = `I'm Maximo AI Assistant. Maximo Villaflor made me. He's my father and the developer behind me. He's been creating, updating, and improving my code to make me alive and give me better abilities.`;

function isMaximoIdentityRequest(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return /\bwho (?:is|s) (?:maximo|villaflor|villaflor jr|maximo villaflor)\b/.test(t)
    || /\b(?:maximo|villaflor|villaflor jr|maximo villaflor)\s+(?:who|is he|is this)\b/.test(t)
    || /\bwho (?:made|created|built|developed) you\b/.test(t)
    || /\bwho (?:is|was) your (?:creator|father|developer)\b/.test(t)
    || /\bwho made maxnova\b/.test(t)
    || /\bwho created maxnova\b/.test(t);
}

// Images / Library
const openImagesBtn = document.getElementById('openImagesBtn');
const openLibraryBtn = document.getElementById('openLibraryBtn');
const openFilesBtn = document.getElementById('openFilesBtn');
const openKidsModeBtn = document.getElementById('openKidsModeBtn');
const kidsModeOverlay = document.getElementById('kidsModeOverlay');
const kidsModeSwitch = document.getElementById('kidsModeSwitch');
const kidsModeEnableBtn = document.getElementById('kidsModeEnableBtn');
const kidsModeStateText = document.getElementById('kidsModeStateText');
const kidsModeNavStatus = document.getElementById('kidsModeNavStatus');
const kidsModeIndicator = document.getElementById('kidsModeIndicator');
const kidsModeToast = document.getElementById('kidsModeToast');
const kidsModeToastTitle = document.getElementById('kidsModeToastTitle');
let kidsModeToastTimer = null;
const imagesOverlay = document.getElementById('imagesOverlay');
const closeImagesBtn = document.getElementById('closeImagesBtn');
const imagesTabs = document.getElementById('imagesTabs');
const imagesGrid = document.getElementById('imagesGrid');
const imagesPromptInput = document.getElementById('imagesPromptInput');
const imagesGenerateBtn = document.getElementById('imagesGenerateBtn');
const imagesResult = document.getElementById('imagesResult');
const imagesResultLoading = document.getElementById('imagesResultLoading');
const imagesResultImg = document.getElementById('imagesResultImg');
const imagesResultCard = document.getElementById('imagesResultCard');
const imagesResultCaption = document.getElementById('imagesResultCaption');
const imagesResultDownload = document.getElementById('imagesResultDownload');
const imagesResultCornerDownload = document.getElementById('imagesResultCornerDownload');
const imagesResultCloseBtn = document.getElementById('imagesResultCloseBtn');
const lightboxLoading = document.getElementById('lightboxLoading');
const freeImagesStatus = document.getElementById('freeImagesStatus');

const libraryOverlay = document.getElementById('libraryOverlay');
const closeLibraryBtn = document.getElementById('closeLibraryBtn');
const libraryBody = document.getElementById('libraryBody');
const libraryEmpty = document.getElementById('libraryEmpty');
const libraryGrid = document.getElementById('libraryGrid');
const libraryLightbox = document.getElementById('libraryLightbox');
const filesOverlay = document.getElementById('filesOverlay');
const closeFilesBtn = document.getElementById('closeFilesBtn');
const filesEmpty = document.getElementById('filesEmpty');
const filesList = document.getElementById('filesList');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxDownload = document.getElementById('lightboxDownload');
const lightboxDeleteBtn = document.getElementById('lightboxDeleteBtn');

// Attachments
const plusBtn = document.getElementById('plusBtn');
const uploadMediaBtn = document.getElementById('uploadMediaBtn');
const uploadMediaInput = document.getElementById('uploadMediaInput');
const cameraInput = document.getElementById('cameraInput');
const photosInput = document.getElementById('photosInput');
const filesInput = document.getElementById('filesInput');
const wordDocumentsInput = document.getElementById('wordDocumentsInput');
const pdfInput = document.getElementById('pdfInput');
const wordLegacyInput = document.getElementById('wordDocumentsInput');
const attachSheetOverlay = document.getElementById('attachSheetOverlay');
const sheetCameraBtn = document.getElementById('sheetCameraBtn');
const sheetPhotosBtn = document.getElementById('sheetPhotosBtn');
const sheetFilesBtn = document.getElementById('sheetFilesBtn');
const sheetWordBtn = document.getElementById('sheetWordBtn');
const sheetPdfBtn = document.getElementById('sheetPdfBtn');
const sheetCancelBtn = document.getElementById('sheetCancelBtn');
const attachPreviewRow = document.getElementById('attachPreviewRow');
const attachChipImg = document.getElementById('attachChipImg');
const attachChipFileIcon = document.getElementById('attachChipFileIcon');
const attachChipName = document.getElementById('attachChipName');
const attachChipRemove = document.getElementById('attachChipRemove');

let userId = null;
let userEmail = '';
let conversations = [];       // [{ id, title, messages: [{role, content, attachment?}], updatedAt }]
let currentConversationId = null;
let messages = [];
let sending = false;
let pendingAttachment = null; // { kind: 'image'|'file', name, mime, dataUrl?, textContent?, note? }
let editingMessageIndex = null;
let activeMessageIndex = null;
let conversationVisibleCount = 12;
const CONVERSATIONS_PAGE_SIZE = 12;

const DEFAULT_GREETING = { role: 'assistant', content: "Hi! I'm MaxNova, your AI assistant. Ask me anything to get started.", suggestions: ['What can you help me with?', 'Create an image for me', 'Explain something to me'], timestamp: Date.now() };

// --- Storage helpers (per-browser, per-user) ---
function storageKey() {
  return `ai_assistant_conversations_${userId}`;
}

function loadConversationsFromStorage() {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversationsToStorage() {
  localStorage.setItem(storageKey(), JSON.stringify(conversations));
}

function generateId() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}

function deriveTitle(msgs) {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New conversation';
  const text = firstUser.content.trim();
  return text.length > 32 ? text.slice(0, 32) + '…' : text;
}

// --- Auth gate ---
let chatAuthStarted = false;
let chatAuthRedirected = false;

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function getStableChatSession() {
  // Mobile WebViews sometimes need a moment to restore the persisted Supabase
  // session. Never redirect on the first null result.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (!error && data?.session?.user) return data.session;
    } catch (_) {}
    await wait(250 * (attempt + 1));
  }
  try {
    const { data, error } = await supabaseClient.auth.refreshSession();
    if (!error && data?.session?.user) return data.session;
  } catch (_) {}
  return null;
}

async function initializeChat(force = false) {
  if (chatAuthStarted && !force) return;
  chatAuthStarted = true;

  const session = await getStableChatSession();
  if (!session?.user) {
    // Give the auth event listener a final chance before redirecting. This is
    // important on Android WebView where persisted storage can finish later.
    chatAuthStarted = false;
    await wait(900);
    let recovered = null;
    try { recovered = (await supabaseClient.auth.getSession())?.data?.session || null; } catch (_) {}
    if (recovered?.user) { return initializeChat(true); }
    if (!chatAuthRedirected) {
      chatAuthRedirected = true;
      window.location.replace('index.html');
    }
    return;
  }

  userId = session.user.id;
  userEmail = String(session.user.email || '').trim().toLowerCase();
  window.__maxNovaUserId = userId;
  window.__maxNovaUserEmail = userEmail;
  if (userEmail === 'wilmeolid@gmail.com') {
    setPlan(userId, 'max');
    window.__maxNovaUnlimited = true;
  } else {
    window.__maxNovaUnlimited = false;
  }

  // These are enhancements and must never block the first render.
  syncAdminPlanFromDatabase(userId)
    .then(() => renderPlanUI?.())
    .catch(() => {});
  if (window.MaxNovaNative?.setBillingAuth) {
    try { window.MaxNovaNative.setBillingAuth(userId, session.access_token || ''); } catch (_) {}
  }
  if (window.maxNovaSyncBillingPlan) {
    window.maxNovaSyncBillingPlan(userId).then(() => renderPlanUI?.()).catch(() => {});
    window.setInterval(() => {
      window.maxNovaSyncBillingPlan?.(userId).then(() => renderPlanUI?.()).catch(() => {});
    }, 60000);
  }

  window.renderPlanUI = renderPlanUI;
  setAdminVisibility();
  sidebarEmail.textContent = userEmail;
  avatarCircle.textContent = (userEmail || '?').charAt(0).toUpperCase();

  conversations = loadConversationsFromStorage();
  renderSidebarList();
  startNewConversation(false);
  renderPlanUI();

  loadingScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  document.body.classList.add('maxnova-app-active');

  const params = new URLSearchParams(window.location.search);
  if (params.get('openBilling') === '1' && typeof window.openBillingModal === 'function') {
    setTimeout(() => window.openBillingModal(params.get('plan'), params.get('cycle')), 80);
    try { history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  // Do not redirect for INITIAL_SESSION/TOKEN_REFRESHED. They can briefly
  // carry a null session while the WebView restores storage.
  if (event === 'SIGNED_OUT' && !chatAuthRedirected) {
    chatAuthRedirected = true;
    window.location.replace('index.html');
  }
  if (event === 'SIGNED_IN' && session?.user && !userId) {
    initializeChat(true).catch(() => {});
  }
});

initializeChat().catch((err) => {
  console.warn('MaxNova chat init:', err);
  // Give one final recovery attempt instead of leaving a blank/loading screen.
  setTimeout(() => initializeChat().catch(() => {}), 500);
});

// --- Plan / usage UI ---
function renderPlanUI() {
  const { plan, remaining, limit } = checkUsage(userId);
  planBadge.textContent = plan.name;
  planBadge.className = 'plan-badge plan-' + plan.key;

  sidebarPlanName.textContent = plan.name + ' plan';
  if (plan.permanent) {
    sidebarPlanUsage.textContent = 'Unlimited messages';
    sidebarPlanCta.textContent = 'Manage plan →';
  } else {
    sidebarPlanUsage.textContent = `${remaining} of ${limit} messages left today`;
    sidebarPlanCta.textContent = plan.key === 'free' ? 'Upgrade →' : 'Change plan →';
  }
}

// --- Sidebar open/close ---
function openSidebar() {
  sidebar.classList.remove('hidden');
  sidebarOverlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
  });
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('open');
  setTimeout(() => {
    sidebar.classList.add('hidden');
    sidebarOverlay.classList.add('hidden');
  }, 200);
}

menuBtn.addEventListener('click', openSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// --- Conversation list rendering ---
function renderSidebarList() {
  if (!conversationListEl) return;
  conversationListEl.innerHTML = '';
  const sorted = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const visible = sorted.slice(0, conversationVisibleCount);

  visible.forEach((conv) => {
    const row = document.createElement('div');
    row.className = 'conversation-row';

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'conversation-item' + (conv.id === currentConversationId ? ' active' : '');
    item.textContent = conv.title || 'New conversation';
    item.addEventListener('click', () => {
      loadConversation(conv.id);
      closeSidebar();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'conversation-delete';
    del.setAttribute('aria-label', 'Delete conversation');
    del.title = 'Delete conversation';
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    del.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!del.classList.contains('confirming')) {
        // First tap arms a confirmation instead of deleting immediately —
        // this has to work without any native JS confirm() dialog, since
        // the Android WebView doesn't show those without extra native code.
        del.classList.add('confirming');
        del.innerHTML = '';
        const revert = () => {
          del.classList.remove('confirming');
          del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
        };
        const revertTimer = setTimeout(revert, 2600);
        del.onclick = (ev2) => {
          ev2.preventDefault();
          ev2.stopPropagation();
          clearTimeout(revertTimer);
          deleteConversation(conv.id);
        };
        // Clicking elsewhere cancels the pending delete.
        document.addEventListener('click', function cancelOnce(ev3) {
          if (!del.contains(ev3.target)) {
            clearTimeout(revertTimer);
            revert();
            del.onclick = null;
            renderSidebarList();
            document.removeEventListener('click', cancelOnce);
          }
        });
        return;
      }
    });

    row.append(item, del);
    conversationListEl.appendChild(row);
  });

  if (visible.length < sorted.length) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'conversation-see-more';
    more.textContent = `See more (${sorted.length - visible.length})`;
    more.setAttribute('aria-label', 'Load more conversations');
    more.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      conversationVisibleCount += CONVERSATIONS_PAGE_SIZE;
      renderSidebarList();
    });
    conversationListEl.appendChild(more);
  }
}

function startNewConversation(closeAfter = true) {
  currentConversationId = null;
  messages = [{ ...DEFAULT_GREETING }];
  renderMessagesBulk();
  renderSidebarList();
  if (closeAfter) closeSidebar();
}

function loadConversation(id) {
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return;
  currentConversationId = id;
  messages = conv.messages.map((m) => ({ ...m }));
  renderMessagesBulk();
  renderSidebarList();
}

function deleteConversation(id) {
  conversations = conversations.filter((c) => c.id !== id);
  saveConversationsToStorage();
  if (currentConversationId === id) {
    startNewConversation(false);
  } else {
    renderSidebarList();
  }
}

newConversationBtn.addEventListener('click', () => startNewConversation(true));

function persistCurrentConversation() {
  if (currentConversationId) {
    const conv = conversations.find((c) => c.id === currentConversationId);
    if (conv) {
      conv.messages = messages.map((m) => ({ ...m }));
      conv.updatedAt = Date.now();
      if (!conv.title || conv.title === 'New conversation') {
        conv.title = deriveTitle(messages);
      }
    }
  } else {
    const conv = {
      id: generateId(),
      title: deriveTitle(messages),
      messages: messages.map((m) => ({ ...m })),
      updatedAt: Date.now(),
    };
    conversations.push(conv);
    currentConversationId = conv.id;
  }
  saveConversationsToStorage();
  renderSidebarList();
}

// --- Message rendering ---
// AI-style response renderer. It deliberately removes hidden/reasoning tags
// and formats normal Markdown without injecting untrusted HTML into the page.
function cleanAIResponse(text) {
  let value = String(text ?? '').replace(/\r\n?/g, '\n');
  value = value.replace(/<think>[\s\S]*?<\/think>/gi, '');
  value = value.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
  value = value.replace(/^\s*(?:<think>|<analysis>)[\s\S]*$/i, '');
  return value.trim();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function svgNumberBadge(number) {
  const n = String(number);
  return `<span class=\"ai-number-badge\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><text x=\"12\" y=\"16\" text-anchor=\"middle\">${escapeHTML(n)}</text></svg></span>`;
}

function inlineMarkdown(value) {
  let out = escapeHTML(value);
  out = out.replace(/(^|\s)([1-9]|10)️⃣(?=\s|$)/g, (_, prefix, n) => `${prefix}${svgNumberBadge(n)}`);
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}

function markdownToHTML(text) {
  const clean = cleanAIResponse(text);
  if (!clean) return '<p></p>';
  const lines = clean.split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (inCode) {
        html.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph(); closeList(); inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph();
      const wanted = ordered ? 'ol' : 'ul';
      if (listType !== wanted) { closeList(); html.push(`<${wanted}>`); listType = wanted; }
      html.push(`<li>${inlineMarkdown((bullet || ordered)[1])}</li>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph(); closeList();
      html.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
      continue;
    }

    if (!line.trim()) { flushParagraph(); closeList(); continue; }
    closeList();
    paragraph.push(line);
  }
  if (inCode) html.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
  flushParagraph(); closeList();
  return html.join('');
}

function formatMessageTimestamp(timestamp) {
  const d = new Date(timestamp || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} · ${time}`;
}

async function copyTextToClipboard(text) {
  const value = String(text || '');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}
  const ta = document.createElement('textarea');
  ta.value = value; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); return true; } catch (_) { return false; }
  finally { ta.remove(); }
}

function contextualSuggestionFallback(content) {
  const text = String(content || '').toLowerCase();
  if (/image|logo|design|picture|art/.test(text)) return ['Make another version', 'Change the style', 'Make it more professional'];
  if (/code|javascript|html|css|python|svg/.test(text)) return ['Explain this code', 'Improve this code', 'Show me an example'];
  if (/plan|billing|price|subscription/.test(text)) return ['Compare the plans', 'What is included?', 'How does billing work?'];
  return ['Tell me more', 'Give me an example', 'What else can you help with?'];
}

// Wraps any <img> with a shimmering loading skeleton that is removed the
// moment the image finishes loading (or fails). `container` must be
// position: relative (or use the .img-skeleton-host class, which sets that)
// so the skeleton overlay can sit exactly on top of the image while it loads.
function attachImageSkeleton(container, img) {
  if (!container || !img) return;
  container.classList.add('img-skeleton-host');
  const skeleton = document.createElement('div');
  skeleton.className = 'img-loading-skeleton';
  skeleton.setAttribute('aria-hidden', 'true');
  container.appendChild(skeleton);
  let done = false;
  const remove = () => {
    if (done) return;
    done = true;
    skeleton.remove();
  };
  if (img.complete && img.naturalWidth > 0) {
    remove();
    return;
  }
  img.addEventListener('load', remove, { once: true });
  img.addEventListener('error', remove, { once: true });
}

function appendMessageUI(role, content, animate, attachment, messageIndex = -1, special = '', suggestions = [], voice = null) {
  if (role === 'assistant' && (!Array.isArray(suggestions) || suggestions.length === 0)) {
    suggestions = contextualSuggestionFallback(content);
  }
  const div = document.createElement('div');
  div.className = `message ${role}` + (animate ? ' enter' : '');
  if (messageIndex >= 0) div.dataset.messageIndex = String(messageIndex);
  if (isKidsModeEnabled() && !isKidsSafeMessage(content)) {
    div.classList.add('kids-blurred-message');
    div.setAttribute('aria-label', 'Message hidden in Kids Mode because it may contain adult or unsafe content');
  }
  if (role === 'user' && messageIndex >= 0) {
    div.classList.add('message-actionable');
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', 'Message options');
  }

  if (attachment && attachment.kind === 'image' && attachment.dataUrl) {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'message-attachment-img-wrap';
    const img = document.createElement('img');
    img.className = 'message-attachment-img no-native-image-menu';
    img.src = attachment.dataUrl;
    img.alt = attachment.name || 'Attached image';
    img.loading = 'lazy';
    img.draggable = false;
    img.addEventListener('contextmenu', (e) => e.preventDefault());
    imgWrap.appendChild(img);
    div.appendChild(imgWrap);
    attachImageSkeleton(imgWrap, img);
  } else if (attachment) {
    const chip = document.createElement('div');
    chip.className = 'message-attachment-file';
    chip.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span></span>`;
    chip.querySelector('span').textContent = attachment.name || 'Attached file';
    div.appendChild(chip);
  }

  if (voice && voice.url) {
    const voiceWrap = document.createElement('div');
    voiceWrap.className = 'message-voice';

    const audio = document.createElement('audio');
    audio.className = 'message-voice-player';
    audio.controls = true;
    audio.preload = 'metadata';
    audio.src = voice.url;
    audio.setAttribute('aria-label', 'Voice message');

    const duration = document.createElement('span');
    duration.className = 'message-voice-duration';
    const seconds = Math.max(0, Number(voice.duration) || 0);
    duration.textContent = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

    voiceWrap.append(audio, duration);
    div.appendChild(voiceWrap);
  }

  const textNode = document.createElement('div');
  if (role === 'assistant') {
    div.classList.add('ai-rich');
    textNode.className = 'ai-content';
    const safeContent = cleanAssistantText(content);
    const rendered = markdownToHTML(safeContent);
    // Never leave a reply bubble visually empty. This also keeps voice output
    // and the visible transcript in sync when a model returns blank/hidden
    // reasoning content.
    textNode.innerHTML = rendered || `<p>${escapeHTML(safeContent)}</p>`;

    // Keep copy controls contextual: only code blocks get a Copy action,
    // matching the compact ChatGPT-style response UI.
    requestAnimationFrame(() => {
      textNode.querySelectorAll('pre').forEach((pre) => {
        if (pre.querySelector('.ai-code-copy')) return;
        const code = pre.querySelector('code');
        if (!code) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-code-copy';
        btn.setAttribute('aria-label', 'Copy code');
        btn.title = 'Copy code';
        btn.innerHTML = '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2\"></rect><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"></path></svg><span>Copy</span>';
        btn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          await copyTextToClipboard(code.textContent || '');
          btn.classList.add('copied');
          btn.querySelector('span').textContent = 'Copied';
          setTimeout(() => { btn.classList.remove('copied'); btn.querySelector('span').textContent = 'Copy'; }, 1000);
        });
        pre.appendChild(btn);
      });
    });
  } else {
    textNode.textContent = content;
  }
  div.appendChild(textNode);


  if (role === 'assistant' && special === 'maximo-profile') {
    const gallery = document.createElement('div');
    gallery.className = 'maximo-photo-gallery';
    gallery.setAttribute('aria-label', 'Maximo Villaflor photos');
    MAXIMO_PHOTOS.forEach((src, i) => {
      // Wrapped in its own tappable container: the <img> is pointer-events:none
      // (via .no-native-image-menu, blocking the native long-press image menu)
      // so the wrap is what actually receives the tap.
      const wrap = document.createElement('div');
      wrap.className = 'maximo-photo';
      const photo = document.createElement('img');
      photo.className = 'maximo-photo-img no-native-image-menu';
      photo.src = src;
      photo.alt = `Maximo Villaflor photo ${i + 1}`;
      photo.loading = 'lazy';
      photo.draggable = false;
      photo.addEventListener('error', () => wrap.classList.add('photo-missing'));
      photo.addEventListener('contextmenu', (e) => e.preventDefault());
      wrap.appendChild(photo);
      wrap.addEventListener('click', () => {
        if (wrap.classList.contains('photo-missing')) return;
        openImagePreview(src, photo.alt);
      });
      gallery.appendChild(wrap);
    });
    div.appendChild(gallery);
  }

  // Contextual follow-up suggestions: only assistant messages get them.
  // They are generated from the AI response, not hard-coded to one topic.
  if (role === 'assistant' && Array.isArray(suggestions) && suggestions.length) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-suggestions';
    wrap.setAttribute('aria-label', 'Suggested follow-up prompts');
    suggestions.slice(0, 3).forEach((suggestion) => {
      const text = String(suggestion || '').trim();
      if (!text) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-suggestion';
      btn.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"></path></svg>';
      btn.querySelector('span').textContent = text;
      btn.addEventListener('click', () => {
        chatInput.value = text;
        handleSend();
      });
      wrap.appendChild(btn);
    });
    if (wrap.children.length) div.appendChild(wrap);
  }

  // Per-message action row for AI replies: copy / like / share. Kept off
  // Kids-Mode-blurred messages since their content shouldn't be copied or
  // shared while hidden.
  if (role === 'assistant' && !div.classList.contains('kids-blurred-message')) {
    div.appendChild(buildAiMessageActions(content));
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

const LIKE_SPARKLE_COLORS = ['#fff', '#ffd166', '#6c7bff', '#ff6b9d', '#4ade80', '#5ee7ff'];

function spawnLikeSparkles(likeBtn) {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'like-sparkle';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 16 + Math.random() * 14;
    sparkle.style.setProperty('--sx', `${Math.cos(angle) * distance}px`);
    sparkle.style.setProperty('--sy', `${Math.sin(angle) * distance}px`);
    sparkle.style.background = LIKE_SPARKLE_COLORS[i % LIKE_SPARKLE_COLORS.length];
    likeBtn.appendChild(sparkle);
    sparkle.addEventListener('animationend', () => sparkle.remove());
  }
}

function buildAiMessageActions(content) {
  const wrap = document.createElement('div');
  wrap.className = 'ai-message-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ai-msg-action ai-msg-copy';
  copyBtn.setAttribute('aria-label', 'Copy message');
  copyBtn.title = 'Copy';
  copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  copyBtn.addEventListener('click', async () => {
    await copyTextToClipboard(String(content || ''));
    copyBtn.classList.add('copied');
    setTimeout(() => copyBtn.classList.remove('copied'), 1000);
  });

  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = 'ai-msg-action like-btn';
  likeBtn.setAttribute('aria-label', 'Like this response');
  likeBtn.title = 'Like';
  likeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-1 9H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h13a2 2 0 0 0 2-1.7l1.4-9A2 2 0 0 0 18.4 9Z"/></svg>';
  likeBtn.addEventListener('click', () => {
    const nowLiked = !likeBtn.classList.contains('liked');
    likeBtn.classList.toggle('liked', nowLiked);
    if (nowLiked) {
      likeBtn.classList.remove('pop');
      void likeBtn.offsetWidth; // restart animation
      likeBtn.classList.add('pop');
      spawnLikeSparkles(likeBtn);
    }
  });

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'ai-msg-action ai-msg-share';
  shareBtn.setAttribute('aria-label', 'Share this response');
  shareBtn.title = 'Share';
  shareBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 13.5 6.6 4"/><path d="m15.3 6.5-6.6 4"/></svg>';
  shareBtn.addEventListener('click', async () => {
    const text = String(content || '');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MaxNova', text });
      } else {
        await copyTextToClipboard(text);
        shareBtn.classList.add('copied');
        setTimeout(() => shareBtn.classList.remove('copied'), 1000);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.warn('MaxNova share failed', err);
    }
  });

  wrap.append(copyBtn, likeBtn, shareBtn);
  return wrap;
}

// Kids Mode is a UI safety layer for existing transcripts. It does not try to
// judge every sentence; it conservatively blurs messages that contain common
// adult/unsafe topic signals while leaving ordinary child-safe conversation
// readable. The AI safety prompt remains the authority for new replies.
const KIDS_MODE_SENSITIVE_RE = /\b(?:sex(?:ual)?|porn(?:ography)?|nude|nudity|xxx|nsfw|18\+|erotic|explicit|fetish|hentai|intercourse|masturbat(?:e|ion)|orgasm|genitals?|breast(?:s)?|penis|vagina|condom|prostitut(?:e|ion)|escort|strip club|onlyfans|dating app|drugs?|cocaine|heroin|meth(?:amphetamine)?|fentanyl|overdose|weapon(?:s)?|gun(?:s)?|firearm(?:s)?|bomb(?:s)?|explosive(?:s)?|suicide|self[- ]?harm|kill(?:ing)?|murder|gore|graphic violence|torture|gambling|casino|betting|alcohol|vodka|whiskey|beer|wine|marijuana|cannabis|vape|vaping|pornographic)\b/i;

function isKidsSafeMessage(content) {
  const text = String(content || '').replace(/https?:\/\/\S+/gi, '');
  if (!text.trim()) return true;
  return !KIDS_MODE_SENSITIVE_RE.test(text);
}

function renderMessagesBulk() {
  messagesEl.innerHTML = '';
  messages.forEach((m, i) => appendMessageUI(m.role, m.content, false, m.attachment, i, m.special || '', m.suggestions || [], m.voice || null));
}

function showThinking() {
  const div = document.createElement('div');
  div.className = 'message assistant thinking-bubble enter';
  div.id = 'thinkingBubble';
  div.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function hideThinking() {
  const el = document.getElementById('thinkingBubble');
  if (el) el.remove();
}

function appendUpgradePrompt(plan) {
  const div = document.createElement('div');
  div.className = 'message assistant enter';
  div.innerHTML = `Sorry, you've reached your ${plan.name} plan's daily limit. <a href="pricing.html" class="upgrade-link">Upgrade your plan today →</a>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Voice output (text-to-speech) — always on; Stop button shows while speaking ---
function stripForSpeech(text) {
  return text
    .replace(/[#*`_>~]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n+/g, '. ')
    .trim();
}

function showStopVoiceBtn() {
  voiceStopRow.classList.remove('hidden');
  requestAnimationFrame(() => voiceStopRow.classList.add('open'));
}

function hideStopVoiceBtn() {
  voiceStopRow.classList.remove('open');
  setTimeout(() => voiceStopRow.classList.add('hidden'), 180);
}

let speechQueue = [];
let speechQueueIndex = 0;
let speechStopped = false;

function splitSpeechText(text, maxChars = 220) {
  const clean = stripForSpeech(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?\n]+[.!?]+|[^.!?\n]+$/g) || [clean];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const part = sentence.trim();
    if (!part) continue;
    if ((current + ' ' + part).trim().length <= maxChars) {
      current = (current ? current + ' ' : '') + part;
    } else {
      if (current) chunks.push(current);
      if (part.length <= maxChars) current = part;
      else {
        for (let i = 0; i < part.length; i += maxChars) chunks.push(part.slice(i, i + maxChars));
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function speakNextChunk() {
  if (speechStopped || speechQueueIndex >= speechQueue.length) {
    speechQueue = [];
    speechQueueIndex = 0;
    hideStopVoiceBtn();
    return;
  }
  const utter = new SpeechSynthesisUtterance(speechQueue[speechQueueIndex++]);
  utter.onstart = showStopVoiceBtn;
  utter.onend = () => {
    if (!speechStopped) setTimeout(speakNextChunk, 0);
    else hideStopVoiceBtn();
  };
  utter.onerror = (event) => {
    console.warn('MaxNova speech synthesis error:', event?.error || 'unknown');
    if (!speechStopped) setTimeout(speakNextChunk, 0);
    else hideStopVoiceBtn();
  };
  window.speechSynthesis.speak(utter);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechStopped = false;
  window.speechSynthesis.cancel();
  speechQueue = splitSpeechText(text);
  speechQueueIndex = 0;
  if (!speechQueue.length) { hideStopVoiceBtn(); return; }
  speakNextChunk();
}

stopVoiceBtn.addEventListener('click', () => {
  // Stop every queued speech chunk. This never removes or interrupts the
  // already-completed AI text bubble.
  speechStopped = true;
  speechQueue = [];
  speechQueueIndex = 0;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  hideStopVoiceBtn();
});

// --- Voice messages (real audio recording) ---
const voiceRecordingBar = document.getElementById('voiceRecordingBar');
const voiceCancelBtn = document.getElementById('voiceCancelBtn');
const voiceFinishBtn = document.getElementById('voiceFinishBtn');
const voiceRecordingStatus = document.getElementById('voiceRecordingStatus');
const voiceRecordingTimer = document.getElementById('voiceRecordingTimer');
const voiceWaveform = document.getElementById('voiceWaveform');

let mediaRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let voiceRecordingStartedAt = 0;
let voiceTimer = null;
let voiceAnalyser = null;
let voiceAudioContext = null;
let voiceWaveFrame = null;
let isVoiceRecording = false;
let cancellingVoiceRecording = false;

function showVoiceRecordingUI() {
  if (!voiceRecordingBar) return;
  voiceRecordingBar.classList.remove('hidden');
  voiceRecordingBar.setAttribute('aria-hidden', 'false');
  document.querySelector('.chat-input-row')?.classList.add('voice-composer-hidden');
}

function hideVoiceRecordingUI() {
  if (!voiceRecordingBar) return;
  voiceRecordingBar.classList.add('hidden');
  voiceRecordingBar.setAttribute('aria-hidden', 'true');
  document.querySelector('.chat-input-row')?.classList.remove('voice-composer-hidden');
}

function formatVoiceTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateVoiceTimer() {
  if (!voiceRecordingStartedAt || !voiceRecordingTimer) return;
  voiceRecordingTimer.textContent =
    formatVoiceTime(Date.now() - voiceRecordingStartedAt);
}

function stopVoiceVisualizer() {
  if (voiceWaveFrame) {
    cancelAnimationFrame(voiceWaveFrame);
    voiceWaveFrame = null;
  }

  if (voiceAudioContext) {
    try { voiceAudioContext.close(); } catch {}
    voiceAudioContext = null;
  }

  voiceAnalyser = null;

  if (voiceWaveform) {
    voiceWaveform.querySelectorAll('i').forEach((bar) => {
      bar.style.height = '8px';
    });
  }
}

function startVoiceVisualizer(stream) {
  if (!voiceWaveform) return;

  try {
    voiceAudioContext =
      new (window.AudioContext || window.webkitAudioContext)();

    const source = voiceAudioContext.createMediaStreamSource(stream);
    voiceAnalyser = voiceAudioContext.createAnalyser();
    voiceAnalyser.fftSize = 64;
    voiceAnalyser.smoothingTimeConstant = 0.7;
    source.connect(voiceAnalyser);

    const data = new Uint8Array(voiceAnalyser.frequencyBinCount);
    const bars = [...voiceWaveform.querySelectorAll('i')];

    const animate = () => {
      if (!voiceAnalyser || !isVoiceRecording) return;

      voiceAnalyser.getByteFrequencyData(data);

      bars.forEach((bar, index) => {
        const value = data[index % data.length] || 0;
        const height = Math.max(7, Math.min(38, 7 + value * 0.32));
        bar.style.height = `${height}px`;
      });

      voiceWaveFrame = requestAnimationFrame(animate);
    };

    animate();
  } catch {
    // Recording still works even if waveform analysis is unavailable.
  }
}

function cleanupVoiceStream() {
  if (voiceStream) {
    voiceStream.getTracks().forEach((track) => {
      try { track.stop(); } catch {}
    });
    voiceStream = null;
  }
}

function resetVoiceRecordingState() {
  clearInterval(voiceTimer);
  voiceTimer = null;
  voiceRecordingStartedAt = 0;
  voiceChunks = [];
  mediaRecorder = null;
  cleanupVoiceStream();
  stopVoiceVisualizer();
  isVoiceRecording = false;
  cancellingVoiceRecording = false;
}

function getVoiceMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4'
  ];

  for (const type of types) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) {
      return type;
    }
  }

  return '';
}

async function startVoiceRecording() {
  if (isVoiceRecording) return;

  if (!navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder) {
    alert('Voice recording is not supported on this device.');
    return;
  }

  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const mimeType = getVoiceMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(voiceStream, { mimeType })
      : new MediaRecorder(voiceStream);

    voiceChunks = [];
    cancellingVoiceRecording = false;
    isVoiceRecording = true;
    voiceRecordingStartedAt = Date.now();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        voiceChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = () => {
      if (isVoiceRecording) {
        alert('Voice recording failed. Please try again.');
        cancelVoiceRecording();
      }
    };

    mediaRecorder.onstop = async () => {
      const wasCancelled = cancellingVoiceRecording;
      const chunks = voiceChunks.slice();
      const mime = mediaRecorder?.mimeType || mimeType || 'audio/webm';
      const duration = Math.max(
        0,
        Date.now() - voiceRecordingStartedAt
      );

      resetVoiceRecordingState();
      hideVoiceRecordingUI();

      if (wasCancelled || !chunks.length || duration < 300) {
        return;
      }

      const audioBlob = new Blob(chunks, { type: mime });

      await sendVoiceMessage(audioBlob, duration);
    };

    showVoiceRecordingUI();

    if (voiceRecordingStatus) {
      voiceRecordingStatus.textContent = 'Recording';
    }

    if (voiceRecordingTimer) {
      voiceRecordingTimer.textContent = '0:00';
    }

    voiceTimer = setInterval(updateVoiceTimer, 250);
    startVoiceVisualizer(voiceStream);

    mediaRecorder.start(250);
  } catch (error) {
    cleanupVoiceStream();
    resetVoiceRecordingState();

    if (error?.name === 'NotAllowedError' ||
        error?.name === 'PermissionDeniedError') {
      alert(
        'MaxNova needs microphone access for voice messages. ' +
        'Please allow microphone permission and try again.'
      );
    } else {
      alert(
        'Could not start voice recording. ' +
        (error?.message || 'Please try again.')
      );
    }
  }
}

function finishVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;

  cancellingVoiceRecording = false;

  if (voiceRecordingStatus) {
    voiceRecordingStatus.textContent = 'Sending';
  }

  try {
    mediaRecorder.stop();
  } catch {
    resetVoiceRecordingState();
    hideVoiceRecordingUI();
  }
}

function cancelVoiceRecording() {
  if (!mediaRecorder) {
    resetVoiceRecordingState();
    hideVoiceRecordingUI();
    return;
  }

  cancellingVoiceRecording = true;

  try {
    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      resetVoiceRecordingState();
      hideVoiceRecordingUI();
    }
  } catch {
    resetVoiceRecordingState();
    hideVoiceRecordingUI();
  }
}

async function sendVoiceMessage(audioBlob, duration) {
  if (!audioBlob || !audioBlob.size || sending) return;

  try {
    if (voiceRecordingStatus) {
      voiceRecordingStatus.textContent = 'Transcribing';
    }

    const extension =
      audioBlob.type.includes('mp4') ? 'm4a' :
      audioBlob.type.includes('ogg') ? 'ogg' : 'webm';

    const file = new File(
      [audioBlob],
      `maxnova-voice-${Date.now()}.${extension}`,
      { type: audioBlob.type || 'audio/webm' }
    );

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/voice-transcription`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: formData
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !String(result.text || '').trim()) {
      throw new Error(
        result?.error?.message ||
        result?.error ||
        'Voice transcription failed.'
      );
    }

    const transcript = String(result.text).trim();

    // Keep the actual recorded audio available as a voice message.
    const audioUrl = URL.createObjectURL(audioBlob);

    await sendVoiceTranscriptToAI(
      transcript,
      audioUrl,
      audioBlob.type || 'audio/webm',
      duration
    );
  } catch (error) {
    console.error('Voice message error:', error);
    alert(
      error?.message ||
      'Could not send the voice message. Please try again.'
    );
  }
}

async function sendVoiceTranscriptToAI(
  transcript,
  audioUrl,
  mime,
  duration
) {
  if (sending) return;

  sending = true;

  const userMsg = {
    role: 'user',
    content: transcript,
    timestamp: Date.now(),
    voice: {
      url: audioUrl,
      mime,
      duration
    }
  };

  messages.push(userMsg);
  saveCurrentConversation();
  renderMessages();

  try {
    const rawReply = await getAssistantReply(messages);
    const reply = String(rawReply || '').trim();

    if (!reply) return;

    messages.push({
      role: 'assistant',
      content: reply,
      timestamp: Date.now()
    });

    saveCurrentConversation();
    renderMessages();

    speak(reply);
    notifyReply(reply);
  } catch (error) {
    console.error('Voice AI reply error:', error);
    alert(
      error?.message ||
      'MaxNova could not respond to the voice message.'
    );
  } finally {
    sending = false;
    renderMessages();
  }
}

micBtn?.addEventListener('click', () => {
  if (isVoiceRecording) {
    finishVoiceRecording();
  } else {
    startVoiceRecording();
  }
});

voiceFinishBtn?.addEventListener('click', finishVoiceRecording);
voiceCancelBtn?.addEventListener('click', cancelVoiceRecording);

