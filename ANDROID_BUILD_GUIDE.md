# Walk Nepal Walk — Android Build & SDK Upgrade Guide

This guide describes how to configure your Android build target to **API Level 34 (Android 14)** or **API Level 35 (Android 15)**. This satisfies Google Play Protect requirements and removes the *"Unsafe app blocked"* warning during installation.

---

## 1. Local Configuration (Capacitor)
If you have initialized **Capacitor** inside your project folder, the `/android` directory has been generated on your machine. 

To apply the configuration:
1. Open `android/variables.gradle`.
2. Ensure the contents match this updated configuration:
   ```groovy
   ext {
       minSdkVersion = 22
       compileSdkVersion = 34
       targetSdkVersion = 34
   }
   ```
3. Run the following commands in your terminal to sync and recompile the project:
   ```bash
   npm run build
   npx cap sync android
   ```

---

## 2. Using Web-to-APK Custom Portals
If you are generating your APK via an online web-to-app conversion platform (such as *WebintoApp*, *Median*, or *AppMySite*):
1. Navigate to your app's **Build Configuration** or **Developer Settings** page in their panel.
2. Search for **Target SDK Version**.
3. Select **Android 14 (API level 34)** or **Android 15 (API level 35)**.
4. Re-compile and download your brand-new `.apk` file.
