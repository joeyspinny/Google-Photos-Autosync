import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, ShieldAlert, Terminal, Globe, ExternalLink, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { playStoreTwaGuide, googleCloudSetupSteps } from '../data/playStoreGuide';

export const PlayStoreGuideView: React.FC = () => {
  const [selectedMethod, setSelectedMethod] = useState<number>(1);

  return (
    <div className="space-y-8">
      {/* Hero explanation */}
      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-sky-500/20 p-3 text-sky-400 shrink-0">
            <Smartphone className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                Play Store & Android Local Applet Architecture
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Running this AI Studio App Locally on Your Phone via the Play Store
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Google AI Studio web applications are fully PWA-compliant. Android allows Progressive Web Apps to be packaged as native Android APKs/AABs via <strong className="text-sky-300">Trusted Web Activities (TWA)</strong> and published to the Google Play Store, or installed directly with zero wait time via <strong className="text-emerald-400">WebAPK</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-amber-300">Crucial Android Sandbox Principle:</span>
          <p className="text-amber-200/90 leading-relaxed">
            While the AI Studio app can run locally on your phone full-screen from the Play Store or Home Screen, web runtimes (Chromium/WebView) are strictly sandboxed by Android OS from executing raw SQLite queries against internal system databases like <code className="bg-amber-900/60 px-1 py-0.5 rounded text-[11px] font-mono">MediaStore.Images.Media.IS_FAVORITE</code>. That is why this workbench provides both the native Kotlin engine and the Termux script to perform the raw byte upload!
          </p>
        </div>
      </div>

      {/* Installation Methods Tabs */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-400" />
          <span>Choose Your Installation / Play Store Deployment Path</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {playStoreTwaGuide.methods.map((method, index) => (
            <button
              key={method.name}
              onClick={() => setSelectedMethod(index)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selectedMethod === index
                  ? 'border-sky-500 bg-sky-950/30 shadow-lg shadow-sky-500/10'
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
              }`}
            >
              <div className="text-[11px] font-mono font-bold text-sky-400 mb-1">{method.badge}</div>
              <div className="text-sm font-semibold text-white">{method.name}</div>
              <p className="text-xs text-slate-400 mt-2 line-clamp-2">{method.description}</p>
            </button>
          ))}
        </div>

        {/* Selected method detail card */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="text-base font-semibold text-white">
                {playStoreTwaGuide.methods[selectedMethod].name}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {playStoreTwaGuide.methods[selectedMethod].description}
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-medium">
              {playStoreTwaGuide.methods[selectedMethod].badge}
            </span>
          </div>

          <div className="space-y-3">
            {playStoreTwaGuide.methods[selectedMethod].steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs text-slate-300">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400 font-bold text-[10px] mt-0.5">
                  {idx + 1}
                </div>
                <div className="font-mono text-slate-200 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 flex-1">
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Google Cloud Console Setup Wizard */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Google Cloud OAuth 2.0 & Drive API v3 Setup Checklist</span>
        </h3>

        <div className="space-y-3">
          {googleCloudSetupSteps.map((step) => (
            <div key={step.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2 text-xs">
              <div className="font-semibold text-white text-sm flex items-center justify-between">
                <span>{step.title}</span>
                <span className="text-[10px] text-slate-500 font-mono">Prerequisite</span>
              </div>
              <p className="text-slate-300">{step.description}</p>
              {step.command && (
                <div className="bg-black/80 rounded-lg p-2.5 font-mono text-[11px] text-sky-300 border border-slate-800 flex items-center justify-between">
                  <span>{step.command}</span>
                </div>
              )}
              {step.tips && (
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pl-1">
                  {step.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
