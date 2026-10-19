# Starred RAW Drive Sync - Android App (Pixel 7 Pro)

Continuous background sync for Google Photos favorites to Google Drive with full camera RAW (DNG), uncompressed JPEG/HEIC, and EXIF metadata preservation.

---

## 📱 Where to Find Your Auto-Created APK on GitHub

When you push this repository to GitHub, **GitHub does NOT place the compiled `.apk` inside the file directory or git tree**. Instead, GitHub compiles it in the cloud and provides it under **Actions / Artifacts** and **Releases**.

Here is how to download your APK in 30 seconds:

### Step 1: Open the "Actions" Tab
At the very top of your GitHub repository page (just below the repository name), you will see tabs:
`Code` | `Issues` | `Pull requests` | **`Actions`** 👈 Click this | `Projects` | `Security` | `Insights` | `Settings`

### Step 2: Check if Actions are Enabled (First Time Only)
If this is a newly created repository, GitHub often displays a security notice:
> *"Workflows aren't being run on this repository. Workflows are disabled on this repository by default."*
- Click the green button: **"I understand my workflows, go ahead and enable them"**.
- If a build didn't run automatically, click **Build Starred RAW Sync Android APK** on the left menu, click **Run workflow** (on the right) → **Run workflow** (green button).

### Step 3: Click the Latest Workflow Run
- In the list of workflow runs, click on the top run (e.g., **"Build Starred RAW Sync Android APK"**).
- Wait ~1-2 minutes for the green checkmark (✔) to indicate completion.

### Step 4: Download the APK from "Artifacts"
- Scroll down to the very bottom of the workflow run summary page.
- Under the **Artifacts** section, you will see:
  📦 **`StarredDriveSync-debug.apk`**
- Click it to download!
- Transfer or open this file on your Pixel 7 Pro (Personal Profile) and tap **Install**.

---

## ⚠️ Troubleshooting Checklist: Why don't I see the APK?

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"Actions" tab is empty or says 0 workflows** | The `.github` folder was hidden when you uploaded files manually | Folders starting with a `.` are hidden on Mac/Windows. Check your repo: does the `.github/workflows/build-apk.yml` file exist in the repo? If not, create file `.github/workflows/build-apk.yml` on GitHub and paste the workflow code. |
| **Workflow is yellow/in progress** | GitHub is currently provisioning Ubuntu and compiling with Gradle 8.10.2 | It takes about 60–90 seconds to compile. Refresh the page once the yellow spinner turns into a green checkmark (✔). |
| **"Workflows disabled" banner** | GitHub default security policy for newly imported repositories | Click **"I understand my workflows, go ahead and enable them"**, then click **Run workflow**. |
| **Looking in the Code tree** | Expecting `.apk` to appear in the git file commits | `.apk` files are compiled binaries. They appear in **Actions > [Run] > Artifacts** or in **Releases** (on the right sidebar of the repo home page), not in the git commit tree. |

---

## ⚡ Alternative Instant Option: Zero-Setup (Automate / Tasker)

If you don't want to wait for an APK build, you can run the sync immediately on your Pixel 7 Pro with zero setup:
1. Open Google Play Store on your Pixel 7 Pro (**Personal Profile**).
2. Install **Automate** (by LlamaLab).
3. Import the pre-made flow from the web app or ZIP kit.
4. Select your personal Google Drive account and tap **Start**.
5. Star any photo in Google Photos — it syncs immediately to your Google Drive folder in uncompressed RAW.
