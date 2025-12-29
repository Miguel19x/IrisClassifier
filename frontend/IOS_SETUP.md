# iOS Setup Guide

This guide explains how to set up the iOS project for the IrisClassifier application using Capacitor.

## Prerequisites

- **macOS** with Xcode installed (version 14.0 or higher)
- **Xcode Command Line Tools**: `xcode-select --install`
- **CocoaPods**: `sudo gem install cocoapods`
- **Apple Developer Account** (for device testing and App Store distribution)

## Step 1: Initialize iOS Project

From the frontend directory, initialize the iOS platform:

```bash
cd frontend
npx cap add ios
```

This creates the `ios/` directory with the native iOS project.

## Step 2: Configure Info.plist Permissions

The iOS app requires specific permissions to access device features. Edit `ios/App/App/Info.plist` to add:

### Camera Permission

```xml
<key>NSCameraUsageDescription</key>
<string>IrisClassifier needs camera access to capture product price list images for classification.</string>
```

### Photo Library Permission

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>IrisClassifier needs photo library access to save and retrieve price list images.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>IrisClassifier needs permission to save captured images to your photo library.</string>
```

### File System Permission

```xml
<key>UIFileSharingEnabled</key>
<true/>
<key>LSSupportsOpeningDocumentsInPlace</key>
<true/>
```

## Step 3: Configure Capacitor

The `capacitor.config.json` should already be configured, but verify it contains:

```json
{
  "appId": "com.irisclassifier.app",
  "appName": "IrisClassifier",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  },
  "plugins": {
    "Camera": {
      "permissions": ["camera", "photos"]
    },
    "Filesystem": {
      "permissions": ["publicStorage"]
    }
  }
}
```

## Step 4: Install Dependencies

Install iOS dependencies using CocoaPods:

```bash
cd ios/App
pod install
```

## Step 5: Open in Xcode

Open the iOS project in Xcode:

```bash
npx cap open ios
```

## Step 6: Configure Signing & Capabilities

In Xcode:

1. **Select the App target** in the project navigator
2. **Go to "Signing & Capabilities" tab**
3. **Enable "Automatically manage signing"**
4. **Select your Team** (Apple Developer Account)
5. **Verify Bundle Identifier**: `com.irisclassifier.app`

### Required Capabilities

The following capabilities should be automatically configured, but verify:

- ✅ **Camera** - For capturing price list images
- ✅ **Photo Library** - For saving/loading images

## Step 7: Build and Run

### Run on Simulator

1. Select a simulator from the device dropdown (e.g., "iPhone 15 Pro")
2. Click the **Play** button or press `Cmd + R`

### Run on Physical Device

1. Connect your iOS device via USB
2. Select your device from the device dropdown
3. Click the **Play** button or press `Cmd + R`
4. **Trust the developer** on your device when prompted

## Building for Production

### Create Archive

1. In Xcode, select **Product > Archive**
2. Wait for the archive to complete
3. The **Organizer** window will open

### Distribute to App Store

1. Click **Distribute App**
2. Select **App Store Connect**
3. Follow the wizard to upload to TestFlight or App Store

### Distribute Ad Hoc (Testing)

1. Click **Distribute App**
2. Select **Ad Hoc**
3. Select devices to include
4. Export the IPA file

## Syncing Changes

After making changes to the web app, sync with iOS:

```bash
cd frontend
pnpm build
npx cap sync ios
```

This copies the built web assets to the iOS project.

## Troubleshooting

### "No provisioning profiles found"

1. Open Xcode preferences (`Cmd + ,`)
2. Go to **Accounts** tab
3. Add your Apple ID
4. Download provisioning profiles

### "Pod install failed"

```bash
cd ios/App
pod repo update
pod install
```

### "Module 'Capacitor' not found"

```bash
cd frontend
npx cap sync ios
```

### "The app could not be installed"

1. Clean build folder: **Product > Clean Build Folder** (`Cmd + Shift + K`)
2. Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
3. Rebuild the project

## Development Workflow

1. **Make changes** to React code in `frontend/src/`
2. **Build**: `pnpm build`
3. **Sync**: `npx cap sync ios`
4. **Run** in Xcode

For live reload during development:

```bash
# Terminal 1: Run dev server
cd frontend
pnpm dev

# Terminal 2: Update capacitor config to point to dev server
# Edit capacitor.config.json temporarily:
{
  "server": {
    "url": "http://localhost:5173",
    "cleartext": true
  }
}

# Sync and run
npx cap sync ios
npx cap open ios
```

**Remember to remove the server URL before building for production!**

## References

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Apple Developer: App Distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
- [Capacitor Camera Plugin](https://capacitorjs.com/docs/apis/camera)
- [Capacitor Filesystem Plugin](https://capacitorjs.com/docs/apis/filesystem)
