import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  FolderSync,
  AlertTriangle,
  Layers,
  Copy,
  Check,
  FileCode
} from 'lucide-react';
import { automateSteps, taskerSteps, taskerXmlContent, automateFlowDescription } from '../data/noCodeSolutions';
import { SandboxExplainer } from './SandboxExplainer';

export const NoCodeGuide: React.FC = () => {
  const [activeTool, setActiveTool] = useState<'automate' | 'tasker'>('automate');
  const [copiedTaskerXml, setCopiedTaskerXml] = useState(false);

  const handleDownloadTaskerXml = () => {
    const blob = new Blob([taskerXmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SyncStarredPhotos.prf.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAutomateFlow = () => {
    // Generate a structured JSON-based definition that Automate or users can import
    const flowData = JSON.stringify({
      title: "Star Photos to Drive RAW Sync",
      description: "Auto-syncs photos starred in Google Photos directly to Google Drive preserving all EXIF & original filenames.",
      targetFolder: "High-Res Favorites",
      uri: "content://media/external/images/media",
      filter: "is_favorite = 1",
      personalProfileOnly: true,
      blocks: automateFlowDescription.blocks
    }, null, 2);

    const blob = new Blob([flowData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'StarPhotosDriveSync.flo.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyTasker = () => {
    navigator.clipboard.writeText(taskerXmlContent);
    setCopiedTaskerXml(true);
    setTimeout(() => setCopiedTaskerXml(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Hero: Zero-GCP / Zero-Terminal Promise */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-sky-950/40 p-6 shadow-xl shadow-emerald-500/5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              <Zap className="h-3.5 w-3.5" />
              100% Zero GCP • Zero Terminal • Zero OAuth Review
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Automated 24/7 Sync on Pixel 7 Pro (Personal Profile)
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Whenever you star a photo in Google Photos on your Pixel 7 Pro, it triggers an instant background event. Android automation apps (like <strong>Automate</strong> or <strong>Tasker</strong>) have <em>Google-approved native Drive authentication built right in</em>. You never need to touch Google Cloud Console, write API keys, or run terminal commands.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTool === 'automate' ? (
              <button
                onClick={handleDownloadAutomateFlow}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Download Automate Flow (.flo)</span>
              </button>
            ) : (
              <button
                onClick={handleDownloadTaskerXml}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Download Tasker Profile (.xml)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Direct Architectural Reality Check: Web vs Native */}
      <SandboxExplainer />

      {/* Pixel 7 Pro Profile & Background Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
            <Smartphone className="h-4 w-4" />
            <span>Personal Profile Isolation</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            On your Pixel 7 Pro, work and personal apps are separated by Android into independent user spaces (<code className="text-sky-300 font-mono text-[11px]">User 0</code> vs <code className="text-sky-300 font-mono text-[11px]">User 10</code>). Installing the app in your <strong>Personal Profile</strong> guarantees it only touches personal photos and personal Google Drive with 0% work data exposure.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <Zap className="h-4 w-4" />
            <span>Instant Trigger on Star</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Starring a photo in Google Photos immediately updates <code className="text-emerald-300 font-mono text-[11px]">is_favorite = 1</code> in MediaStore. Android's <code className="text-emerald-300 font-mono text-[11px]">ContentObserver</code> detects this within milliseconds, queuing the file for instant background upload.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
            <ShieldCheck className="h-4 w-4" />
            <span>No Battery Drain / 24/7 Daemon</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unlike polling scripts, Android's ContentObserver sleeps until the OS signals a change. Set the app's battery usage to <strong>Unrestricted</strong> in Android Settings so Pixel's battery manager doesn't put it to sleep.
          </p>
        </div>
      </div>

      {/* Tool Selector: Automate (Recommended) vs Tasker */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-400" />
            <span>Select Your Preferred Automation App</span>
          </h3>
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTool('automate')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTool === 'automate'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Automate (Recommended • Free)
            </button>
            <button
              onClick={() => setActiveTool('tasker')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeTool === 'tasker'
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tasker
            </button>
          </div>
        </div>

        {/* Automate Workflow View */}
        {activeTool === 'automate' && (
          <div className="space-y-6">
            {/* Visual Flow Blocks */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-sm font-semibold text-white">
                  Automate Visual Flow Architecture (4 Blocks)
                </span>
                <span className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded font-mono">
                  Event Driven
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {automateFlowDescription.blocks.map((b, i) => (
                  <div key={b.id} className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-900/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">BLOCK #{i + 1}</span>
                      <span className="text-[10px] text-slate-500">Node</span>
                    </div>
                    <div className="text-xs font-bold text-white">{b.title}</div>
                    <p className="text-[11px] text-slate-400 leading-snug">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step by step installation */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <h4 className="text-sm font-semibold text-white">5-Minute Setup on Pixel 7 Pro</h4>
              <div className="space-y-3">
                {automateSteps.map((step) => (
                  <div key={step.number} className="flex items-start gap-3 text-xs">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs mt-0.5">
                      {step.number}
                    </div>
                    <div className="flex-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white">{step.title}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          {step.badge}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tasker Workflow View */}
        {activeTool === 'tasker' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">Tasker Profile & Task XML</h4>
                  <p className="text-xs text-slate-400">
                    Imports an Event profile for MediaStore ContentProvider changes and uploads via Tasker's pre-approved Google Drive plugin.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyTasker}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    {copiedTaskerXml ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedTaskerXml ? 'Copied' : 'Copy XML'}</span>
                  </button>
                  <button
                    onClick={handleDownloadTaskerXml}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-sky-500 text-white font-semibold hover:bg-sky-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download XML</span>
                  </button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto rounded-lg bg-black/90 p-3 text-[11px] font-mono text-slate-300">
                <pre>{taskerXmlContent}</pre>
              </div>

              <div className="space-y-3 pt-2">
                {taskerSteps.map((step) => (
                  <div key={step.number} className="flex items-start gap-3 text-xs">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs mt-0.5">
                      {step.number}
                    </div>
                    <div className="flex-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="font-semibold text-white">{step.title}</div>
                      <p className="text-slate-300 text-[11px] mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pixel 7 Pro Battery Optimization Instructions */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <span className="font-semibold text-amber-300">
              Crucial Pixel 7 Pro Background Setting (To keep it running 24/7):
            </span>
            <p className="leading-relaxed text-amber-200/90">
              Google Pixel phones have aggressive battery saver policies that kill background services if not configured:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-amber-200/90 pl-1">
              <li>On your Pixel 7 Pro, open <strong>Settings &gt; Apps &gt; Automate (or Tasker)</strong>.</li>
              <li>Tap <strong>App battery usage</strong>.</li>
              <li>Select <strong>Unrestricted</strong> (instead of Optimized).</li>
              <li>Ensure it is installed in your <strong>Personal Profile</strong>, so it monitors only your personal camera roll.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
