/* MaxNova Android billing UI.
 * Android uses the native Google Play Billing purchase sheet. There is no
 * GCash/card/Xendit checkout inside the native app.
 */
(function () {
  const modal = document.getElementById('billingModal');
  if (!modal) return;
  const plansEl = document.getElementById('billingPlans');
  const cycleEl = document.getElementById('billingCycle');
  const checkoutPanel = document.getElementById('billingCheckoutPanel');
  const orderEl = document.getElementById('billingOrder');
  const statusEl = document.getElementById('billingStatus');
  const payBtn = document.getElementById('billingPayBtn');
  let cycle = 'monthly';
  let selectedPlan = 'pro';
  let nativeBilling = false;

  function money(n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function plans() { return [PLANS.free, PLANS.pro, PLANS.max]; }
  function isNativeAndroid() { return !!window.MaxNovaNative && typeof window.MaxNovaNative.startGooglePlayBilling === 'function'; }

  function closeCompetingUI() {
    document.querySelectorAll('.fullscreen-overlay.open').forEach((el) => {
      el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
      setTimeout(() => el.classList.add('hidden'), 220);
    });
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('open');
    if (sidebar && !sidebar.classList.contains('hidden')) setTimeout(() => sidebar.classList.add('hidden'), 220);
    if (sidebarOverlay && !sidebarOverlay.classList.contains('hidden')) setTimeout(() => sidebarOverlay.classList.add('hidden'), 220);
  }

  function openBillingModal(preselect, preCycle) {
    if (preselect && PLANS[preselect]) selectedPlan = preselect;
    if (preCycle === 'monthly' || preCycle === 'annual') cycle = preCycle;
    nativeBilling = isNativeAndroid();
    closeCompetingUI();
    render();
    modal.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('open')));
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('billing-open');
  }
  function closeBillingModal() {
    modal.classList.remove('open');
    setTimeout(() => modal.classList.add('hidden'), 420);
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('billing-open');
  }
  function render() {
    cycleEl.querySelectorAll('button[data-cycle]').forEach(b => b.classList.toggle('selected', b.dataset.cycle === cycle));
    plansEl.innerHTML = plans().map((p) => {
      const price = cycle === 'annual' ? p.priceAnnual : p.price;
      return `<button type="button" class="billing-plan ${p.key === selectedPlan ? 'selected' : ''}" data-plan="${p.key}">
        ${p.key === 'pro' ? '<span class="billing-plan-badge">POPULAR</span>' : ''}
        <div class="billing-plan-name">${p.name}</div>
        <div class="billing-plan-price">${p.key === 'free' ? '$0' : money(price)} <small>${p.key === 'free' ? '' : '/ ' + (cycle === 'annual' ? 'yr' : 'mo')}</small></div>
        <div class="billing-plan-desc">${p.tagline}</div>
      </button>`;
    }).join('');
    plansEl.querySelectorAll('[data-plan]').forEach(b => b.addEventListener('click', () => {
      selectedPlan = b.dataset.plan;
      render();
    }));
    checkoutPanel.classList.toggle('hidden', selectedPlan === 'free');
    updateOrder();
  }
  function updateOrder() {
    const p = PLANS[selectedPlan];
    if (!p || p.key === 'free') { orderEl.textContent = ''; statusEl.textContent = ''; return; }
    const usd = cycle === 'annual' ? p.priceAnnual : p.price;
    orderEl.innerHTML = `<b>${p.name}</b> · ${money(usd)} / ${cycle === 'annual' ? 'year' : 'month'} · Google Play subscription`;
    payBtn.textContent = nativeBilling ? `Continue with Google Play` : `Open MaxNova Android app to subscribe`;
    statusEl.textContent = nativeBilling ? 'Google Play securely handles the purchase, payment method, and subscription.' : 'Paid MaxNova subscriptions are purchased through the native Android app using Google Play Billing.';
  }
  cycleEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cycle]'); if (!b) return;
    cycle = b.dataset.cycle; render();
  });
  modal.addEventListener('click', (e) => { if (e.target.matches('[data-billing-close]')) closeBillingModal(); });
  document.getElementById('billingCloseBtn')?.addEventListener('click', closeBillingModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeBillingModal(); });

  payBtn.addEventListener('click', () => {
    if (!selectedPlan || selectedPlan === 'free') return;
    if (!isNativeAndroid()) {
      statusEl.textContent = 'Google Play Billing is available in the MaxNova Android app. No GCash/card web checkout is used.';
      return;
    }
    try {
      payBtn.disabled = true;
      statusEl.textContent = 'Opening Google Play…';
      window.MaxNovaNative.startGooglePlayBilling(selectedPlan, cycle);
    } catch (e) {
      payBtn.disabled = false;
      statusEl.textContent = 'Google Play could not be opened. Please try again.';
      console.error('MaxNova Google Play billing:', e);
    }
  });

  window.maxNovaNativeBillingEvent = function (event, ok, message) {
    if (event === 'billingSuccess') {
      const plan = message || selectedPlan;
      statusEl.textContent = `${String(plan).replace(/^./, c => c.toUpperCase())} is active. Welcome to MaxNova!`;
      payBtn.disabled = false;
      setTimeout(() => closeBillingModal(), 850);
      if (window.maxNovaSyncBillingPlan && window.__maxNovaUserId) {
        window.maxNovaSyncBillingPlan(window.__maxNovaUserId).then(() => window.renderPlanUI?.()).catch(() => {});
      }
      return;
    }
    if (event === 'billingPending') {
      statusEl.textContent = message || 'Google Play payment is pending.'; payBtn.disabled = false; return;
    }
    if (event === 'billingCancelled') {
      statusEl.textContent = 'Purchase cancelled.'; payBtn.disabled = false; return;
    }
    if (event === 'billingProcessing') { statusEl.textContent = message || 'Verifying Google Play purchase…'; return; }
    if (event === 'billingError') { statusEl.textContent = message || 'Google Play billing could not complete.'; payBtn.disabled = false; }
  };

  window.openBillingModal = openBillingModal;
  window.closeBillingModal = closeBillingModal;
  window.maxNovaSyncBillingPlan = async function (uid) {
    if (!uid) return null;
    try {
      if (supabaseClient?.functions) {
        const { data, error } = await supabaseClient.functions.invoke('billing-status', { body: {} });
        if (!error && data?.plan_key) {
          if (PLANS[data.plan_key]) setPlan(uid, data.plan_key);
          return data;
        }
      }
    } catch (_) {}
    try {
      const { data, error } = await supabaseClient.from('maxnova_subscriptions')
        .select('plan_key,status,current_period_end,provider').eq('user_id', uid).eq('status','active')
        .order('current_period_end',{ascending:false}).limit(1).maybeSingle();
      if (!error) {
        const key = data && PLANS[data.plan_key] ? data.plan_key : 'free';
        setPlan(uid, key); return data || { plan_key:'free', status:'inactive' };
      }
    } catch (_) {}
    return null;
  };
})();
