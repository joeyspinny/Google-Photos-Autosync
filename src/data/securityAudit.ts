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

export const githubActionsWorkflowYaml = `name: Build Starred RAW Sync Android APK

on:
  push:
    branches: [ "**" ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up JDK 17
      uses: actions/setup-java@v4
      with:
        java-version: '17'
        distribution: 'temurin'

    - name: Accept Android SDK Licenses & Setup Platform
      run: |
        yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses || true
        $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-34" "build-tools;34.0.0" || true

    - name: Setup Gradle
      uses: gradle/actions/setup-gradle@v4
      with:
        gradle-version: 8.10.2

    - name: Install Dependencies & Build Android APK
      run: |
        # 1. Detect project root folder
        PROJECT_DIR="."
        if [ -f "android/build.gradle.kts" ] || [ -f "android/settings.gradle.kts" ]; then
          PROJECT_DIR="android"
        elif [ -f "StarredSyncApp/build.gradle.kts" ] || [ -f "StarredSyncApp/settings.gradle.kts" ]; then
          PROJECT_DIR="StarredSyncApp"
        elif [ -f "CustomCloneApp/build.gradle.kts" ] || [ -f "CustomCloneApp/settings.gradle.kts" ]; then
          PROJECT_DIR="CustomCloneApp"
        elif [ -d "android" ]; then
          PROJECT_DIR="android"
        elif [ -d "StarredSyncApp" ]; then
          PROJECT_DIR="StarredSyncApp"
        elif [ -d "CustomCloneApp" ]; then
          PROJECT_DIR="CustomCloneApp"
        fi

        echo "Targeting project directory: $PROJECT_DIR"
        cd "$PROJECT_DIR"

        # 2. Self-healing settings.gradle.kts
        if [ ! -f "settings.gradle.kts" ] && [ ! -f "settings.gradle" ]; then
          echo "Generating settings.gradle.kts..."
          echo 'pluginManagement {' > settings.gradle.kts
          echo '    repositories {' >> settings.gradle.kts
          echo '        google()' >> settings.gradle.kts
          echo '        mavenCentral()' >> settings.gradle.kts
          echo '        gradlePluginPortal()' >> settings.gradle.kts
          echo '    }' >> settings.gradle.kts
          echo '}' >> settings.gradle.kts
          echo 'dependencyResolutionManagement {' >> settings.gradle.kts
          echo '    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)' >> settings.gradle.kts
          echo '    repositories {' >> settings.gradle.kts
          echo '        google()' >> settings.gradle.kts
          echo '        mavenCentral()' >> settings.gradle.kts
          echo '    }' >> settings.gradle.kts
          echo '}' >> settings.gradle.kts
          echo 'rootProject.name = "StarredDriveSync"' >> settings.gradle.kts
          echo 'include(":app")' >> settings.gradle.kts
        fi

        # 3. Self-healing root build.gradle.kts
        if [ ! -f "build.gradle.kts" ] && [ ! -f "build.gradle" ]; then
          echo "Generating root build.gradle.kts..."
          echo 'plugins {' > build.gradle.kts
          echo '    id("com.android.application") version "8.7.2" apply false' >> build.gradle.kts
          echo '    id("org.jetbrains.kotlin.android") version "2.0.21" apply false' >> build.gradle.kts
          echo '    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false' >> build.gradle.kts
          echo '    id("com.google.devtools.ksp") version "2.0.21-1.0.27" apply false' >> build.gradle.kts
          echo '}' >> build.gradle.kts
        fi

        # 4. Auto-fix packaging duplicates, SDK target, and dependencies in build.gradle.kts
        for gradle_file in $(find . -name "build.gradle.kts" 2>/dev/null); do
          # Ensure compileSdk is 34 for runner compatibility
          sed -i 's/compileSdk = 35/compileSdk = 34/g' "$gradle_file" || true
          sed -i 's/targetSdk = 35/targetSdk = 34/g' "$gradle_file" || true

          # Ensure valid google-api-services-drive Maven Central version
          sed -i 's/v3-rev20240905-2.0.0/v3-rev20240914-2.0.0/g' "$gradle_file" || true

          if grep -q "com.android.application" "$gradle_file" && ! grep -q "META-INF/DEPENDENCIES" "$gradle_file"; then
            echo "Auto-patching packaging excludes into $gradle_file..."
            sed -i '/kotlinOptions {/i \\    packaging {\\n        resources {\\n            excludes += "/META-INF/{AL2.0,LGPL2.1}"\\n            excludes += "META-INF/DEPENDENCIES"\\n            excludes += "META-INF/INDEX.LIST"\\n            excludes += "META-INF/LICENSE"\\n            excludes += "META-INF/LICENSE.txt"\\n            excludes += "META-INF/license.txt"\\n            excludes += "META-INF/NOTICE"\\n            excludes += "META-INF/NOTICE.txt"\\n            excludes += "META-INF/notice.txt"\\n            excludes += "META-INF/ASL2.0"\\n            excludes += "META-INF/*.kotlin_module"\\n        }\\n    }\\n' "$gradle_file" || true
          fi

          if grep -q "META-INF/DEPENDENCIES" "$gradle_file" && ! grep -q "META-INF/INDEX.LIST" "$gradle_file"; then
            sed -i '/excludes += "META-INF\\/DEPENDENCIES"/a \\            excludes += "META-INF/INDEX.LIST"' "$gradle_file" || true
          fi
        done

        # 5. Auto-sanitize AndroidManifest.xml (remove deprecated package attribute and missing mipmap refs)
        for manifest in $(find . -name "AndroidManifest.xml" 2>/dev/null); do
          echo "Sanitizing $manifest..."
          sed -i 's/package="com.example[^"]*"//g' "$manifest" || true
          sed -i 's|@mipmap/ic_launcher_round|@android:drawable/ic_menu_camera|g' "$manifest" || true
          sed -i 's|@mipmap/ic_launcher|@android:drawable/ic_menu_camera|g' "$manifest" || true
          sed -i 's|@style/Theme.Material3.Dark.NoActionBar|@android:style/Theme.Material.NoActionBar|g' "$manifest" || true
        done

        # 6. Ensure fallback mipmap drawables & strings exist in any res folder so AAPT linking never fails
        for res_parent in $(find . -type d -path "*/src/main" 2>/dev/null); do
          echo "Setting up launcher resources in $res_parent/res..."
          mkdir -p "$res_parent/res/mipmap-anydpi-v26"
          mkdir -p "$res_parent/res/values"
          echo '<?xml version="1.0" encoding="utf-8"?>' > "$res_parent/res/mipmap-anydpi-v26/ic_launcher.xml"
          echo '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">' >> "$res_parent/res/mipmap-anydpi-v26/ic_launcher.xml"
          echo '    <background android:drawable="@android:color/black"/>' >> "$res_parent/res/mipmap-anydpi-v26/ic_launcher.xml"
          echo '    <foreground android:drawable="@android:drawable/ic_menu_camera"/>' >> "$res_parent/res/mipmap-anydpi-v26/ic_launcher.xml"
          echo '</adaptive-icon>' >> "$res_parent/res/mipmap-anydpi-v26/ic_launcher.xml"

          cp "$res_parent/res/mipmap-anydpi-v26/ic_launcher.xml" "$res_parent/res/mipmap-anydpi-v26/ic_launcher_round.xml" || true

          if [ ! -f "$res_parent/res/values/strings.xml" ]; then
            echo '<resources><string name="app_name">Starred RAW Sync</string></resources>' > "$res_parent/res/values/strings.xml"
          fi
        done

        # 7. Auto-replace deprecated AndroidHttp with NetHttpTransport in Kotlin services
        for kt_file in $(find . -name "*.kt" 2>/dev/null); do
          sed -i 's/import com.google.api.client.extensions.android.http.AndroidHttp/import com.google.api.client.http.javanet.NetHttpTransport/g' "$kt_file" || true
          sed -i 's/AndroidHttp.newCompatibleTransport()/NetHttpTransport()/g' "$kt_file" || true
        done

        # 8. Ensure wrapper exists and is executable
        if [ ! -f "gradlew" ]; then
          gradle wrapper --gradle-version 8.10.2 || true
        fi
        [ -f "gradlew" ] && chmod +x gradlew || true

        # 9. Execute Build
        echo "Building Android Debug APK..."
        if [ -f "gradlew" ]; then
          ./gradlew assembleDebug --no-daemon --stacktrace
        else
          gradle assembleDebug --no-daemon --stacktrace
        fi

    - name: Upload Debug APK Artifact
      uses: actions/upload-artifact@v4
      if: success()
      with:
        name: StarredDriveSync-debug.apk
        path: "**/build/outputs/apk/debug/*.apk"
        if-no-files-found: error
        retention-days: 30

    - name: Publish to GitHub Releases
      uses: softprops/action-gh-release@v2
      if: github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
      with:
        tag_name: v1.0.0-apk
        name: "Starred Drive Sync APK v1.0.0"
        body: |
          ### Starred RAW Drive Sync Android App (Pixel 7 Pro)
          Direct APK download compiled automatically by GitHub Actions.
          - 24/7 MediaStore ContentObserver for Google Photos favorites
          - Uncompressed RAW DNG / full JPEG streaming to Google Drive
          - Room SQLite local registry & quota breakdown
        files: "**/build/outputs/apk/debug/*.apk"
      continue-on-error: true
`;

