const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const TERMS_KEY = 'maxnova_terms_accepted_v3';
const INTRO_KEY = 'maxnova_intro_seen_v1';
const termsOverlay = document.getElementById('termsOverlay');
const termsCheckbox = document.getElementById('termsCheckbox');
const termsContinueBtn = document.getElementById('termsContinueBtn');
const termsCancelBtn = document.getElementById('termsCancelBtn');
const termsError = document.getElementById('termsError');
const emailConfirmOverlay = document.getElementById('emailConfirmOverlay');
const emailConfirmTitle = document.getElementById('emailConfirmTitle');
const emailConfirmText = document.getElementById('emailConfirmText');
const emailConfirmState = document.getElementById('emailConfirmState');
const emailConfirmClose = document.getElementById('emailConfirmClose');
const sessionLoadingOverlay = document.getElementById('sessionLoadingOverlay');
const maxnovaIntro = document.getElementById('maxnovaIntro');

const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginPanel = document.getElementById('loginPanel');
const registerPanel = document.getElementById('registerPanel');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loginBtn = document.getElementById('loginBtn');
const registerForm = document.getElementById('registerForm');
const registerError = document.getElementById('registerError');
const registerSuccess = document.getElementById('registerSuccess');
const registerBtn = document.getElementById('registerBtn');

let pendingAction = null;
let authBusy = false;
let confirmationPoll = null;
let redirecting = false;
let sessionTransitionStarted = false;

function goReplace(url) {
  if (redirecting) return;
  redirecting = true;
  window.location.replace(url);
}

function isLoginPage() {
  return /(?:^|\/)index\.html?$/i.test(window.location.pathname) || /(?:^|\/)$/i.test(window.location.pathname);
}

function isSessionLoadingActive() {
  return !!sessionLoadingOverlay && !sessionLoadingOverlay.classList.contains('hidden');
}

function clearCredentialFields() {
  ['loginEmail','loginPassword','registerEmail','registerPassword','registerConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function resetAuthButtons() {
  authBusy = false;
  loginBtn.disabled = false;
  loginBtn.textContent = 'Log in';
  registerBtn.disabled = false;
  registerBtn.textContent = 'Sign up';
}

function showLogin() {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginPanel.classList.remove('hidden');
  registerPanel.classList.add('hidden');
}

tabLogin.addEventListener('click', () => { clearCredentialFields(); showLogin(); });
tabRegister.addEventListener('click', () => {
  clearCredentialFields();
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerPanel.classList.remove('hidden');
  loginPanel.classList.add('hidden');
});

function termsAcceptedLocally() {
  return localStorage.getItem(TERMS_KEY) === '1';
}

function openTermsOverlay(onAccept) {
  pendingAction = onAccept;
  termsCheckbox.checked = false;
  termsContinueBtn.disabled = true;
  termsError.classList.add('hidden');
  termsOverlay.classList.remove('hidden');
  requestAnimationFrame(() => termsOverlay.classList.add('open'));
}

function closeTermsOverlay() {
  termsOverlay.classList.remove('open');
  setTimeout(() => termsOverlay.classList.add('hidden'), 220);
}

termsCheckbox.addEventListener('change', () => {
  termsContinueBtn.disabled = !termsCheckbox.checked;
  termsError.classList.add('hidden');
});

termsContinueBtn.addEventListener('click', async () => {
  if (!termsCheckbox.checked) {
    termsError.textContent = 'Please check the box to continue.';
    termsError.classList.remove('hidden');
    return;
  }
  localStorage.setItem(TERMS_KEY, '1');
  const action = pendingAction;
  pendingAction = null;
  closeTermsOverlay();
  if (action) await action();
});

termsCancelBtn.addEventListener('click', () => { pendingAction = null; closeTermsOverlay(); });

async function recordTermsAcceptance() {
  try {
    await supabaseClient.auth.updateUser({
      data: { terms_accepted_at: new Date().toISOString(), terms_version: '2026-09-12' }
    });
  } catch (err) { console.warn('MaxNova: could not write terms metadata', err); }
}

function showSessionLoading() {
  sessionLoadingOverlay.classList.remove('hidden');
  sessionLoadingOverlay.classList.add('active');
}

function finishSessionLoading() {
  sessionLoadingOverlay.classList.add('done');
  setTimeout(() => goReplace('chat.html'), 520);
}

async function continueAfterLogin(session) {
  if (!session?.user || sessionTransitionStarted) return;
  sessionTransitionStarted = true;
  clearCredentialFields();
  if (!termsAcceptedLocally()) {
    sessionTransitionStarted = false;
    openTermsOverlay(async () => {
      sessionTransitionStarted = true;
      await recordTermsAcceptance();
      showSessionLoading();
      setTimeout(() => goReplace('chat.html'), 900);
    });
    return;
  }
  // Do not let profile metadata or another network call block navigation.
  recordTermsAcceptance().catch(() => {});
  showSessionLoading();
  setTimeout(() => goReplace('chat.html'), 900);
}

async function performLogin() {
  if (authBusy) return;
  authBusy = true;
  loginError.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  // Never retain password after the request, whether it succeeds or fails.
  document.getElementById('loginPassword').value = '';
  if (error) {
    resetAuthButtons();
    loginError.textContent = error.message;
    loginError.classList.remove('hidden');
    return;
  }
  await continueAfterLogin(data.session);
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!loginForm.reportValidity()) return;
  performLogin();
});

