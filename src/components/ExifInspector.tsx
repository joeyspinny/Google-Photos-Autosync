import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Upload, FileImage, Info, Calendar, MapPin, Camera, HardDrive, CheckCircle2, XCircle } from 'lucide-react';
import { parseExifFromArrayBuffer, ParsedExif } from '../utils/exifParser';

interface SamplePhoto {
  id: string;
  name: string;
  originalName: string;
  shareSheetName: string;
  dateTaken: string;
  shareSheetDate: string;
  camera: string;
  lens: string;
  location: string;
  sizeRaw: string;
  sizeShareSheet: string;
  previewUrl: string;
}

const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'pixel-landscape',
    name: 'Yosemite Valley Sunset (Pixel 8 Pro)',
    originalName: 'PXL_20241015_184512932.jpg',
    shareSheetName: 'image.jpg (or input_file_0.jpg)',
    dateTaken: '2024-10-15 18:45:12 UTC',
    shareSheetDate: 'Current time (Temporary cache timestamp)',
    camera: 'Google Pixel 8 Pro (Back Camera)',
    lens: 'f/1.68 • 1/320s • ISO 42 • 6.9mm',
    location: '37.745571° N, 119.593604° W (Yosemite, CA)',
    sizeRaw: '8.42 MB (Full RAW Bitstream)',
    sizeShareSheet: '2.14 MB (Compressed & Transcoded)',
    previewUrl: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'galaxy-portrait',
    name: 'Golden Hour Portrait (Galaxy S24 Ultra)',
    originalName: '20241008_172045.jpg',
    shareSheetName: 'image_1.jpg',
    dateTaken: '2024-10-08 17:20:45 UTC',
    shareSheetDate: 'Lost / Export timestamp',
    camera: 'Samsung Galaxy S24 Ultra (50MP Quad-Bayer)',
    lens: 'f/1.7 • 1/500s • ISO 50 • 23mm equivalent',
    location: '34.0194° N, 118.4912° W (Santa Monica, CA)',
    sizeRaw: '14.80 MB (Full Resolution)',
    sizeShareSheet: '3.60 MB (Standard Share Cache)',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  }
];

