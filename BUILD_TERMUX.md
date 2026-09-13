# Build MaxNova Native App (Termux + Android)

## What was fixed in this version

1. **Notification permission**
   - Requests `POST_NOTIFICATIONS` + mic together on first launch
   - Proper `onRequestPermissionsResult` with toasts
   - Stronger notification channel (HIGH importance + vibration)
   - JS Settings screen now detects native app and calls native permission dialog
   - `notifyReply` is more robust (BigText style, safe truncation)

2. **Home-screen Widget**
   - Added missing `android:initialLayout` (required for many launchers)
   - Better pin-widget error messages
   - Manifest receiver cleaned up

3. **General**
   - Activity uses `singleTop` + `configChanges` so widget deep-links and rotation work
   - Version bumped to 1.0.1 (versionCode 2)

---

## Recommended way to build (easiest)

Building a full Android APK **inside pure Termux** is possible but heavy (needs OpenJDK + Android SDK + Gradle).  
The most reliable path for most people:

### Option A – Android Studio (recommended)

1. Unzip this project on a PC/Mac.
2. Open the folder `native-android` in Android Studio (File → Open).
3. Let it download the Gradle wrapper and SDK if asked.
4. Connect your phone with USB debugging ON, or use an emulator.
5. Click **Run** (green triangle) or **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
6. Install the generated APK on your phone.

### Option B – Termux (advanced)

You need a lot of free space (~3–6 GB) and a good connection.

```bash
# 1. Install packages
pkg update -y
pkg install openjdk-17 wget unzip git -y

# 2. Install Android command-line tools (example)
mkdir -p $HOME/android-sdk/cmdline-tools
cd $HOME/android-sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-*.zip
mv cmdline-tools latest

# 3. Set environment
export ANDROID_HOME=$HOME/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# 4. Accept licenses and install platform
yes | sdkmanager --licenses
sdkmanager "platforms;android-35" "build-tools;35.0.0" "platform-tools"

# 5. Go to the project
cd /path/to/MaxNova/native-android

# 6. Generate Gradle wrapper if missing (or copy from another project)
# Then build:
./gradlew assembleDebug
```

The APK will appear at:
`app/build/outputs/apk/debug/app-debug.apk`

Install it with:
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
# or copy the APK to your phone and open it
```

---

## After installing the APK – how to use permissions

### Notifications
1. Open MaxNova for the first time.
2. Android will show the system dialog for **Microphone** and **Notifications**.
3. Tap **Allow**.
4. When the AI finishes a reply you will see a system notification “MaxNova replied”.
5. You can also open the in-app Notifications screen → “Enable notifications” (it now talks to the native code).

If you denied earlier:
- Phone Settings → Apps → MaxNova → Notifications → Allow
- or Settings → Apps → MaxNova → Permissions

### Home-screen Widget
1. Inside the app, turn **ON** the “Native Widget” switch (or long-press home screen).
2. If the system pin dialog appears → tap **Add**.
3. If it does not appear: long-press empty space on home screen → Widgets → find **MaxNova** → drag it out.
4. The three buttons open Chat / Media / Voice modes directly.

### Microphone
- Granted at first launch.
- The in-chat mic button and the widget Voice button both need it.
- WebView also receives the `getUserMedia` grant via `onPermissionRequest`.

---

## Quick test checklist

- [ ] Fresh install → accept both permission dialogs
- [ ] Send a chat message that gets a reply → system notification appears
- [ ] Turn Native Widget switch ON → widget appears (or can be added from picker)
- [ ] Tap widget Chat / Media / Voice buttons → app opens in the right mode
- [ ] Tap mic inside chat → speech recognition works