function showEmailConfirmationModal(email) {
  emailConfirmTitle.textContent = 'Account successfully created';
  emailConfirmText.textContent = `A confirmation email was sent to ${email}. Open it and confirm your email address.`;
  emailConfirmState.textContent = 'Waiting for confirmation…';
  emailConfirmOverlay.classList.remove('hidden');
  requestAnimationFrame(() => emailConfirmOverlay.classList.add('open'));
  if (confirmationPoll) clearInterval(confirmationPoll);
  confirmationPoll = setInterval(checkEmailConfirmation, 2500);
}

function hideEmailConfirmationModal() {
  if (confirmationPoll) { clearInterval(confirmationPoll); confirmationPoll = null; }
  emailConfirmOverlay.classList.remove('open');
  setTimeout(() => emailConfirmOverlay.classList.add('hidden'), 220);
  clearCredentialFields();
  resetAuthButtons();
  showLogin();
}

async function checkEmailConfirmation() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();
    if (!error && data?.user?.email_confirmed_at) {
      emailConfirmState.textContent = 'Email confirmed successfully.';
      hideEmailConfirmationModal();
    }
  } catch (_) {}
}

emailConfirmClose.addEventListener('click', hideEmailConfirmationModal);

async function performRegister() {
  if (authBusy) return;
  authBusy = true;
  registerError.classList.add('hidden');
  registerSuccess.classList.add('hidden');
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;

  if (password !== confirm) {
    resetAuthButtons();
    registerError.textContent = 'Passwords do not match.';
    registerError.classList.remove('hidden');
    return;
  }
  if (password.length < 6) {
    resetAuthButtons();
    registerError.textContent = 'Password must be at least 6 characters.';
    registerError.classList.remove('hidden');
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = 'Creating account…';
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
      data: { terms_accepted_at: new Date().toISOString(), terms_version: '2026-09-12' }
    }
  });
  // Wipe password values immediately after sign-up request.
  document.getElementById('registerPassword').value = '';
  document.getElementById('registerConfirm').value = '';

  if (error) {
    resetAuthButtons();
    registerError.textContent = error.message;
    registerError.classList.remove('hidden');
    return;
  }
  if (data?.session) {
    clearCredentialFields();
    await continueAfterLogin(data.session);
    return;
  }
  resetAuthButtons();
  showEmailConfirmationModal(email);
}

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!registerForm.reportValidity()) return;
  performRegister();
});

async function getRestoredSession() {
  // Supabase can restore the persisted session asynchronously in mobile WebViews.
  // Give it a short window before treating the user as logged out.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await supabaseClient.auth.getSession();
      if (result?.data?.session) return result.data.session;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
  }
  return null;
}

async function handleInitialSession() {
  if (!localStorage.getItem(INTRO_KEY)) {
    maxnovaIntro.classList.add('show');
    setTimeout(() => {
      maxnovaIntro.classList.add('fade');
      localStorage.setItem(INTRO_KEY, '1');
      setTimeout(() => maxnovaIntro.classList.add('hidden'), 650);
    }, 1550);
  } else {
    maxnovaIntro.classList.add('hidden');
  }

  const session = await getRestoredSession();
  if (session?.user && session.user.email_confirmed_at) {
    await continueAfterLogin(session);
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  // Only SIGNED_IN can advance the login page. TOKEN_REFRESHED and
  // INITIAL_SESSION must never trigger a second navigation.
  if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at && isLoginPage()) {
    continueAfterLogin(session).catch(() => {});
  }
});

handleInitialSession().catch(err => console.warn('MaxNova auth init:', err));
