import React from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, ShieldCheck, Laptop, Smartphone, Lock, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ALLOWED_DEVICE_LABELS, RESTRICTED_ADMIN_EMAIL } from '../services/deviceLockService';

export const DeviceAuthorizationModal: React.FC = () => {
  const {
    deviceAuthStatus,
    deviceAuthInfo,
    deviceAuthBusy,
    authorizeCurrentDeviceSlot,
    signOutUser,
    dismissDeviceAuthError,
  } = useAuth();

  if (deviceAuthStatus !== 'needs_binding' && deviceAuthStatus !== 'denied') {
    return null;
  }

  const isDenied = deviceAuthStatus === 'denied';
  const slot = deviceAuthInfo?.slot;
  const slotLabel = slot ? ALLOWED_DEVICE_LABELS[slot] : 'Authorized Device';

  return createPortal(
    <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-6 text-center border-b border-[#EFEAE4] relative">
          {isDenied && (
            <button
              type="button"
              onClick={dismissDeviceAuthError}
              className="absolute top-4 right-4 p-2 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-black/5 rounded-full transition-colors cursor-pointer"
              aria-label="Close notice"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div
            className={`w-12 h-12 mx-auto rounded-2xl border p-2 flex items-center justify-center shadow-xs mb-3 ${
              isDenied
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-amber-50 border-amber-200 text-[#E08828]'
            }`}
          >
            {isDenied ? (
              <ShieldAlert className="w-6 h-6" />
            ) : slot === 'samsung_s25_ultra' ? (
              <Smartphone className="w-6 h-6" />
            ) : (
              <Laptop className="w-6 h-6" />
            )}
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-2 ${
              isDenied
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-100 text-[#E08828] border-amber-200'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>{isDenied ? 'Device Access Denied' : '2-Device Security Lock'}</span>
          </div>

          <h3 className="text-lg font-extrabold text-[#1F1F1F] tracking-tight">
            {isDenied ? 'Unauthorized Device Blocked' : `Authorize ${slotLabel}`}
          </h3>
          <p className="text-xs text-[#8B8680] mt-1 max-w-xs mx-auto leading-relaxed">
            {isDenied
              ? deviceAuthInfo?.reason ||
                `Admin email ${RESTRICTED_ADMIN_EMAIL} is strictly restricted to Acer Nitro V16 AI and Samsung S25 Ultra only.`
              : `Account ${RESTRICTED_ADMIN_EMAIL} is strictly limited to 2 devices: Acer Nitro V16 AI and Samsung S25 Ultra.`}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {isDenied ? (
            <>
              <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 space-y-1.5">
                <p className="font-bold">Detected Device:</p>
                <p className="font-mono text-[11px] text-rose-800">
                  {deviceAuthInfo?.eligibility?.detectedLabel || 'Unknown / Unauthorized Device'}
                </p>
                <p className="text-[11px] text-rose-700 pt-1">
                  Sign in with a different email or open on one of the 2 authorized devices.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissDeviceAuthError}
                className="w-full py-3 px-4 bg-[#1F1F1F] hover:bg-black text-white font-bold text-xs rounded-2xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE4] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#8B8680] font-semibold">Detected Hardware:</span>
                  <span className="font-bold text-[#1F1F1F]">
                    {deviceAuthInfo?.eligibility?.detectedLabel || slotLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8B8680] font-semibold">Target Slot:</span>
                  <span className="font-bold text-[#E08828]">{slotLabel}</span>
                </div>
                <p className="text-[11px] text-[#6A645D] leading-relaxed pt-1 border-t border-[#EFEAE4]">
                  Once bound, only this exact physical browser/device and your second authorized device can access{' '}
                  <strong className="text-[#1F1F1F]">{RESTRICTED_ADMIN_EMAIL}</strong>. Only confirm if you are currently on your{' '}
                  <strong className="text-[#1F1F1F]">{slotLabel}</strong>.
                </p>
              </div>

              <button
                type="button"
                disabled={deviceAuthBusy}
                onClick={authorizeCurrentDeviceSlot}
                className="w-full py-3 px-4 bg-[#E08828] hover:bg-[#cc781f] disabled:opacity-60 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {deviceAuthBusy
                    ? 'Locking Device...'
                    : `Bind & Authorize This ${slotLabel}`}
                </span>
              </button>

              <button
                type="button"
                disabled={deviceAuthBusy}
                onClick={signOutUser}
                className="w-full py-2.5 px-4 bg-[#F9F7F5] hover:bg-[#EFEAE4] text-[#5A5551] font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Not My {slotLabel} — Sign Out</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
