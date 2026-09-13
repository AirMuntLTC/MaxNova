// --- MaxNova plan definitions ---
// Edit limits/prices here — both chat.js and pricing.html read from this file.
//
// Prices are display prices in USD. Paid subscriptions are still handled by the
// existing billing system. The custom admin panel uses a database-backed administrator override cached locally for fast reads.

const PLANS = {
  free: {
    key: 'free',
    name: 'Free',
    tagline: 'Try it out',
    price: 0,
    priceAnnual: 0,
    dailyLimit: 15, // messages per day
    permanent: false,
    features: [
      'Everyday questions and quick chats',
      '15 AI messages per day',
      'Voice input & output',
      'Conversation history on this device',
    ],
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    tagline: 'A lot more room to work',
    price: 5,
    priceAnnual: 139,
    dailyLimit: 300, // messages per day
    permanent: false,
    features: [
      'Everything in Free',
      '300 AI messages per day',
      'Priority replies during busy times',
      'Longer conversation memory',
    ],
  },
  max: {
    key: 'max',
    name: 'Max',
    tagline: 'No limits, ever',
    price: 62,
    priceAnnual: 326,
    dailyLimit: Infinity, // no cap — never resets/blocks
    permanent: true,
    features: [
      'Everything in Pro',
      'Unlimited AI messages — permanently, no daily cap',
      'Highest priority replies',
      'Early access to new features',
    ],
  },
};

const PLAN_ORDER = ['free', 'pro', 'max'];

// Keep plan helpers in this file because chat.js, billing.js and pricing.js
// all load this script before they execute. These functions must always exist
// in the native WebView build as well as the local preview.
function currentPlanKey(userId) {
  if (!userId) return 'free';
  // A database-admin entitlement is cached separately so normal paid-plan
  // state and administrator overrides never collide.
  try {
    const adminKey = localStorage.getItem(`maxnova_admin_plan_${userId}`);
    if (PLANS[adminKey]) return adminKey;
  } catch (_) {}
  try {
    const stored = localStorage.getItem(`ai_assistant_plan_${userId}`);
    return PLANS[stored] ? stored : 'free';
  } catch (_) {
    return 'free';
  }
}

function setPlan(userId, planKey) {
  if (!userId || !PLANS[planKey]) return false;
  try {
    localStorage.setItem(`ai_assistant_plan_${userId}`, planKey);
    return true;
  } catch (_) {
    return false;
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, local-ish
}

function getUsage(userId) {
  try {
    const raw = localStorage.getItem(`ai_assistant_usage_${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || parsed.date !== todayString()) {
      return { date: todayString(), count: 0 };
    }
    return parsed;
  } catch {
    return { date: todayString(), count: 0 };
  }
}

function saveUsage(userId, usage) {
  localStorage.setItem(`ai_assistant_usage_${userId}`, JSON.stringify(usage));
}

// Returns { allowed, remaining, limit, plan }
function checkUsage(userId) {
  const planKey = currentPlanKey(userId);
  const plan = PLANS[planKey];
  const usage = getUsage(userId);
  const limit = plan.dailyLimit;
  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - usage.count);
  return { allowed: remaining > 0, remaining, limit, plan };
}

// Call after a message successfully gets an AI reply
function recordUsage(userId) {
  const usage = getUsage(userId);
  usage.count += 1;
  saveUsage(userId, usage);
}