export const ExifInspector: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState<SamplePhoto>(SAMPLE_PHOTOS[0]);
  const [customParsed, setCustomParsed] = useState<ParsedExif | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        const parsed = parseExifFromArrayBuffer(buffer, file.name, file.type);
        setCustomParsed(parsed);
      }
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-sky-500/20 p-2.5 text-sky-400">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Why Google Photos Share Sheet Destroys Your Files</h3>
            <p className="mt-1 text-sm text-slate-300 leading-relaxed">
              When sharing directly from the Google Photos app via Android's Share Sheet, Google Photos routes images through its internal <code className="text-pink-400 bg-pink-950/50 px-1 py-0.5 rounded text-xs">FileProvider</code>.
              For bandwidth and privacy reasons, the OS writes a temporary downscaled cached copy to <code className="text-amber-300 bg-amber-950/50 px-1 py-0.5 rounded text-xs">cache/image.jpg</code>, stripping the original camera filename, creation timestamps, and EXIF GPS tags.
            </p>
            <p className="mt-2 text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Our MediaStore ContentResolver solution bypasses the share sheet completely, opening the original raw filesystem byte stream to preserve 100% of data.
            </p>
          </div>
        </div>
      </div>

      {/* Sample Selector & Custom Upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SAMPLE_PHOTOS.map((sample) => (
          <button
            key={sample.id}
            onClick={() => {
              setSelectedSample(sample);
              setCustomParsed(null);
            }}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
              selectedSample.id === sample.id && !customParsed
                ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <img
              src={sample.previewUrl}
              alt={sample.name}
              className="h-12 w-12 rounded object-cover border border-slate-700"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{sample.name}</div>
              <div className="text-xs text-slate-400 truncate">{sample.originalName}</div>
            </div>
          </button>
        ))}

        {/* Custom Upload Button */}
        <label className="flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 hover:border-sky-500/70 hover:bg-slate-900/80 cursor-pointer transition-all">
          <Upload className="h-5 w-5 text-sky-400" />
          <span className="text-xs font-semibold text-slate-300">
            {customParsed ? `Loaded: ${customParsed.fileName.slice(0, 14)}...` : 'Upload Your Photo to Test EXIF'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/heic,image/png"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* Side-by-side Technical Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Native Share Sheet (Broken behavior) */}
        <div className="rounded-xl border border-red-500/30 bg-slate-950/80 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-red-500/20 text-red-400 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-bl-lg border-b border-l border-red-500/30">
            Share Sheet Behavior (Broken)
          </div>

          <div className="flex items-center gap-2.5 text-red-400 font-semibold text-base mb-4">
            <XCircle className="h-5 w-5" />
            <span>Native Android Share Sheet</span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/40">
              <div className="text-slate-400 font-medium mb-1">Generated Filename</div>
              <div className="text-red-300 font-mono text-sm font-bold flex items-center justify-between">
                <span>{selectedSample.shareSheetName}</span>
                <span className="text-[10px] text-red-400 bg-red-900/40 px-1.5 py-0.5 rounded">ORIGINAL LOST</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" /> Date & Time
                </span>
                <span className="text-red-300 text-right font-mono text-[11px]">
                  Today's cache time (Reset)
                </span>
              </div>

              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-slate-500" /> EXIF Camera Metadata
                </span>
                <span className="text-red-300 text-right font-mono text-[11px]">
                  Stripped or sanitized
                </span>
              </div>

              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" /> GPS Geolocation
                </span>
                <span className="text-red-300 text-right font-mono text-[11px]">
                  Redacted (Privacy filter)
                </span>
              </div>

              <div className="flex items-start justify-between pb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-slate-500" /> Bitstream & Compression
                </span>
                <span className="text-red-300 text-right font-mono text-[11px]">
                  {selectedSample.sizeShareSheet}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: MediaStore Solution (Our solution) */}
        <div className="rounded-xl border border-emerald-500/40 bg-slate-950/80 p-5 relative overflow-hidden shadow-xl shadow-emerald-500/5">
          <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-bl-lg border-b border-l border-emerald-500/30">
            MediaStore RAW Solution (100% Fidelity)
          </div>

          <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-base mb-4">
            <CheckCircle2 className="h-5 w-5" />
            <span>Direct MediaStore Stream Upload</span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
              <div className="text-slate-400 font-medium mb-1">Preserved Filename</div>
              <div className="text-emerald-300 font-mono text-sm font-bold flex items-center justify-between">
                <span>{customParsed ? customParsed.fileName : selectedSample.originalName}</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-900/40 px-1.5 py-0.5 rounded">100% TRUE NAME</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-500" /> Original Date Taken
                </span>
                <span className="text-emerald-300 text-right font-mono text-[11px]">
                  {customParsed?.dateTimeOriginal || selectedSample.dateTaken}
                </span>
              </div>

              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-emerald-500" /> Camera & Lens Hardware
                </span>
                <span className="text-emerald-300 text-right font-mono text-[11px]">
                  {customParsed
                    ? `${customParsed.make || ''} ${customParsed.model || 'Detected'} • ISO ${customParsed.iso || 'N/A'}`
                    : `${selectedSample.camera} (${selectedSample.lens})`}
                </span>
              </div>

              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" /> GPS Geolocation
                </span>
                <span className="text-emerald-300 text-right font-mono text-[11px]">
                  {customParsed && customParsed.latitude
                    ? `${customParsed.latitude}°, ${customParsed.longitude}°`
                    : selectedSample.location}
                </span>
              </div>

              <div className="flex items-start justify-between pb-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-emerald-500" /> Raw Binary Stream
                </span>
                <span className="text-emerald-300 text-right font-mono text-[11px]">
                  {customParsed
                    ? `${(customParsed.fileSize / (1024 * 1024)).toFixed(2)} MB (Exact bytes)`
                    : selectedSample.sizeRaw}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Insider Android Engineering Note */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-300">
        <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-400" />
          Critical Android Scoped Storage Insight: MediaStore.setRequireOriginal()
        </h4>
        <p className="leading-relaxed">
          Starting in Android 10 (API 29) and Android 13/14/15, Android automatically strips EXIF GPS coordinates and camera serial numbers when apps read from <code className="text-sky-300">contentResolver.openInputStream(uri)</code> even if you have storage permissions!
          To preserve genuine EXIF data, our code implements two strict requirements:
        </p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-slate-400">
          <li>Declares and requests runtime <code className="text-sky-300">android.permission.ACCESS_MEDIA_LOCATION</code></li>
          <li>Wraps the URI before reading: <code className="text-sky-300">val rawUri = MediaStore.setRequireOriginal(contentUri)</code></li>
        </ul>
      </div>
    </div>
  );
};
