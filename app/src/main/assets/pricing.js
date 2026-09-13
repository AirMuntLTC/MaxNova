const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loadingScreen = document.getElementById('loadingScreen');
const pricingShell = document.getElementById('pricingShell');
const planTabs = document.getElementById('planTabs');
const pricingCard = document.getElementById('pricingCard');

let userId = null;
let activePlanKey = 'pro';
let billingCycle = 'monthly'; // 'monthly' | 'annual'

// --- Auth gate (same pattern as chat.js) ---
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (!session) {
    window.location.replace('index.html');
    return;
  }
  userId = session.user.id;
  activePlanKey = currentPlanKey(userId);
  history.replaceState({ maxnovaAuth: true }, '', window.location.href);
  history.pushState({ maxnovaAuth: true }, '', window.location.href);

  if (new URLSearchParams(window.location.search).get('welcome') === '1') {
    document.getElementById('welcomeBanner').classList.remove('hidden');
    document.getElementById('pricingTitle').textContent = 'Welcome! Choose a plan';
    document.getElementById('pricingBackLink').textContent = '← Continue to chat';
    document.getElementById('pricingStayLink').textContent = 'Start on Free →';
  }

  document.querySelectorAll('#planTabs button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.plan === activePlanKey);
  });

  renderCard();

  loadingScreen.classList.add('hidden');
  pricingShell.classList.remove('hidden');
});

window.addEventListener('popstate', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    history.pushState({ maxnovaAuth: true }, '', window.location.href);
  } else {
    window.location.replace('index.html');
  }
});

planTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-plan]');
  if (!btn) return;
  activePlanKey = btn.dataset.plan;
  document.querySelectorAll('#planTabs button').forEach((b) => b.classList.toggle('active', b === btn));
  renderCard();
});

function formatPrice(amount) {
  if (amount === 0) return '$0';
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function renderCard() {
  const plan = PLANS[activePlanKey];
  const savedPlan = currentPlanKey(userId);
  const isCurrent = plan.key === savedPlan;

  const priceHtml = plan.price === 0
    ? `<div class="pricing-price-row"><div class="pricing-price">Free forever</div></div>`
    : `
      <div class="pricing-price-row">
        <button class="pricing-price-option ${billingCycle === 'monthly' ? 'selected' : ''}" data-cycle="monthly">
          <span class="pricing-price">${formatPrice(plan.price)}</span>
          <span class="pricing-price-sub">Billed monthly</span>
        </button>
        <button class="pricing-price-option ${billingCycle === 'annual' ? 'selected' : ''}" data-cycle="annual">
          ${plan.priceAnnual < plan.price * 12 ? `<span class="pricing-save-badge">Save ${Math.round((1 - plan.priceAnnual / (plan.price * 12)) * 100)}%</span>` : ''}
          <span class="pricing-price">${formatPrice(plan.priceAnnual)}</span>
          <span class="pricing-price-sub">Billed annually</span>
        </button>
      </div>
    `;

  const limitLine = plan.permanent
    ? 'Unlimited AI messages — permanently, no daily cap'
    : `${plan.dailyLimit} AI messages per day`;

  pricingCard.innerHTML = `
    <div class="pricing-card-head">
      <div class="pricing-plan-name">${plan.name}</div>
      <div class="pricing-plan-tagline">${plan.tagline}</div>
    </div>
    ${priceHtml}
    <button class="primary pricing-select-btn" id="selectPlanBtn">
      ${isCurrent ? 'Current plan' : `Get ${plan.name} plan`}
    </button>
    <div class="pricing-features">
      <div class="pricing-features-head">${plan.key === 'free' ? 'Includes:' : 'Everything in the plan below, plus:'}</div>
      <ul class="pricing-features-list">
        <li class="pricing-highlight">✓ ${limitLine}</li>
        ${plan.features.map((f) => `<li>✓ ${f}</li>`).join('')}
      </ul>
    </div>
  `;

  const selectBtn = document.getElementById('selectPlanBtn');
  if (isCurrent) {
    selectBtn.disabled = true;
  } else {
    selectBtn.addEventListener('click', () => {
      window.location.href = `chat.html?openBilling=1&plan=${encodeURIComponent(plan.key)}&cycle=${encodeURIComponent(billingCycle)}`;
    });
  }

  pricingCard.querySelectorAll('.pricing-price-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      billingCycle = btn.dataset.cycle;
      renderCard();
    });
  });
}
