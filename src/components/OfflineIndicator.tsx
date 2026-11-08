import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-90 flex items-center gap-2 rounded-xl bg-amber-500 border border-amber-600/20 px-3.5 py-2 text-xs font-black text-white shadow-lg animate-bounce">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
      </span>
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Cached data is being used.</span>
    </div>
  );
};
