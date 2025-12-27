# Android App Signing Guide

This guide explains how to set up Android app signing for the IrisClassifier application.

## Overview

Android requires all apps to be digitally signed with a certificate before they can be installed. You need two types of signing:

- **Debug signing**: Automatically handled by Android Studio (for development)
- **Release signing**: Required for production builds (Play Store distribution)

## Generating a Release Keystore

### Step 1: Generate the Keystore

Use the Java `keytool` command to generate a new keystore:

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- Keystore password (remember this!)
- Key password (can be the same as keystore password)
- Your name, organization, location details

**Important**: Store the keystore file and passwords securely! If you lose them, you cannot update your app on the Play Store.

### Step 2: Move the Keystore

Move the generated keystore file to a secure location:

```bash
# Store in the android directory
mv my-release-key.keystore frontend/android/
```

### Step 3: Create keystore.properties

Create a file `frontend/android/keystore.properties` with your signing configuration:

```properties
storeFile=my-release-key.keystore
storePassword=your_keystore_password
keyAlias=my-key-alias
keyPassword=your_key_password
```

**Note**: This file is gitignored and should NEVER be committed to version control!

### Step 4: Configure build.gradle

Add this configuration to `android/app/build.gradle`:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

## Building a Signed APK

### Using Capacitor CLI

```bash
# Build the web assets
cd frontend
pnpm build

# Sync with Android
npx cap sync android

# Open in Android Studio to build signed APK
npx cap open android
```

Then in Android Studio:
1. Go to **Build > Generate Signed Bundle / APK**
2. Select **APK**
3. Choose your keystore file
4. Enter passwords
5. Select **release** build variant
6. Click **Finish**

### Using Gradle Command Line

```bash
cd frontend/android
./gradlew assembleRelease
```

The signed APK will be at: `frontend/android/app/build/outputs/apk/release/app-release.apk`

## Building an Android App Bundle (AAB)

For Play Store distribution, use Android App Bundle format:

```bash
cd frontend/android
./gradlew bundleRelease
```

The AAB file will be at: `frontend/android/app/build/outputs/bundle/release/app-release.aab`

## Security Best Practices

1. **Never commit keystore files or passwords** to version control
2. **Backup your keystore** in multiple secure locations
3. **Use strong passwords** for keystore and key
4. **Consider using Play App Signing** (Google manages your signing key)

## Troubleshooting

### "keystore.properties not found"

This is normal for debug builds. The app will use the default debug keystore. Only release builds require keystore.properties.

### "Keystore was tampered with, or password was incorrect"

Double-check your passwords in keystore.properties. Ensure there are no extra spaces.

## References

- [Android Developer: Sign Your App](https://developer.android.com/studio/publish/app-signing)
- [Capacitor: Building for Android](https://capacitorjs.com/docs/android)
