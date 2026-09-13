package com.maxnova.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.DownloadManager;
import android.app.AppWidgetManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Toast;
import android.util.Base64;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private android.webkit.PermissionRequest pendingAudioPermissionRequest;
    private String pendingNotificationBody;
    private static final int FILE_REQUEST = 901;
    private static final int MIC_REQUEST = 902;
    private static final int NOTIFICATION_REQUEST = 903;
    private static final String NOTIFICATION_CHANNEL = "maxnova_replies";
    private TextToSpeech textToSpeech;
    private BillingClient billingClient;
    private final Map<String, ProductDetails> productCache = new HashMap<>();
    private String billingAccessToken = null;
    private String billingUserId = null;
    private Purchase currentSubscriptionPurchase = null;

    private static final String SUPABASE_URL = "https://funfhyitktzcuylfhoda.supabase.co";
    private static final String VERIFY_ENDPOINT = SUPABASE_URL + "/functions/v1/google-play-verify";

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        createNotificationChannel();
        requestStartupPermissions();
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Keep the WebView behaving like a native app: disable Android/WebView
        // form-autofill and saved form data that can trigger Google suggestions.
        if (Build.VERSION.SDK_INT >= 26) {
            webView.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        }
        try { s.setSaveFormData(false); } catch (Throwable ignored) {}
        CookieManager.getInstance().setAcceptCookie(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null || url.isEmpty()) return false;
                // Keep MaxNova's own local pages inside this WebView. Network
                // API calls are still allowed; user-facing navigation is not
                // handed to Chrome.
                if (url.startsWith("file:///android_asset/") || url.startsWith("https://funfhyitktzcuylfhoda.supabase.co/")) return false;
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            // The in-page mic button uses the Web Speech API (SpeechRecognition),
            // which — even once RECORD_AUDIO is granted at the Android level —
            // still needs the WebView itself to grant the page's getUserMedia
            // permission request before the microphone will actually work.
            // Without this override the mic silently fails every time.
            @Override public void onPermissionRequest(android.webkit.PermissionRequest request) {
                if (request == null) return;
                runOnUiThread(() -> {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        pendingAudioPermissionRequest = request;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
                        return;
                    }
                    grantAudioPermission(request);
                });
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] accepts = params != null ? params.getAcceptTypes() : null;
                String mime = "*/*";
                if (accepts != null) {
                    for (String a : accepts) {
                        if (a != null && !a.trim().isEmpty()) { mime = a; break; }
                    }
                }
                if (mime.contains("image") || mime.contains("video") || mime.equals("*/*")) i.setType(mime);
                else i.setType(mime);
                boolean multiple = params != null && params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
                i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
                try { startActivityForResult(i, FILE_REQUEST); } catch (Exception e) {
                    fileCallback.onReceiveValue(null); fileCallback = null;
                    Toast.makeText(MainActivity.this, "No native file picker is available.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> downloadUrlNative(url, userAgent, contentDisposition, mimeType));
        webView.addJavascriptInterface(new NativeBridge(), "MaxNovaNative");
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) textToSpeech.setLanguage(Locale.US);
        });
        initBilling();
        openForIntent(getIntent());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(NOTIFICATION_CHANNEL, "MaxNova replies", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Notifications when MaxNova finishes an AI response");
            channel.enableVibration(true);
            channel.setShowBadge(true);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    /** Request mic + notification permissions together on first launch. */
    private void requestStartupPermissions() {
        java.util.ArrayList<String> needed = new java.util.ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!needed.isEmpty()) {
            requestPermissions(needed.toArray(new String[0]), MIC_REQUEST);
        }
    }

    private void grantAudioPermission(android.webkit.PermissionRequest request) {
        if (request == null) return;
        try {
            java.util.List<String> granted = new ArrayList<>();
            for (String resource : request.getResources()) {
                if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                    granted.add(resource);
                }
            }
            if (!granted.isEmpty()) {
                request.grant(granted.toArray(new String[0]));
            } else {
                request.deny();
            }
        } catch (Throwable ignored) {
            try { request.deny(); } catch (Throwable ignored2) {}
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST);
        }
    }

    private void requestMicPermission() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (permissions == null || grantResults == null) return;
        for (int i = 0; i < permissions.length; i++) {
            String perm = permissions[i];
            boolean granted = i < grantResults.length && grantResults[i] == PackageManager.PERMISSION_GRANTED;
            if (Manifest.permission.POST_NOTIFICATIONS.equals(perm)) {
                if (granted) {
                    Toast.makeText(this, "Notifications enabled", Toast.LENGTH_SHORT).show();
                    if (pendingNotificationBody != null) {
                        String pending = pendingNotificationBody;
                        pendingNotificationBody = null;
                        postReplyNotification(pending);
                    }
                } else {
                    Toast.makeText(this, "Notifications blocked. Enable them in system Settings → Apps → MaxNova.", Toast.LENGTH_LONG).show();
                    pendingNotificationBody = null;
                }
            } else if (Manifest.permission.RECORD_AUDIO.equals(perm)) {
                if (granted) {
                    Toast.makeText(this, "Microphone enabled", Toast.LENGTH_SHORT).show();
                    if (pendingAudioPermissionRequest != null) {
                        android.webkit.PermissionRequest pending = pendingAudioPermissionRequest;
                        pendingAudioPermissionRequest = null;
                        grantAudioPermission(pending);
                    }
                } else {
                    Toast.makeText(this, "Microphone blocked. Voice features need mic permission in Settings.", Toast.LENGTH_LONG).show();
                    if (pendingAudioPermissionRequest != null) {
                        android.webkit.PermissionRequest pending = pendingAudioPermissionRequest;
                        pendingAudioPermissionRequest = null;
                        try { pending.deny(); } catch (Throwable ignored) {}
                    }
                }
            }
        }
    }
    private void downloadUrlNative(String url, String userAgent, String contentDisposition, String mimeType) {
        try {
            DownloadManager dm = (DownloadManager)getSystemService(DOWNLOAD_SERVICE);
            if (dm == null) throw new Exception("Download service unavailable");
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setMimeType(mimeType == null ? "application/octet-stream" : mimeType);
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setTitle("MaxNova download");
            r.setDescription("Saving file to Downloads");
            if (userAgent != null) r.addRequestHeader("User-Agent", userAgent);
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            if (name != null && !name.trim().isEmpty()) r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            dm.enqueue(r);
        } catch (Exception e) { Toast.makeText(this, "Could not start native download.", Toast.LENGTH_LONG).show(); }
    }
    private boolean saveBase64File(String base64, String name, String mime) {
        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            String safe = (name == null || name.trim().isEmpty()) ? "maxnova-download.bin" : new File(name).getName();
            if (Build.VERSION.SDK_INT >= 29) {
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, safe);
                values.put(android.provider.MediaStore.Downloads.MIME_TYPE, mime == null ? "application/octet-stream" : mime);
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return false;
                try (OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(data); }
                values.clear(); values.put(android.provider.MediaStore.Downloads.IS_PENDING, 0); getContentResolver().update(uri, values, null, null);
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) { requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 904); return false; }
                File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS); if (!dir.exists()) dir.mkdirs();
                try (OutputStream out = new FileOutputStream(new File(dir, safe))) { out.write(data); }
            }
            Toast.makeText(this, "Saved to Downloads: " + safe, Toast.LENGTH_SHORT).show(); return true;
        } catch (Exception e) { Toast.makeText(this, "Could not save file to Downloads.", Toast.LENGTH_LONG).show(); return false; }
    }

    private void initBilling() {
        billingClient = BillingClient.newBuilder(this)
                .setListener(this::onPurchasesUpdated)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        connectBilling();
    }

    private void connectBilling() {
        if (billingClient == null || billingClient.isReady()) return;
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    queryProducts();
                    restorePurchases();
                    notifyJs("billingReady", true, "");
                } else {
                    notifyJs("billingError", false, result.getDebugMessage());
                }
            }
            @Override public void onBillingServiceDisconnected() { notifyJs("billingReady", false, "Google Play is temporarily unavailable."); }
        });
    }

    private void queryProducts() {
        if (billingClient == null || !billingClient.isReady()) return;
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : Arrays.asList("maxnova_pro", "maxnova_max")) {
            products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.SUBS).build());
        }
        billingClient.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (result, detailsResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || detailsResult == null) return;
            productCache.clear();
            for (ProductDetails d : detailsResult.getProductDetailsList()) productCache.put(d.getProductId(), d);
            notifyJs("billingProductsReady", true, "");
        });
    }

    private void restorePurchases() {
        if (billingClient == null || !billingClient.isReady()) return;
        billingClient.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
                (result, purchases) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) return;
                    for (Purchase p : purchases) processPurchase(p);
                });
    }

    private void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) processPurchase(p);
            return;
        }
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            notifyJs("billingCancelled", true, "Purchase cancelled.");
        } else {
            notifyJs("billingError", false, result.getDebugMessage());
        }
    }

    private void processPurchase(Purchase purchase) {
        if (purchase == null) return;
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            notifyJs("billingPending", true, "Google Play payment is pending. Your plan will activate after Google confirms the purchase.");
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        currentSubscriptionPurchase = purchase;
        if (billingAccessToken == null || billingAccessToken.isEmpty()) {
            notifyJs("billingError", false, "Please sign in again so MaxNova can verify your Google Play purchase.");
            return;
        }
        String plan = inferPlan(purchase);
        if (plan == null) {
            notifyJs("billingError", false, "Unknown MaxNova Google Play subscription.");
            return;
        }
        notifyJs("billingProcessing", true, "Verifying your Google Play purchase…");
        new Thread(() -> verifyPurchaseOnServer(purchase, plan)).start();
    }

    private String inferPlan(Purchase purchase) {
        for (String id : purchase.getProducts()) {
            if ("maxnova_pro".equals(id)) return "pro";
            if ("maxnova_max".equals(id)) return "max";
        }
        return null;
    }

    private void verifyPurchaseOnServer(Purchase purchase, String plan) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(VERIFY_ENDPOINT);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + billingAccessToken);
            JSONObject body = new JSONObject();
            body.put("purchaseToken", purchase.getPurchaseToken());
            body.put("productId", purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0));
            body.put("planKey", plan);
            body.put("packageName", getPackageName());
            OutputStream os = conn.getOutputStream();
            os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            os.close();
            int code = conn.getResponseCode();
            String response = readBody(code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream());
            if (code < 200 || code >= 300) throw new Exception(response);
            JSONObject json = new JSONObject(response);
            boolean active = json.optBoolean("active", false);
            if (!active) throw new Exception(json.optString("message", "Google Play did not confirm an active subscription."));
            if (!purchase.isAcknowledged()) acknowledgePurchase(purchase);
            final String resultPlan = json.optString("plan_key", plan);
            runOnUiThread(() -> notifyJs("billingSuccess", true, resultPlan));
        } catch (Exception e) {
            final String message = e.getMessage() == null ? "Purchase verification failed." : e.getMessage();
            runOnUiThread(() -> notifyJs("billingError", false, message));
        } finally { if (conn != null) conn.disconnect(); }
    }

    private void acknowledgePurchase(Purchase purchase) {
        if (billingClient == null || purchase.isAcknowledged()) return;
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build();
        billingClient.acknowledgePurchase(params, result -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                notifyJs("billingError", false, "Purchase was verified, but Google Play acknowledgement failed. Please reopen MaxNova while online.");
            }
        });
    }

    private void notifyJs(String event, boolean ok, String message) {
        if (webView == null) return;
        String e = JSONObject.quote(event);
        String m = JSONObject.quote(message == null ? "" : message);
        runOnUiThread(() -> webView.evaluateJavascript("window.maxNovaNativeBillingEvent && window.maxNovaNativeBillingEvent(" + e + "," + ok + "," + m + ");", null));
    }

    private static String readBody(InputStream in) throws Exception {
        if (in == null) return "";
        BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        StringBuilder b = new StringBuilder(); String line;
        while ((line = r.readLine()) != null) b.append(line);
        r.close(); return b.toString();
    }

    private void launchSubscription(String plan, String cycle) {
        if ("free".equals(plan)) return;
        if (billingClient == null || !billingClient.isReady()) { connectBilling(); notifyJs("billingError", false, "Google Play Billing is still connecting. Please try again."); return; }
        ProductDetails d = productCache.get("pro".equals(plan) ? "maxnova_pro" : "maxnova_max");
        if (d == null) { queryProducts(); notifyJs("billingError", false, "This MaxNova subscription is not available in Google Play yet. Check your Play Console product/base-plan setup."); return; }
        List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) { notifyJs("billingError", false, "No Google Play base plan is available for this subscription."); return; }
        ProductDetails.SubscriptionOfferDetails chosen = null;
        String wantedBase = plan + "_" + ("annual".equals(cycle) ? "annual" : "monthly");
        for (ProductDetails.SubscriptionOfferDetails o : offers) {
            if (wantedBase.equals(o.getBasePlanId())) { chosen = o; break; }
        }
        if (chosen == null) chosen = offers.get(0);
        BillingFlowParams.ProductDetailsParams.Builder productBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(d).setOfferToken(chosen.getOfferToken());
        BillingFlowParams.Builder flow = BillingFlowParams.newBuilder();
        if (currentSubscriptionPurchase != null && !currentSubscriptionPurchase.getProducts().isEmpty()) {
            int mode = "max".equals(plan)
                    ? BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE
                    : BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.DEFERRED;

            BillingFlowParams.SubscriptionUpdateParams replacement =
                    BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                            .setOldPurchaseToken(currentSubscriptionPurchase.getPurchaseToken())
                            .setSubscriptionReplacementMode(mode)
                            .build();

            flow.setSubscriptionUpdateParams(replacement);
        }
        flow.setProductDetailsParamsList(Collections.singletonList(productBuilder.build()));
        if (billingUserId != null) flow.setObfuscatedAccountId(hashAccountId(billingUserId));
        BillingResult result = billingClient.launchBillingFlow(this, flow.build());
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) notifyJs("billingError", false, result.getDebugMessage());
    }

    private String hashAccountId(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.encodeToString(out, Base64.NO_WRAP | Base64.URL_SAFE).substring(0, 64);
        } catch (Exception e) { return value.replaceAll("[^A-Za-z0-9_-]", "").substring(0, Math.min(64, value.length())); }
    }

    private void openForIntent(Intent intent) {
        String action = intent != null ? intent.getStringExtra("nativeAction") : null;

        if (action == null && intent != null) {
            Uri data = intent.getData();
            if (data != null && "maxnova".equals(data.getScheme())) {
                action = data.getHost();
            }
        }

        if ("voice".equals(action)
                && android.os.Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                    != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.RECORD_AUDIO},
                    MIC_REQUEST);
        }

        String suffix = action == null
                ? ""
                : "?nativeAction=" + Uri.encode(action);

        webView.loadUrl(
                "file:///android_asset/chat.html" + suffix);
    }

    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); openForIntent(intent); }

    @Override protected void onResume() { super.onResume(); if (billingClient != null && billingClient.isReady()) restorePurchases(); }

    @Override protected void onDestroy() {
        if (textToSpeech != null) { textToSpeech.stop(); textToSpeech.shutdown(); textToSpeech = null; }
        if (billingClient != null) { billingClient.endConnection(); billingClient = null; }
        super.onDestroy();
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_REQUEST && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n=data.getClipData().getItemCount(); result=new Uri[n]; for(int i=0;i<n;i++) result[i]=data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) result=new Uri[]{data.getData()};
            }
            if(fileCallback!=null) fileCallback.onReceiveValue(result); fileCallback = null;
        }
    }

    public class NativeBridge {
        @android.webkit.JavascriptInterface public void notifyReply(String text) {
        runOnUiThread(() -> {
            String body = text == null ? "" : text;
            if (body.length() > 180) body = body.substring(0, 177) + "…";

            if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                pendingNotificationBody = body;
                requestNotificationPermission();
                return;
            }

            postReplyNotification(body);
        });
    }

    private void postReplyNotification(String text) {
        try {
            String body = text == null ? "" : text;
            if (body.length() > 180) body = body.substring(0, 177) + "…";

            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(MainActivity.this, NOTIFICATION_CHANNEL)
                : new Notification.Builder(MainActivity.this);

            Intent open = new Intent(MainActivity.this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            android.app.PendingIntent pi = android.app.PendingIntent.getActivity(
                MainActivity.this, 501, open,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT |
                android.app.PendingIntent.FLAG_IMMUTABLE);

            b.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("MaxNova replied")
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setPriority(Notification.PRIORITY_HIGH);

            if (Build.VERSION.SDK_INT >= 26) {
                b.setChannelId(NOTIFICATION_CHANNEL);
            }

            NotificationManager nm =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

            if (nm != null) {
                nm.notify((int) (System.currentTimeMillis() % 100000), b.build());
            }
        } catch (Exception ignored) {
            // Never crash the WebView because of a notification failure.
        }
    }

    @android.webkit.JavascriptInterface public boolean hasNotificationPermission() {
            if (Build.VERSION.SDK_INT < 33) return true;
            return checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }

        /** Trigger the system notification permission dialog from JS. */
        @android.webkit.JavascriptInterface public void requestNotificationPermissionFromJs() {
            runOnUiThread(() -> requestNotificationPermission());
        }
        @android.webkit.JavascriptInterface public boolean saveFileBase64(String base64, String name, String mime) { return saveBase64File(base64, name, mime); }
        @android.webkit.JavascriptInterface public boolean speakVoice(String text, String gender, float rate, float pitch) {
            if (textToSpeech == null) return false;
            try {
                textToSpeech.setLanguage(Locale.US); Voice chosen = chooseGenderVoice(gender); if (chosen != null) textToSpeech.setVoice(chosen);
                textToSpeech.setSpeechRate(Math.max(.55f, Math.min(1.45f, rate))); textToSpeech.setPitch(Math.max(.55f, Math.min(1.45f, pitch)));
                textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "maxnova-voice"); return true;
            } catch (Exception e) { return false; }
        }
        private Voice chooseGenderVoice(String gender) {
            if (textToSpeech == null || textToSpeech.getVoices() == null) return null;
            String wanted = gender == null ? "" : gender.toLowerCase(Locale.US); Voice best = null;
            for (Voice v : textToSpeech.getVoices()) {
                if (v == null || v.getLocale() == null || !v.getLocale().getLanguage().equals("en")) continue;
                String n = ((v.getName() == null ? "" : v.getName()) + " " + v.toString()).toLowerCase(Locale.US);
                boolean female = n.matches(".*(female|woman|girl|samantha|zira|ava|karen|moira|fiona|susan|tessa|victoria|allison|veena|kate|#female_|-female|sfg#female|tpf|fis).*");
                boolean male = n.matches(".*(#male_|-male|\\bmale\\b|\\bman\\b|\\bboy\\b|daniel|david|alex|fred|jorge|rishi|aaron|bruce|tom|thomas|liam|lee|sfb|sfc|tpd|gbc|aua).*");
                if (("girl".equals(wanted) && female) || ("boy".equals(wanted) && male)) if (best == null || (v.getLocale().equals(Locale.US) && !best.getLocale().equals(Locale.US))) best = v;
            }
            return best;
        }
        @android.webkit.JavascriptInterface public void setBillingAuth(String userId, String accessToken) {
            billingUserId = userId; billingAccessToken = accessToken;
            if (billingClient != null && billingClient.isReady()) restorePurchases();
        }
        @android.webkit.JavascriptInterface public boolean isGooglePlayBillingAvailable() { return billingClient != null && billingClient.isReady(); }
        @android.webkit.JavascriptInterface public void startGooglePlayBilling(String plan, String cycle) { runOnUiThread(() -> launchSubscription(plan, cycle)); }
        @android.webkit.JavascriptInterface public void restoreGooglePlayPurchases() { runOnUiThread(() -> restorePurchases()); }
        @android.webkit.JavascriptInterface public boolean setWidgetEnabled(boolean enabled) {
            if (!enabled) {
                // Android does not allow apps to remove their own widgets.
                // Turning the switch off only updates the in-app preference.
                return true;
            }
            try {
                AppWidgetManager mgr = AppWidgetManager.getInstance(MainActivity.this);
                if (mgr == null) {
                    Toast.makeText(MainActivity.this, "Widget manager unavailable.", Toast.LENGTH_LONG).show();
                    return false;
                }
                if (!mgr.isRequestPinAppWidgetSupported()) {
                    Toast.makeText(MainActivity.this,
                            "Long-press your home screen → Widgets → MaxNova to add the widget.",
                            Toast.LENGTH_LONG).show();
                    return true;
                }
                ComponentName provider = new ComponentName(MainActivity.this, MaxNovaWidgetProvider.class);
                Intent callback = new Intent(MainActivity.this, MainActivity.class);
                PendingIntentCompat.requestPin(MainActivity.this, mgr, provider, callback);
                return true;
            } catch (Exception e) {
                Toast.makeText(MainActivity.this,
                        "Could not pin widget. Add MaxNova from the home-screen widget picker.",
                        Toast.LENGTH_LONG).show();
                return false;
            }
        }
    }

    private static class PendingIntentCompat {
        static void requestPin(Activity a, AppWidgetManager mgr, ComponentName provider, Intent callback) {
            android.app.PendingIntent pi = android.app.PendingIntent.getActivity(a, 77, callback, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE); mgr.requestPinAppWidget(provider, null, pi);
        }
    }
    @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
}
