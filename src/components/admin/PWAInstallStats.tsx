import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Smartphone,
  Download,
  Apple,
  Monitor,
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  Info,
  Activity,
  HardDrive
} from 'lucide-react';

interface PWAEventLog {
  id: string;
  method?: string;
  platform?: string;
  userAgent?: string;
  deviceType?: 'ios' | 'android' | 'desktop' | string;
  installedAt?: string;
}

interface PWAMetricsSummary {
  totalInstalls: number;
  lastInstalledAt?: string;
  iosInstalls?: number;
  androidInstalls?: number;
  desktopInstalls?: number;
  appinstalled_eventCount?: number;
  standalone_launchCount?: number;
}

export const PWAInstallStats: React.FC = () => {
  const [summary, setSummary] = useState<PWAMetricsSummary>({
    totalInstalls: 0,
    iosInstalls: 0,
    androidInstalls: 0,
    desktopInstalls: 0,
  });
  const [logs, setLogs] = useState<PWAEventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStandaloneDevice, setIsStandaloneDevice] = useState(false);
  const [localDeviceCount, setLocalDeviceCount] = useState(0);

  // Check current device standalone state
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandaloneDevice(isStandalone);

    try {
      const cur = Number(localStorage.getItem('wnw_pwa_install_count')) || 0;
      setLocalDeviceCount(cur);
    } catch {}
  }, []);

  // Listen to live metrics summary & recent logs
  useEffect(() => {
    let unsubscribeSummary: (() => void) | undefined;
    let unsubscribeLogs: (() => void) | undefined;

    const setupListeners = () => {
      setLoading(true);

      // 1. Real-time metrics summary document
      try {
        const summaryDocRef = doc(db, 'pwa_metrics', 'summary');
        unsubscribeSummary = onSnapshot(
          summaryDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as PWAMetricsSummary;
              setSummary({
                totalInstalls: data.totalInstalls || 0,
                lastInstalledAt: data.lastInstalledAt,
                iosInstalls: data.iosInstalls || 0,
                androidInstalls: data.androidInstalls || 0,
                desktopInstalls: data.desktopInstalls || 0,
                appinstalled_eventCount: data.appinstalled_eventCount || 0,
                standalone_launchCount: data.standalone_launchCount || 0,
              });
            }
            setLoading(false);
          },
          () => {
            setLoading(false);
          }
        );
      } catch {
        setLoading(false);
      }

      // 2. Real-time recent install logs
      try {
        const q = query(
          collection(db, 'pwa_installs'),
          orderBy('installedAt', 'desc'),
          limit(50)
        );
        unsubscribeLogs = onSnapshot(
          q,
          (querySnapshot) => {
            const items: PWAEventLog[] = [];
            querySnapshot.forEach((docSnap) => {
              items.push({
                id: docSnap.id,
                ...(docSnap.data() as Omit<PWAEventLog, 'id'>),
              });
            });
            setLogs(items);
            setLoading(false);
          },
          () => {
            setLoading(false);
          }
        );
      } catch {
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      if (unsubscribeSummary) unsubscribeSummary();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      // Direct fetch of summary
      const summarySnap = await getDoc(doc(db, 'pwa_metrics', 'summary'));
      if (summarySnap.exists()) {
        const data = summarySnap.data() as PWAMetricsSummary;
        setSummary({
          totalInstalls: data.totalInstalls || 0,
          lastInstalledAt: data.lastInstalledAt,
          iosInstalls: data.iosInstalls || 0,
          androidInstalls: data.androidInstalls || 0,
          desktopInstalls: data.desktopInstalls || 0,
          appinstalled_eventCount: data.appinstalled_eventCount || 0,
          standalone_launchCount: data.standalone_launchCount || 0,
        });
      }

      // Direct fetch of recent events
      const q = query(
        collection(db, 'pwa_installs'),
        orderBy('installedAt', 'desc'),
        limit(50)
      );
      const querySnap = await getDocs(q);
      const items: PWAEventLog[] = [];
      querySnap.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as Omit<PWAEventLog, 'id'>) });
      });
      setLogs(items);
    } catch (err) {
      console.error('Failed refreshing PWA metrics:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleLogTestInstall = async () => {
    setRefreshing(true);
    try {
      const now = new Date().toISOString();
      const userAgent = window.navigator.userAgent || '';
      const platform = window.navigator.platform || '';
      const isIOS = /iphone|ipad|ipod/.test(userAgent.toLowerCase());
      const isAndroid = /android/.test(userAgent.toLowerCase());
      const deviceType = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

      await addDoc(collection(db, 'pwa_installs'), {
        method: 'admin_test_ping',
        platform,
        userAgent,
        deviceType,
        installedAt: now,
        timestamp: serverTimestamp(),
      });

      await setDoc(
        doc(db, 'pwa_metrics', 'summary'),
        {
          totalInstalls: increment(1),
          lastInstalledAt: now,
          [`${deviceType}Installs`]: increment(1),
          admin_test_pingCount: increment(1),
        },
        { merge: true }
      );

      await handleManualRefresh();
    } catch (err) {
      console.error('Error logging test install:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const totalCalculated = Math.max(
    summary.totalInstalls,
    logs.length,
    (summary.iosInstalls || 0) + (summary.androidInstalls || 0) + (summary.desktopInstalls || 0)
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E5E1DB] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#1F1F1F]">PWA Installations &amp; App Telemetry</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Analytics
              </span>
            </div>
            <p className="text-xs text-[#8B8680] font-medium mt-0.5">
              Tracks users who have installed Walk Nepal Walk to their home screens (iOS Safari, Android WebAPK, Desktop PWA).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleLogTestInstall}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            title="Log a test installation ping from this browser"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Test Ping</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Installs Card */}
        <div className="bg-linear-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Smartphone className="w-24 h-24 -mr-6 -mt-6" />
          </div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                Total Installations
              </span>
              <div className="p-1.5 rounded-lg bg-white/20">
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-3xl sm:text-4xl font-black tracking-tight">
                {loading ? '...' : totalCalculated}
              </div>
              <div className="mt-1 text-[11px] text-emerald-100 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                <span>Last: {formatRelativeTime(summary.lastInstalledAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Android / Chrome Installs */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Android / Chrome
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-stone-900">
              {summary.androidInstalls || 0}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Native WebAPK / Android home screen prompts
            </p>
          </div>
        </div>

        {/* iOS / Safari Installs */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              iOS / Apple Safari
            </span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Apple className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-stone-900">
              {summary.iosInstalls || 0}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              iPhone / iPad Add to Home Screen
            </p>
          </div>
        </div>

        {/* Desktop / Standalone */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5E1DB] shadow-2xs relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Desktop &amp; Laptop
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Monitor className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-stone-900">
              {summary.desktopInstalls || 0}
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Chrome / Edge / Safari Desktop app installs
            </p>
          </div>
        </div>
      </div>

      {/* Admin Device Diagnostic Info */}
      <div className="bg-[#FAF8F5] border border-[#EFEAE4] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white border border-[#E5E1DB] text-stone-700 shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-stone-800">Your Current Session</h4>
              {isStandaloneDevice ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> Standalone PWA Window
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  <Info className="w-3 h-3" /> Browser Tab Mode
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Platform: <span className="font-mono text-stone-700">{navigator.platform || 'Unknown'}</span> •
              Local Device Installs Logged: <strong className="text-stone-800">{localDeviceCount}</strong>
            </p>
          </div>
        </div>
        <div className="text-[11px] text-stone-500 bg-white px-3 py-1.5 rounded-xl border border-stone-200">
          Offline Service Worker: <span className="text-emerald-700 font-bold">Active (Cache-First)</span>
        </div>
      </div>

      {/* Installation Activity Log Table */}
      <div className="bg-white rounded-3xl border border-[#E5E1DB] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#EFEAE4] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-black text-stone-900 tracking-tight">Recent Installation Log</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold">
              {logs.length} logged
            </span>
          </div>
          <span className="text-[11px] text-stone-400">Latest 50 events</span>
        </div>

        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            <span>Loading PWA installation records...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Smartphone className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-xs font-bold text-stone-700">No installation records found yet</p>
            <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
              When users tap &quot;Install App&quot; or launch the PWA from their home screen, telemetry events will automatically appear here.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogTestInstall}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Log First Test Install
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F5] text-stone-600 uppercase text-[10px] font-black tracking-wider border-b border-[#EFEAE4]">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Device / OS</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">User Agent Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((log) => {
                  const isIOS = log.deviceType === 'ios' || /iphone|ipad/i.test(log.userAgent || '');
                  const isAndroid = log.deviceType === 'android' || /android/i.test(log.userAgent || '');

                  return (
                    <tr key={log.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-stone-700 font-medium">
                        {formatRelativeTime(log.installedAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-stone-900 flex items-center gap-1.5">
                          {isIOS ? (
                            <Apple className="w-3.5 h-3.5 text-stone-700" />
                          ) : isAndroid ? (
                            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span>{log.platform || (isIOS ? 'iOS Device' : isAndroid ? 'Android' : 'Desktop')}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            isIOS
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : isAndroid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {log.deviceType || (isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop')}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-mono text-[10px] font-bold">
                          {log.method || 'installed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-400 font-mono text-[10px] max-w-[280px] truncate" title={log.userAgent}>
                        {log.userAgent || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
