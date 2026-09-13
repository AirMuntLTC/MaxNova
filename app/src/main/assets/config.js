// Paste your Supabase project values here.
// Find them in: Supabase Dashboard -> Project Settings -> API

const SUPABASE_URL = "https://funfhyitktzcuylfhoda.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_edcW3nS49nlxUK1zo7WRTQ_EtJ42-be";

// --- Groq AI config ---
// Get a key at https://console.groq.com/keys
//
// WARNING: this key will be visible to anyone who views this page's
// source code. That's fine for local/personal use, but do NOT deploy
// this app publicly with a real key sitting here — see README.md
// "Going public safely" for how to hide it behind a server function.
const GROQ_API_KEY = "";

// Pick any current Groq-hosted model. See https://console.groq.com/docs/models
const GROQ_MODEL = "openai/gpt-oss-120b";

// --- Real-time web search ---
// "groq/compound" is Groq's agentic system: it automatically decides when a
// question needs up-to-date information (news, prices, scores, "who is",
// current events, "today/latest/current", etc.) and performs a real web
// search (like Google) before answering, then folds the results into its
// reply. chat.js automatically switches to this model for plain text
// questions that look like they need current information, and falls back
// to GROQ_MODEL automatically if this model/tool call ever fails. Leave
// this blank to disable search entirely and always use GROQ_MODEL.
const GROQ_SEARCH_MODEL = "groq/compound";

// --- Vision (image understanding) ---
// When a user attaches a photo, chat.js needs a model that can actually
// "see" images to examine and respond to it — most text-only models will
// ignore or error on an image input. Set this to a current vision-capable
// model from https://console.groq.com/docs/models (look for "vision" in
// the model's capabilities). Leave it blank to fall back to GROQ_MODEL,
// which will still receive the message text but not the image itself.
const GROQ_VISION_MODEL = "qwen/qwen3.6-27b";

// --- MaxNova Image Generation (Pollinations AI) ---
// Uses the Pollinations AI image API: https://pollinations.ai
// It works with NO key at all (shared/free rate limits, easily busy). Add a
// key below for much higher (or unlimited) limits.
//
// HOW TO ADD YOUR KEY:
// 1. Go to https://enter.pollinations.ai and sign in / create an account.
//    (Note: this is the current site — older guides may say auth.pollinations.ai,
//    which has been replaced.)
// 2. Go to your Secret Keys and create/copy one — it starts with "sk_".
//    IMPORTANT: do NOT use the "App Key" (starts with "pk_"). That is only
//    a public OAuth client ID for a login-based flow — it is not a
//    generation credential and MaxNova's direct image requests will always
//    get a 403 Forbidden if you paste that one here instead.
// 3. Paste the sk_ key between the quotes below.
// 4. Save this file. No other code changes are needed — chat.js
//    automatically switches to the authenticated Pollinations endpoint and
//    sends this key with every image generation request once it's set.
//
// Security note: like the Groq key above, a key pasted here is visible to
// anyone who views this page's source. That's an accepted tradeoff for
// local/personal use, but for a public deployment with real traffic this
// should instead sit behind a small server-side proxy that adds the key,
// so it's never shipped to the browser.
const POLLINATIONS_API_KEY = ""; // <-- paste your Pollinations sk_ secret key here

// Which Pollinations image model to use. Common options: "flux" (default,
// best quality), "turbo" (faster), "flux-realism". See
// https://image.pollinations.ai/models for the current list.
const POLLINATIONS_IMAGE_MODEL = "flux";

// --- MaxNova billing ---
// The frontend must call a server/Supabase Edge Function for real payments.
// NEVER put an Xendit secret key in this file.
const BILLING_CHECKOUT_FUNCTION = `${SUPABASE_URL}/functions/v1/create-billing-checkout`;
const BILLING_STATUS_FUNCTION = `${SUPABASE_URL}/functions/v1/billing-status`;
// Display prices requested for MaxNova. GCash itself is settled in PHP by the
// payment provider, so your server should convert these USD prices to the PHP
// amount you actually charge at checkout.
const MAXNOVA_BILLING_CURRENCY = "USD";
