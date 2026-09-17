import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, X, Smartphone, ArrowUpFromLine, PlusSquare } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already installed, dismissed, or neither installable nor iOS, render nothing
  if (isInstalled || dismissed || (!isInstallable && !isIOS)) {
    return null;
  }

  return (
    <>
      {/* Sticky Bottom Prompt Banner */}
      <div className="fixed bottom-18 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-90 max-w-sm bg-white border border-[#EFEAE4] rounded-2xl shadow-xl p-4.5 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-start gap-3">
          {/* App Logo Emblem */}
          <div className="w-10 h-10 rounded-xl bg-[#7ABA42]/10 border border-[#7ABA42]/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-[#7ABA42]" />
          </div>

          {/* Prompt Copy */}
          <div className="flex-1 space-y-0.5">
            <h4 className="text-xs font-extrabold text-[#1F1F1F]">Install Walk Nepal Walk</h4>
            <p className="text-[10px] text-[#8B8680] font-bold leading-relaxed">
              Add this app to your home screen for rapid, offline-ready trek itineraries and live photo updates!
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 flex items-center justify-end gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 text-[10px] font-extrabold text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
          >
            Maybe Later
          </button>

          {isInstallable ? (
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-[10px] font-extrabold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          ) : (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-[10px] font-extrabold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Install on iOS</span>
            </button>
          )}
        </div>
      </div>

      {/* iOS-specific bottom guide sheet */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[10020] flex items-end sm:items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-4 text-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#7ABA42]" />
                <h3 className="text-sm font-black uppercase tracking-wide text-[#1F1F1F]">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-stone-500" />
              </button>
            </div>

            <p className="text-xs text-stone-600 font-bold leading-relaxed">
              Apple requires Safari users to install apps manually. Follow these 2 steps to add **Walk Nepal Walk** to your device:
            </p>

            <div className="bg-[#FAF8F5] border border-[#EFEAE4] rounded-2xl p-4.5 space-y-3.5">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-white border border-[#EFEAE4] flex items-center justify-center text-xs font-black text-[#7ABA42] shrink-0 shadow-3xs">
                  1
                </div>
                <div className="text-xs font-medium text-stone-700">
                  Tap the <strong className="font-extrabold text-[#1F1F1F]">Share</strong> button <span className="inline-block p-1 bg-white border border-[#EFEAE4] rounded-md shadow-3xs mx-1"><ArrowUpFromLine className="w-3.5 h-3.5 text-[#007AFF] inline" /></span> in the Safari browser toolbar.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-white border border-[#EFEAE4] flex items-center justify-center text-xs font-black text-[#7ABA42] shrink-0 shadow-3xs">
                  2
                </div>
                <div className="text-xs font-medium text-stone-700">
                  Scroll down the share menu list and tap <strong className="font-extrabold text-[#1F1F1F]">Add to Home Screen</strong> <span className="inline-block p-1 bg-white border border-[#EFEAE4] rounded-md shadow-3xs mx-1"><PlusSquare className="w-3.5 h-3.5 text-stone-600 inline" /></span>.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-[#7ABA42] hover:bg-[#6AA437] text-white text-xs font-black rounded-xl transition-all shadow-xs active:scale-[0.98] cursor-pointer text-center"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
