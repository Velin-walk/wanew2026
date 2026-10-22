import React from 'react';
import { Copy, Link2, FileText, Calendar } from 'lucide-react';

export const AdminLinkLibrary: React.FC<{ baseURL: string; treks: any[] }> = ({ baseURL, treks }) => {
  const pages = [
    { name: 'Rate and Review Form', path: '/?page=reviews' },
    { name: 'Register Form', path: '/?tab=treks' },
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
    alert('Link copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Table 1: General Pages */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E1DB] shadow-2xs">
        <h3 className="text-sm font-bold text-[#1F1F1F] mb-4">Application Page Links</h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#F0EBE5] text-[#8B8680] uppercase">
              <th className="py-2">Page Name</th>
              <th className="py-2">Page Link</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EBE5]">
            {pages.map((page) => {
              const fullLink = `${baseURL}${page.path}`;
              return (
                <tr key={page.name}>
                  <td className="py-3 font-semibold text-[#1F1F1F]">{page.name}</td>
                  <td className="py-3 text-[#5A5551] font-mono">{fullLink}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => copyToClipboard(fullLink)}
                      className="p-1.5 hover:bg-[#F9F7F5] rounded-lg text-[#8B8680] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Table 2: Event Specific */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E1DB] shadow-2xs">
        <h3 className="text-sm font-bold text-[#1F1F1F] mb-4">Event Specific Itinerary Links</h3>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#F0EBE5] text-[#8B8680] uppercase">
              <th className="py-2">Hike Name & Number</th>
              <th className="py-2">Itinerary Link</th>
              <th className="py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EBE5]">
            {upcomingTreks.map((trek) => {
              const hikeLink = `${baseURL}/?hike=${trek.hike_number || trek.id}`;
              return (
                <tr key={trek.id}>
                  <td className="py-3 font-semibold text-[#1F1F1F]">{trek.name} (#{trek.hike_number})</td>
                  <td className="py-3 text-[#5A5551] font-mono">{hikeLink}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => copyToClipboard(hikeLink)}
                      className="p-1.5 hover:bg-[#F9F7F5] rounded-lg text-[#8B8680] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
