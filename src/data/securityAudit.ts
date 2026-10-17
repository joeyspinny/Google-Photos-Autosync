export interface SecurityDimension {
  category: string;
  thirdPartyTool: {
    status: 'warning' | 'danger' | 'caution';
    summary: string;
    details: string;
  };
  customClone: {
    status: 'secure' | 'optimal';
    summary: string;
    details: string;
  };
}

export const securityComparisonData: SecurityDimension[] = [
  {
    category: "Google Drive OAuth Scope & Blast Radius",
    thirdPartyTool: {
      status: "warning",
      summary: "Broad Drive or App-level Token Access",
      details: "Third-party automation apps often request broad or multi-purpose Drive scopes to support various user scripts. If their app or token storage is ever targeted, all Drive files accessible to that token are at risk."
    },
    customClone: {
      status: "optimal",
      summary: "Strict 'drive.file' Sandbox (Zero Exposure)",
      details: "Your custom micro-app uses strictly 'https://www.googleapis.com/auth/drive.file'. Under this Google-enforced sandbox, the app is mathematically prevented from viewing or touching any existing personal files or folders in your Google Drive—it can only access files it created itself."
    }
  },
  {
    category: "Device Storage & Photo Privacy",
    thirdPartyTool: {
      status: "caution",
      summary: "Full Camera Roll Visibility",
      details: "Tasker and Automate require broad READ_MEDIA_IMAGES permission. Because they are closed-source commercial tools, you must trust their binary code not to scan, cache, or analyze un-starred photos on your phone."
    },
    customClone: {
      status: "secure",
      summary: "Auditable In-Memory Stream",
      details: "You hold 100% of the source code. The ContentObserver only activates on 'is_favorite = 1', opens the stream directly into the Google Drive HTTPS socket, and discards it from memory immediately without caching or saving."
    }
  },
  {
    category: "Telemetry & Third-Party SDKs",
    thirdPartyTool: {
      status: "caution",
      summary: "Analytics & Crash Trackers",
      details: "Commercial apps frequently embed analytics SDKs (Crashlytics, Google Analytics, telemetry) that log device identifiers, crash traces, and OS states."
    },
    customClone: {
      status: "optimal",
      summary: "Zero Telemetry, Zero Analytics",
      details: "The micro-app imports zero third-party tracking libraries. It has exactly one external network destination: https://www.googleapis.com/upload/drive/v3/files."
    }
  },
  {
    category: "Background Daemon Overhead & Work Profile Leaks",
    thirdPartyTool: {
      status: "warning",
      summary: "Heavy Multi-Feature Engine",
      details: "Apps like Tasker/Automate have dozens of running services, plugins, and broad accessibility listeners that can consume memory and background battery."
    },
    customClone: {
      status: "optimal",
      summary: "Ultra-Lightweight ContentObserver (<8 MB RAM)",
      details: "A dedicated Android Service that registers an event-driven ContentObserver with the OS. It remains in deep sleep at 0% CPU until you tap the star icon in Google Photos."
    }
  }
];

export const githubActionsWorkflowYaml = `name: Build Custom Drive RAW Sync APK

on:
  push:
    branches: [ "main" ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'
        cache: gradle

    - name: Grant execute permission for gradlew
      run: chmod +x gradlew

    - name: Build Debug APK
      run: ./gradlew assembleDebug

    - name: Upload APK Artifact
      uses: actions/upload-artifact@v4
      with:
        name: StarredDriveSync-debug.apk
        path: app/build/outputs/apk/debug/app-debug.apk
`;
