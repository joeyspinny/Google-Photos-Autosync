import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Terminal, Sparkles, FolderArchive } from 'lucide-react';
import JSZip from 'jszip';
import { kotlinMainActivity, androidManifestXml, buildGradleKts } from '../data/kotlinCode';
import { termuxPythonScript, termuxSetupScript } from '../data/termuxCode';

interface FileTab {
  id: string;
  name: string;
  badge: string;
  language: string;
  content: string;
}

const FILES: FileTab[] = [
  {
    id: 'kotlin-main',
    name: 'MainActivity.kt',
    badge: 'Android Studio Single File',
    language: 'kotlin',
    content: kotlinMainActivity.trim()
  },
  {
    id: 'manifest',
    name: 'AndroidManifest.xml',
    badge: 'Permissions & Setup',
    language: 'xml',
    content: androidManifestXml.trim()
  },
  {
    id: 'gradle',
    name: 'build.gradle.kts',
    badge: 'Dependencies',
    language: 'kotlin',
    content: buildGradleKts.trim()
  },
  {
    id: 'termux-py',
    name: 'sync_favorites_drive.py',
    badge: 'Termux Python Script',
    language: 'python',
    content: termuxPythonScript.trim()
  },
  {
    id: 'termux-sh',
    name: 'setup_termux.sh',
    badge: 'Termux 1-Tap Installer',
    language: 'bash',
    content: termuxSetupScript.trim()
  }
];

export const CodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('kotlin-main');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const currentFile = FILES.find((f) => f.id === activeTab) || FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Android Studio project structure
      const androidFolder = zip.folder("AndroidStudioProject");
      const appSrc = androidFolder?.folder("app/src/main/java/com/example/mediastoredrivesync");
      appSrc?.file("MainActivity.kt", kotlinMainActivity.trim());
      androidFolder?.folder("app/src/main")?.file("AndroidManifest.xml", androidManifestXml.trim());
      androidFolder?.folder("app")?.file("build.gradle.kts", buildGradleKts.trim());

      // Termux scripts folder
      const termuxFolder = zip.folder("TermuxScript");
      termuxFolder?.file("sync_favorites_drive.py", termuxPythonScript.trim());
      termuxFolder?.file("setup_termux.sh", termuxSetupScript.trim());

      // Readme instructions
      zip.file(
        "README.md",
        `# MediaStore RAW Favorites -> Google Drive Sync

This package provides two solutions for syncing favorite photos from Android MediaStore to Google Drive with 100% EXIF and filename fidelity:

1. **AndroidStudioProject**: Complete Jetpack Compose Kotlin Android app.
   - Open in Android Studio, add your Google OAuth Client ID in Google Cloud Console.
   - Build and run directly on your phone.

2. **TermuxScript**: Direct Python execution on phone without a computer.
   - In Termux: \`bash setup_termux.sh\`
   - Copy your Google Cloud 'client_secret.json' into the folder.
   - Run: \`python sync_favorites_drive.py\`

Target Google Drive Folder: "High-Res Favorites"
Preserved EXIF: GPS, Camera Model, DateTimeOriginal, SubSecTime, True Display Names.
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
      console.error("Failed to generate zip", e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab bar & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILES.map((file) => (
            <button
              key={file.id}
              onClick={() => {
                setActiveTab(file.id);
                setCopied(false);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === file.id
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>{file.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isZipping ? 'Bundling Zip...' : 'Download Project (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* File metadata description badge */}
      <div className="flex items-center justify-between text-xs px-2 text-slate-400">
        <span className="font-mono text-sky-400 font-semibold">{currentFile.name}</span>
        <span className="bg-slate-800/80 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700/60">
          {currentFile.badge}
        </span>
      </div>

      {/* Code Display Area */}
      <div className="relative rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-2xl">
        <div className="max-h-[560px] overflow-auto p-4 text-xs font-mono leading-relaxed text-slate-200 selection:bg-sky-500/30">
          <pre tabIndex={0} className="whitespace-pre outline-none">{currentFile.content}</pre>
        </div>
      </div>
    </div>
  );
};
