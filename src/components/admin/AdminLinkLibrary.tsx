import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const AdminLinkLibrary: React.FC<{ baseURL: string; treks: any[] }> = ({ baseURL, treks }) => {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const pages = [
    { name: 'Rate and Review Form', path: '/?page=reviews' },
    { name: 'Register Form', path: '/?page=register' },
    { name: 'Payment Page', path: '/?page=payment' },
    { name: 'Blogs & Stories', path: '/?page=blogs' },
    { name: 'Trek Tips & Gear', path: '/?page=trek_tips' },
    { name: 'Safety & Refund Policy', path: '/?page=safety_policy' },
    { name: 'Request Private Trek', path: '/?page=request_private_trek' },
    { name: 'Contact Support', path: '/?page=contact' },
  ];

  const upcomingTreks = treks.filter(trek => {
    const d = Date.parse(trek.date || '');
    return !Number.isNaN(d) && d >= new Date().setHours(0, 0, 0, 0);
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Table 1: General Pages */}
      <div className="bg-white p-3 rounded-xl border border-[#E5E1DB] shadow-2xs">
        <h3 className="text-xs font-bold text-[#1F1F1F] mb-2 uppercase tracking-wide">Application Page Links</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="border-b border-[#E5E1DB] text-[#8B8680] uppercase text-[10px] bg-[#FAF8F5]">
                <th className="py-1 px-2 font-bold w-px whitespace-nowrap">Page Name</th>
                <th className="py-1 px-2 font-bold w-px whitespace-nowrap">Page Link</th>
                <th className="py-1 px-2 font-bold text-left whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE5]">
              {pages.map((page) => {
                const fullLink = `${baseURL}${page.path}`;
                const isCopied = copiedPath === fullLink;
                return (
                  <tr key={page.name} className="hover:bg-[#FF6600]/15 transition-colors cursor-pointer">
                    <td className="py-1 px-2 font-semibold whitespace-nowrap w-px">{page.name}</td>
                    <td className="py-1 px-2 font-mono text-[11px] whitespace-nowrap w-px select-all text-[#5A5551]">{fullLink}</td>
                    <td className="py-1 px-2 text-left whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(fullLink);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#E5E1DB] rounded text-[11px] font-bold text-[#1F1F1F] shadow-2xs hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Copy link"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <Copy className="w-3 h-3 text-[#8B8680] shrink-0" />}
                        <span className="text-[#1F1F1F]">{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Event Specific */}
      <div className="bg-white p-3 rounded-xl border border-[#E5E1DB] shadow-2xs">
        <h3 className="text-xs font-bold text-[#1F1F1F] mb-2 uppercase tracking-wide">Event Specific Itinerary Links</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="border-b border-[#E5E1DB] text-[#8B8680] uppercase text-[10px] bg-[#FAF8F5]">
                <th className="py-1 px-2 font-bold w-px whitespace-nowrap">Hike Name &amp; Number</th>
                <th className="py-1 px-2 font-bold w-px whitespace-nowrap">Event Date</th>
                <th className="py-1 px-2 font-bold w-px whitespace-nowrap">Itinerary Link</th>
                <th className="py-1 px-2 font-bold text-left whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE5]">
              {upcomingTreks.map((trek) => {
                const hikeLink = `${baseURL}/?hike=${trek.hike_number || trek.id}`;
                const isCopied = copiedPath === hikeLink;
                return (
                  <tr key={trek.id} className="hover:bg-[#FF6600]/15 transition-colors cursor-pointer">
                    <td className="py-1 px-2 font-semibold whitespace-nowrap w-px">
                      {trek.name} (#{trek.hike_number})
                    </td>
                    <td className="py-1 px-2 whitespace-nowrap font-medium text-[11px] w-px text-[#5A5551]">
                      {trek.date || trek.data?.hikeDate || 'TBA'}
                    </td>
                    <td className="py-1 px-2 font-mono text-[11px] whitespace-nowrap w-px select-all text-[#5A5551]">{hikeLink}</td>
                    <td className="py-1 px-2 text-left whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(hikeLink);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-[#E5E1DB] rounded text-[11px] font-bold text-[#1F1F1F] shadow-2xs hover:bg-stone-100 transition-colors cursor-pointer"
                        title="Copy link"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <Copy className="w-3 h-3 text-[#8B8680] shrink-0" />}
                        <span className="text-[#1F1F1F]">{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
