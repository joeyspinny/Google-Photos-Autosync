export interface SetupStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  tips?: string[];
}

export const googleCloudSetupSteps: SetupStep[] = [
  {
    id: "gcp-project",
    title: "1. Create Google Cloud Project & Enable Drive API",
    description: "Open the Google Cloud Console and enable the Google Drive API v3 for your account.",
    tips: [
      "Visit console.cloud.google.com and create a project (e.g. 'MediaStore-Drive-Sync').",
      "Go to APIs & Services > Library.",
      "Search for 'Google Drive API' and click Enable.",
      "Set OAuth Consent Screen to 'External' and add your Google email under Test Users."
    ]
  },
  {
    id: "gcp-credentials",
    title: "2. Generate OAuth 2.0 Credentials",
    description: "Create an OAuth Client ID matching your chosen execution method (Android App or Termux script).",
    tips: [
      "For Termux Python: Choose Application type 'Desktop app', download the JSON file, and rename it to 'client_secret.json'.",
      "For Android Studio App: Choose Application type 'Android', set package name to 'com.example.mediastoredrivesync', and paste your debug SHA-1 signing certificate fingerprint.",
      "Scope needed: https://www.googleapis.com/auth/drive.file (allows creating/managing files created by this app without broad read access to your entire personal Drive)."
    ]
  },
  {
    id: "sha1-fingerprint",
    title: "3. Obtain Android Debug SHA-1 (For Android Studio App)",
    description: "Run keytool in terminal to get the SHA-1 hash for the Android OAuth client.",
    command: "keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android",
    tips: [
      "Copy the SHA1 line (e.g. AA:BB:CC:...)",
      "Paste into your Google Cloud Android OAuth Client configuration."
    ]
  }
];

export const playStoreTwaGuide = {
  title: "Running AI Studio Apps Locally on Android via Play Store (TWA / WebAPK)",
  summary: "Google AI Studio web applications are built with modern Web Standards (PWA). You can install them locally on your Android phone either directly as a zero-store WebAPK or publish them to the Google Play Store using Trusted Web Activity (TWA).",
  methods: [
    {
      name: "Method 1: Direct Local Installation (WebAPK)",
      badge: "Fastest / No Store Review",
      description: "Installs directly to your Android launcher as a first-class app with an isolated window, full offline cache, and native back gesture.",
      steps: [
        "Open this app's Shared App URL on your phone in Google Chrome.",
        "Tap the three-dot menu (⋮) in the top right.",
        "Select 'Install app' or 'Add to Home screen'.",
        "Chrome uses Android's WebAPK Minting service to compile an installable APK on the fly, placing an app icon right in your app drawer alongside native apps."
      ]
    },
    {
      name: "Method 2: Google Play Store via Bubblewrap (TWA)",
      badge: "Official Google Play Method",
      description: "Google's official CLI tool that turns any progressive web app into a signed Android App Bundle (.aab) ready for the Google Play Console.",
      steps: [
        "Install Bubblewrap CLI: npm install -g @bubblewrap/cli",
        "Initialize your project: bubblewrap init --manifest=https://your-applet-url/manifest.json",
        "Bubblewrap automatically downloads Android SDK tools, configures the TWA wrapper, and generates digital asset links (assetlinks.json).",
        "Build the Play Store bundle: bubblewrap build",
        "Upload the generated app-release-bundle.aab to Google Play Console under Internal Testing or Production!"
      ]
    },
    {
      name: "Method 3: PWABuilder (Web-based Play Store Packager)",
      badge: "No Terminal Required",
      description: "Microsoft & Google's open-source tool to package PWAs into Play Store ready packages in minutes.",
      steps: [
        "Go to pwabuilder.com on your computer.",
        "Paste the URL of this AI Studio applet.",
        "Click 'Package For Stores' > 'Google Play'.",
        "Download your signed .aab package and upload to the Google Play Store."
      ]
    }
  ],
  whyNativeCompanionNeeded: "Android's operating system strictly sandboxes web browsers from directly executing SQLite queries on internal system content providers (MediaStore.Images.Media.EXTERNAL_CONTENT_URI with IS_FAVORITE == 1) for security. That is why this AI Studio workbench provides both the native Kotlin Android Studio project and the Python Termux script for 100% direct binary stream execution with full EXIF preservation!"
};
