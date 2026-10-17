import React from 'react';
import { ShieldAlert, Ban, Smartphone, Cloud, Globe, CheckCircle2, XCircle, ArrowRight, Lock } from 'lucide-react';

export const SandboxExplainer: React.FC = () => {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/30 via-slate-900 to-slate-950 p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="rounded-xl bg-red-500/20 p-3 text-red-400 shrink-0 border border-red-500/30">
          <Ban className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-semibold">
            Fundamental Architecture Boundary
          </div>
          <h3 className="text-lg font-bold text-white">
            Why an AI Studio Web App Cannot Directly Access Your Phone's File System
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            AI Studio apps run as secure Web Applications (SPA / PWA) in Google Cloud Run. By design, modern mobile operating systems enforce 3 strict security sandboxes that make direct, zero-setup background file access from a web app technically impossible:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Sandbox 1 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <XCircle className="h-4 w-4" />
            <span>1. W3C Web Sandbox</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Browsers cannot silently read local files on your phone. Any file access in a browser requires you to physically tap a file picker (<code className="text-slate-300">&lt;input type="file"&gt;</code>) every single time. A web app cannot automatically scan <code className="text-slate-300">/DCIM/Camera</code>.
          </p>
        </div>

        {/* Sandbox 2 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <XCircle className="h-4 w-4" />
            <span>2. No MediaStore SQLite Access</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Android's <code className="text-slate-300">IS_FAVORITE</code> attribute lives inside an internal Android SQLite database (<code className="text-slate-300">MediaStore.Images.Media</code>). Only native Android apps with <code className="text-slate-300">ContentResolver</code> can query this table. Web APIs have zero access to it.
          </p>
        </div>

        {/* Sandbox 3 */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-semibold">
            <XCircle className="h-4 w-4" />
            <span>3. Background Tab Freezing</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            To save battery, Android completely pauses or kills web browser tabs when the screen turns off or when you switch apps. Only an Android OS <code className="text-slate-300">ForegroundService</code> can run 24/7 in the background.
          </p>
        </div>
      </div>

      {/* The Division of Labor */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          The Only Working Architecture:
        </h4>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300 font-mono">
          <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-center w-full sm:w-auto">
            <div className="text-sky-400 font-bold">This AI Studio Web App</div>
            <div className="text-[10px] text-slate-500">Inspector • Simulator • Code & Flow Generator</div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 shrink-0 hidden sm:block" />
          <div className="bg-emerald-950/50 px-3 py-2 rounded-lg border border-emerald-900/50 text-center w-full sm:w-auto">
            <div className="text-emerald-400 font-bold">Native Engine on Phone</div>
            <div className="text-[10px] text-slate-400">Automate Flow / Tasker / Custom Micro-APK</div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600 shrink-0 hidden sm:block" />
          <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-center w-full sm:w-auto">
            <div className="text-sky-400 font-bold">Google Drive</div>
            <div className="text-[10px] text-slate-500">"High-Res Favorites" Folder (100% EXIF)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
