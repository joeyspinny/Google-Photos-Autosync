import React, { useState } from 'react';
import {
  Code,
  Play,
  FileCheck2,
  BookOpen,
  Download,
  Smartphone,
  HardDrive,
  Heart,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Layers,
  Terminal,
  Camera
} from 'lucide-react';
import { CodeViewer } from './components/CodeViewer';
import { DriveSimulator } from './components/DriveSimulator';
import { ExifInspector } from './components/ExifInspector';
import { PlayStoreGuideView } from './components/PlayStoreGuideView';
import { NoCodeGuide } from './components/NoCodeGuide';
import { SecurityComparison } from './components/SecurityComparison';
import { CloneDashboard } from './components/CloneDashboard';
import JSZip from 'jszip';
import { kotlinMainActivity, androidManifestXml, buildGradleKts } from './data/kotlinCode';
import { termuxPythonScript, termuxSetupScript } from './data/termuxCode';
import { taskerXmlContent } from './data/noCodeSolutions';
import {
  customCloneMainActivityKt,
  customCloneServiceKt,
  customCloneDatabaseKt,
  customCloneManifestXml,
  customCloneBuildGradleKt
} from './data/customCloneCode';
import { githubActionsWorkflowYaml } from './data/securityAudit';

export default function App() {
  const [activeTab, setActiveTab] = useState<'clone' | 'zerogcp' | 'security' | 'simulator' | 'exif' | 'code'>('clone');
  const [isZipping, setIsZipping] = useState(false);

  const handleQuickDownload = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Full Custom Android App Clone (Catch-Up, Room DB, Drive Links, Background Daemon)
      const cloneFolder = zip.folder("CustomCloneApp");
      const cloneSrc = cloneFolder?.folder("app/src/main/java/com/example/starredsync");
      cloneSrc?.file("MainActivity.kt", customCloneMainActivityKt.trim());
      cloneSrc?.file("MediaStoreSyncService.kt", customCloneServiceKt.trim());
      cloneSrc?.file("SyncDatabase.kt", customCloneDatabaseKt.trim());
      cloneFolder?.folder("app/src/main")?.file("AndroidManifest.xml", customCloneManifestXml.trim());
      cloneFolder?.folder("app")?.file("build.gradle.kts", customCloneBuildGradleKt.trim());
      cloneFolder?.folder(".github/workflows")?.file("build-apk.yml", githubActionsWorkflowYaml.trim());

      // Termux scripts
      const termuxFolder = zip.folder("TermuxScript");
      termuxFolder?.file("sync_favorites_drive.py", termuxPythonScript.trim());
      termuxFolder?.file("setup_termux.sh", termuxSetupScript.trim());

      // Zero-GCP Pixel 7 Pro Automation (Tasker / Automate)
      const noCodeFolder = zip.folder("ZeroGCP_Pixel_Automation");
      noCodeFolder?.file("SyncStarredPhotos.prf.xml", taskerXmlContent.trim());
      noCodeFolder?.file("README_PIXEL7_SETUP.txt", "1. Install Automate or Tasker in your Personal Profile from Google Play Store.\\n2. Import this profile/flow.\\n3. Connect Google Drive with your personal account (no GCP project needed!).\\n4. Set battery usage to Unrestricted in Android Settings > Apps.");

      zip.file(
        "README.md",
        `# Starred Photos RAW Drive Sync - Complete Suite

Features:
- Catch-Up Sync for existing favorite photos with progress tracking
- Google Drive storage consumption monitor ("High-Res Favorites")
- EXIF ImageDescription with embedded Google Drive deep-link
- 24/7 background MediaStore ContentObserver daemon
- Strict 'drive.file' OAuth sandbox & zero telemetry
`
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mediastore-raw-drive-sync-kit.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Heart className="h-5 w-5 text-white fill-white/80" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-white tracking-tight">
                  MediaStore RAW Favorites Sync
                </h1>
                <span className="hidden sm:inline-flex text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono px-2 py-0.5 rounded-full font-medium">
                  IS_FAVORITE = 1
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Direct ContentResolver to Google Drive v3 • 100% EXIF & True Filenames
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleQuickDownload}
              disabled={isZipping}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isZipping ? 'Bundling...' : 'Download Code Kit (.ZIP)'}</span>
              <span className="sm:hidden">Zip</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto gap-1 border-t border-slate-800/60 no-scrollbar">
          <button
            onClick={() => setActiveTab('clone')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'clone'
                ? 'border-sky-400 text-sky-400 bg-sky-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Sparkles className="h-4 w-4 text-sky-400" />
            <span>Custom Clone (Catch-Up & Storage)</span>
          </button>

          <button
            onClick={() => setActiveTab('zerogcp')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'zerogcp'
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Layers className="h-4 w-4 text-emerald-400" />
            <span>24/7 Automate Flow (No-Code)</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'security'
                ? 'border-purple-400 text-purple-400 bg-purple-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <span>Security Threat Model</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-sky-400 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Play className="h-4 w-4" />
            <span>Drive Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('exif')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'exif'
                ? 'border-sky-400 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Camera className="h-4 w-4" />
            <span>EXIF Inspector</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'code'
                ? 'border-sky-400 text-sky-400 bg-sky-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Code className="h-4 w-4" />
            <span>All Scripts & CI/CD</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'clone' && <CloneDashboard />}
        {activeTab === 'zerogcp' && <NoCodeGuide />}
        {activeTab === 'security' && <SecurityComparison />}
        {activeTab === 'simulator' && <DriveSimulator />}
        {activeTab === 'exif' && <ExifInspector />}
        {activeTab === 'code' && <CodeViewer />}
      </main>

      {/* Technical Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Scoped Storage Compliant (Android 11 - 15) • MediaStore.setRequireOriginal()</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Google Drive API v3</span>
            <span>•</span>
            <span>Target: High-Res Favorites</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
