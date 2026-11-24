import React, { useState, useEffect } from 'react';
import { Shield, Users, UserPlus, Trash2, CheckCircle, AlertCircle, ShieldAlert, KeyRound, Laptop, Smartphone, Lock, Unlink } from 'lucide-react';
import {
  getFullAdminEmails,
  getCoordinatorEmails,
  addFullAdminEmail,
  removeFullAdminEmail,
  addCoordinatorEmail,
  removeCoordinatorEmail,
  DEFAULT_FULL_ADMIN_EMAILS
} from '../../adminUtils';
import { useAuth } from '../../context/AuthContext';
import {
  isRestrictedAdminEmail,
  ALLOWED_DEVICE_LABELS,
  AllowedDeviceSlot,
  getRestrictedAdminActiveStatus,
} from '../../services/deviceLockService';

interface AdminAccessManagerProps {
  currentUserEmail: string;
}

export function AdminAccessManager({ currentUserEmail }: AdminAccessManagerProps) {
  const { deviceAuthInfo, deviceAuthBusy, unbindDeviceSlot } = useAuth();
  const [fullAdmins, setFullAdmins] = useState<string[]>([]);
  const [coordinators, setCoordinators] = useState<string[]>([]);
  
  const [newFullAdminEmail, setNewFullAdminEmail] = useState('');
  const [newCoordinatorEmail, setNewCoordinatorEmail] = useState('');
  
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const isRestrictedAccount = isRestrictedAdminEmail(currentUserEmail);
  const activeLockStatus = getRestrictedAdminActiveStatus();
  const lockedSlots = deviceAuthInfo?.slots || activeLockStatus.slots;

  const reloadEmails = () => {
    setFullAdmins(getFullAdminEmails());
    setCoordinators(getCoordinatorEmails());
  };

  useEffect(() => {
    reloadEmails();
    window.addEventListener('wnw-admin-roles-updated', reloadEmails);
    return () => {
      window.removeEventListener('wnw-admin-roles-updated', reloadEmails);
    };
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedback({ text, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleAddFullAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newFullAdminEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      showFeedback('Please enter a valid email address.', 'error');
      return;
    }
    if (fullAdmins.includes(email)) {
      showFeedback(`${email} is already a Full Admin.`, 'error');
      return;
    }

    const success = addFullAdminEmail(email);
    if (success) {
      setNewFullAdminEmail('');
      reloadEmails();
      showFeedback(`Added ${email} to Full Administrators!`, 'success');
    } else {
      showFeedback('Failed to add email. Please check format.', 'error');
    }
  };

  const handleRemoveFullAdmin = (email: string) => {
    if (email.toLowerCase() === currentUserEmail.toLowerCase()) {
      if (!window.confirm('Warning: You are about to remove your own Full Admin access. Are you sure?')) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to remove ${email} from Full Administrators?`)) {
        return;
      }
    }

    removeFullAdminEmail(email);
    reloadEmails();
    showFeedback(`Removed ${email} from Full Administrators.`, 'success');
  };

  const handleAddCoordinator = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newCoordinatorEmail.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      showFeedback('Please enter a valid email address.', 'error');
      return;
    }
    if (coordinators.includes(email)) {
      showFeedback(`${email} is already in Team Coordinators.`, 'error');
      return;
    }

    const success = addCoordinatorEmail(email);
    if (success) {
      setNewCoordinatorEmail('');
      reloadEmails();
      showFeedback(`Added ${email} to Team Coordinators!`, 'success');
    } else {
      showFeedback('Failed to add email. Please check format.', 'error');
    }
  };

  const handleRemoveCoordinator = (email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from Team Coordinators?`)) {
      return;
    }

    removeCoordinatorEmail(email);
    reloadEmails();
    showFeedback(`Removed ${email} from Team Coordinators.`, 'success');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E1DB] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#F0EBE5] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1F1F1F] tracking-tight">
                Admin & Coordinator Access Management
              </h2>
              <p className="text-xs text-[#8B8680] font-medium mt-0.5">
                Manage accounts authorized to access the Admin Panel and Coordinator Hub
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#FAF8F5] px-3.5 py-2 rounded-2xl border border-[#EFEAE4]">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-[#5A5551]">
              Logged in as: <strong className="text-[#1F1F1F]">{currentUserEmail}</strong>
            </span>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border transition-all animate-in fade-in zoom-in-95 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* FULL ADMIN MANAGEMENT CARD */}
          <div className="bg-[#FAF8F5] rounded-2xl p-5 sm:p-6 border border-[#EFEAE4] space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1DB] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-black text-[#1F1F1F] uppercase tracking-wider">
                    Level 1: Full Administrators
                  </h3>
                </div>
                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-lg">
                  {fullAdmins.length} Accounts
                </span>
              </div>

              <p className="text-xs text-[#6A645D] leading-relaxed">
                Full Admins have complete access to all tabs, itinerary editing, sales, roster controls, and system configurations.
              </p>

              {/* Add Full Admin Form */}
              <form onSubmit={handleAddFullAdmin} className="space-y-2">
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider">
                  Add New Full Admin
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newFullAdminEmail}
                    onChange={(e) => setNewFullAdminEmail(e.target.value)}
                    placeholder="admin.email@example.com"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Full Admin Email List */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider">
                  Authorized Full Admin Emails
                </label>
                <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {fullAdmins.length === 0 ? (
                    <div className="p-4 bg-white rounded-xl text-center text-xs text-[#8B8680] border border-dashed border-[#E5E1DB]">
                      No full admin emails registered.
                    </div>
                  ) : (
                    fullAdmins.map((email) => {
                      const isSelf = email.toLowerCase() === currentUserEmail.toLowerCase();
                      const isDefault = DEFAULT_FULL_ADMIN_EMAILS.includes(email.toLowerCase());
                      return (
                        <div
                          key={email}
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E5E1DB] text-xs font-bold transition-all hover:border-amber-300"
                        >
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate text-[#1F1F1F] font-mono">{email}</span>
                            {isSelf && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                                You
                              </span>
                            )}
                            {isDefault && (
                              <span className="bg-stone-100 text-stone-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 hidden sm:inline-block">
                                Default
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFullAdmin(email)}
                            className="p-1.5 text-[#8B8680] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Remove Full Admin Access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TEAM COORDINATOR MANAGEMENT CARD */}
          <div className="bg-[#FAF8F5] rounded-2xl p-5 sm:p-6 border border-[#EFEAE4] space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E1DB] pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-[#1F1F1F] uppercase tracking-wider">
                    Level 2: Team Coordinators
                  </h3>
                </div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-1 rounded-lg">
                  {coordinators.length} Accounts
                </span>
              </div>

              <p className="text-xs text-[#6A645D] leading-relaxed">
                Team Coordinators are restricted strictly to the <strong>Coordinator Hub</strong> tab for managing event logistics and rosters.
              </p>

              {/* Add Coordinator Form */}
              <form onSubmit={handleAddCoordinator} className="space-y-2">
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider">
                  Add New Team Coordinator
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newCoordinatorEmail}
                    onChange={(e) => setNewCoordinatorEmail(e.target.value)}
                    placeholder="coordinator.email@example.com"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-[#E5E1DB] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {/* Coordinator Email List */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-bold text-[#5A5551] uppercase tracking-wider">
                  Authorized Team Coordinator Emails
                </label>
                <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {coordinators.length === 0 ? (
                    <div className="p-4 bg-white rounded-xl text-center text-xs text-[#8B8680] border border-dashed border-[#E5E1DB]">
                      No coordinator emails added yet. Enter an email above to grant Coordinator Hub access.
                    </div>
                  ) : (
                    coordinators.map((email) => {
                      const isSelf = email.toLowerCase() === currentUserEmail.toLowerCase();
                      return (
                        <div
                          key={email}
                          className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E5E1DB] text-xs font-bold transition-all hover:border-indigo-300"
                        >
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="truncate text-[#1F1F1F] font-mono">{email}</span>
                            {isSelf && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                                You
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCoordinator(email)}
                            className="p-1.5 text-[#8B8680] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Remove Coordinator Access"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {false && isRestrictedAccount && (
          <div className="mt-6 bg-[#FAF8F5] rounded-2xl p-5 sm:p-6 border border-[#EFEAE4] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1DB] pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#E08828]" />
                <div>
                  <h3 className="text-sm font-black text-[#1F1F1F] uppercase tracking-wider">
                    2-Device Hardware Lock (walknepalwalk@gmail.com)
                  </h3>
                  <p className="text-[11px] text-[#6A645D]">
                    Strictly restricted to your 2 authorized devices only: Acer Nitro V16 AI and Samsung S25 Ultra.
                  </p>
                </div>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg self-start sm:self-auto">
                Enforced
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['acer_nitro_v16_ai', 'samsung_s25_ultra'] as AllowedDeviceSlot[]).map((slotKey) => {
                const record = lockedSlots?.[slotKey];
                const isCurrent = (deviceAuthInfo?.slot || activeLockStatus.slot) === slotKey;
                const Icon = slotKey === 'samsung_s25_ultra' ? Smartphone : Laptop;
                return (
                  <div
                    key={slotKey}
                    className={`p-4 rounded-xl border bg-white flex items-center justify-between gap-3 ${
                      isCurrent ? 'border-emerald-300' : 'border-[#E5E1DB]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF8F5] border border-[#EFEAE4] flex items-center justify-center text-[#1F1F1F] shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-[#1F1F1F]">
                            {ALLOWED_DEVICE_LABELS[slotKey]}
                          </span>
                          {isCurrent && (
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                              This Device
                            </span>
                          )}
                        </div>
                        {record ? (
                          <p className="text-[11px] text-[#6A645D] font-mono truncate">
                            Locked • {record.deviceId}
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 font-semibold">
                            Unbound (Waiting for first login on this device)
                          </p>
                        )}
                      </div>
                    </div>

                    {record && (
                      <button
                        type="button"
                        disabled={deviceAuthBusy}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Unbind ${ALLOWED_DEVICE_LABELS[slotKey]} (${record.deviceId})? You will need to re-authorize it on that device.`
                            )
                          ) {
                            return;
                          }
                          try {
                            await unbindDeviceSlot(slotKey);
                            showFeedback(`Unbound ${ALLOWED_DEVICE_LABELS[slotKey]} slot.`, 'success');
                          } catch (err: any) {
                            showFeedback(err?.message || 'Failed to unbind device slot.', 'error');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                        title="Unbind this device slot"
                      >
                        <Unlink className="w-3 h-3" />
                        <span>Unbind</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
