import React, { useState, useEffect } from 'react';
import { Copy, Check, Plus, Trash2 } from 'lucide-react';

interface CustomColumn {
  id: string;
  name: string;
}

interface PageRow {
  id: string;
  name: string;
  path: string;
  isCustom?: boolean;
  customData?: Record<string, string>;
}

interface EventRow {
  id: string;
  hikeName: string;
  eventDate: string;
  itineraryLink: string;
  isCustom?: boolean;
  customData?: Record<string, string>;
}

interface CellWithCopyBoxProps {
  value: string;
  onChange?: (val: string) => void;
  isEditable?: boolean;
  placeholder?: string;
  copiedPath: string | null;
  onCopy: (val: string) => void;
}

// Helper to check if a value contains a URL/link
const containsLink = (val: string): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return /(https?:\/\/|www\.[a-zA-Z0-9]|(\b[a-zA-Z0-9-]+\.(com|np|org|net|io|co|dev|app)\b)|\/\?[a-zA-Z0-9_=&-]+)/i.test(trimmed);
};

// Standalone top-level component so React preserves input focus across typing
const CellWithCopyBox: React.FC<CellWithCopyBoxProps> = ({
  value,
  onChange,
  isEditable = true,
  placeholder = 'Type text or URL...',
  copiedPath,
  onCopy,
}) => {
  const isCopied = copiedPath === value && value.length > 0;
  const hasLink = containsLink(value);

  return (
    <div className="flex items-center justify-between gap-2 border border-[#E5E1DB] rounded-md px-2.5 py-1 bg-white focus-within:border-[#FF6600] focus-within:ring-1 focus-within:ring-[#FF6600]/30 shadow-2xs transition-all w-full min-w-0">
      {isEditable ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs font-mono text-[#1F1F1F] bg-transparent focus:outline-none whitespace-nowrap min-w-[120px]"
          style={{ width: `${Math.max((value || '').length + 1, 24)}ch` }}
        />
      ) : (
        <span className="flex-1 text-xs font-mono text-[#1F1F1F] select-all whitespace-nowrap">
          {value}
        </span>
      )}

      {hasLink && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(value);
          }}
          className="ml-auto p-1 text-[#8B8680] hover:text-[#1F1F1F] rounded hover:bg-stone-100 transition-colors shrink-0 cursor-pointer border border-[#E5E1DB]/70 bg-[#FAF8F5] inline-flex items-center justify-center"
          title="Copy link"
        >
          {isCopied ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Copy className="w-4 h-4 text-[#FF6600] shrink-0" />
          )}
        </button>
      )}
    </div>
  );
};

export const AdminLinkLibrary: React.FC<{ baseURL: string; treks: any[] }> = ({ baseURL, treks }) => {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  // ---------------- TABLE 1 STATE (Application Page Links) ----------------
  const [t1Cols, setT1Cols] = useState<CustomColumn[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_link_lib_t1_cols');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [t1Rows, setT1Rows] = useState<PageRow[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_link_lib_t1_rows');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', name: 'Rate and Review Form', path: '/?page=reviews' },
      { id: '2', name: 'Register Form', path: '/?page=register' },
      { id: '3', name: 'Payment Page', path: '/?page=payment' },
      { id: '4', name: 'Blogs & Stories', path: '/?page=blogs' },
      { id: '5', name: 'Trek Tips & Gear', path: '/?page=trek_tips' },
      { id: '6', name: 'Safety & Refund Policy', path: '/?page=safety_policy' },
      { id: '7', name: 'Request Private Trek', path: '/?page=request_private_trek' },
      { id: '8', name: 'Contact Support', path: '/?page=contact' },
    ];
  });

  // ---------------- TABLE 2 STATE (Event Specific Itinerary Links) ----------------
  const [t2Cols, setT2Cols] = useState<CustomColumn[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_link_lib_t2_cols');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [t2CustomRows, setT2CustomRows] = useState<EventRow[]>(() => {
    try {
      const saved = localStorage.getItem('wnw_link_lib_t2_rows');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist Table 1
  useEffect(() => {
    try {
      localStorage.setItem('wnw_link_lib_t1_cols', JSON.stringify(t1Cols));
    } catch {}
  }, [t1Cols]);

  useEffect(() => {
    try {
      localStorage.setItem('wnw_link_lib_t1_rows', JSON.stringify(t1Rows));
    } catch {}
  }, [t1Rows]);

  // Persist Table 2
  useEffect(() => {
    try {
      localStorage.setItem('wnw_link_lib_t2_cols', JSON.stringify(t2Cols));
    } catch {}
  }, [t2Cols]);

  useEffect(() => {
    try {
      localStorage.setItem('wnw_link_lib_t2_rows', JSON.stringify(t2CustomRows));
    } catch {}
  }, [t2CustomRows]);

  // Table 1 Handlers
  const handleAddT1Column = () => {
    const newCol: CustomColumn = {
      id: `col1_${Date.now()}`,
      name: `Column ${t1Cols.length + 1}`,
    };
    setT1Cols((prev) => [...prev, newCol]);
  };

  const handleDeleteT1Column = (colId: string) => {
    setT1Cols((prev) => prev.filter((c) => c.id !== colId));
    setT1Rows((prev) =>
      prev.map((r) => {
        if (!r.customData) return r;
        const next = { ...r.customData };
        delete next[colId];
        return { ...r, customData: next };
      })
    );
  };

  const handleAddT1Row = () => {
    const newRow: PageRow = {
      id: `row1_${Date.now()}`,
      name: `Custom Link ${t1Rows.length + 1}`,
      path: '/?page=custom',
      isCustom: true,
      customData: {},
    };
    setT1Rows((prev) => [...prev, newRow]);
  };

  const handleDeleteT1Row = (rowId: string) => {
    setT1Rows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Table 2 Handlers
  const handleAddT2Column = () => {
    const newCol: CustomColumn = {
      id: `col2_${Date.now()}`,
      name: `Column ${t2Cols.length + 1}`,
    };
    setT2Cols((prev) => [...prev, newCol]);
  };

  const handleDeleteT2Column = (colId: string) => {
    setT2Cols((prev) => prev.filter((c) => c.id !== colId));
  };

  const handleAddT2Row = () => {
    const newRow: EventRow = {
      id: `row2_${Date.now()}`,
      hikeName: `Custom Event ${t2CustomRows.length + 1}`,
      eventDate: new Date().toISOString().slice(0, 10),
      itineraryLink: `${baseURL}/?hike=custom Namaste! Here is the link please.`,
      isCustom: true,
      customData: {},
    };
    setT2CustomRows((prev) => [...prev, newRow]);
  };

  const handleDeleteT2Row = (rowId: string) => {
    setT2CustomRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Process upcoming treks into Table 2 rows with auto-generated Namaste text
  const upcomingTreks = treks.filter((trek) => {
    const d = Date.parse(trek.date || '');
    return !Number.isNaN(d) && d >= new Date().setHours(0, 0, 0, 0);
  });

  const trekEventRows: EventRow[] = upcomingTreks.map((t) => {
    const baseLink = `${baseURL}/?hike=${t.hike_number || t.id}`;
    return {
      id: `trek_${t.id}`,
      hikeName: `${t.name} (#${t.hike_number || t.id})`,
      eventDate: t.date || t.data?.hikeDate || 'TBA',
      itineraryLink: `${baseLink} Namaste! Here is the link please.`,
      isCustom: false,
      customData: {},
    };
  });

  const allT2Rows = [...trekEventRows, ...t2CustomRows];

  return (
    <div className="space-y-5 font-sans select-none">
      {/* ==================== TABLE 1: APPLICATION PAGE LINKS ==================== */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E1DB] shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wide">
              Application Page Links
            </h3>
            <p className="text-[11px] text-[#8B8680] mt-0.5">
              Add, edit, or copy links for general application pages
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddT1Row}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded text-[11px] font-bold shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 text-emerald-700 shrink-0" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onClick={handleAddT1Column}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200/80 rounded text-[11px] font-bold shadow-2xs hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Add Column</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-auto text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="border-b border-[#E5E1DB] text-[#8B8680] uppercase text-[10px] bg-[#FAF8F5]">
                <th className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[160px]">Page Name</th>
                <th className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[220px]">Page Link</th>
                {t1Cols.map((col) => (
                  <th key={col.id} className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[220px]">
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setT1Cols((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: val } : c)));
                        }}
                        className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-dashed border-[#8B8680]/40 focus:border-[#FF6600] focus:outline-none py-0.5 w-full"
                        title="Click to rename column header"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteT1Column(col.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer shrink-0 ml-1"
                        title="Delete column"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE5]">
              {t1Rows.map((row) => {
                const baseLink = row.path.startsWith('http') ? row.path : `${baseURL}${row.path.startsWith('/') ? '' : '/'}${row.path}`;
                const fullLink = row.isCustom ? baseLink : `${baseLink} Namaste! Here is the link please.`;

                return (
                  <tr key={row.id} className="hover:bg-[#FF6600]/15 transition-colors cursor-pointer">
                    {/* Page Name */}
                    <td className="py-1.5 px-2.5 font-semibold whitespace-nowrap">
                      {row.isCustom ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setT1Rows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: val } : r)));
                            }}
                            placeholder="Page Name..."
                            className="bg-white border border-[#E5E1DB] rounded px-2.5 py-1 text-xs font-semibold text-[#1F1F1F] focus:border-[#FF6600] focus:outline-none min-w-[150px]"
                            style={{ width: `${Math.max((row.name || '').length + 1, 16)}ch` }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteT1Row(row.id);
                            }}
                            className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="break-all whitespace-normal leading-relaxed">{row.name}</span>
                      )}
                    </td>

                    {/* Page Link with Independent Copy Box */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <CellWithCopyBox
                        value={row.isCustom ? row.path : fullLink}
                        onChange={(val) => {
                          if (row.isCustom) {
                            setT1Rows((prev) => prev.map((r) => (r.id === row.id ? { ...r, path: val } : r)));
                          }
                        }}
                        isEditable={Boolean(row.isCustom)}
                        placeholder="Link URL..."
                        copiedPath={copiedPath}
                        onCopy={copyToClipboard}
                      />
                    </td>

                    {/* Custom Columns Cells */}
                    {t1Cols.map((col) => {
                      const cellVal = row.customData?.[col.id] || '';
                      return (
                        <td key={col.id} className="py-1.5 px-2.5 whitespace-nowrap min-w-[220px]">
                          <CellWithCopyBox
                            value={cellVal}
                            onChange={(val) => {
                              setT1Rows((prev) =>
                                prev.map((r) => {
                                  if (r.id !== row.id) return r;
                                  return {
                                    ...r,
                                    customData: { ...(r.customData || {}), [col.id]: val },
                                  };
                                })
                              );
                            }}
                            isEditable={true}
                            placeholder="Type text or URL..."
                            copiedPath={copiedPath}
                            onCopy={copyToClipboard}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== TABLE 2: EVENT SPECIFIC ITINERARY LINKS ==================== */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E1DB] shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wide">
              Event Specific Itinerary Links
            </h3>
            <p className="text-[11px] text-[#8B8680] mt-0.5">
              Add, edit, or copy links for active trek itineraries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddT2Row}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded text-[11px] font-bold shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 text-emerald-700 shrink-0" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onClick={handleAddT2Column}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200/80 rounded text-[11px] font-bold shadow-2xs hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3 text-amber-700 shrink-0" />
              <span>Add Column</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-auto text-left text-xs border-collapse table-auto">
            <thead>
              <tr className="border-b border-[#E5E1DB] text-[#8B8680] uppercase text-[10px] bg-[#FAF8F5]">
                <th className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[180px]">Hike Name &amp; Number</th>
                <th className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[120px]">Event Date</th>
                <th className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[220px]">Itinerary Link</th>
                {t2Cols.map((col) => (
                  <th key={col.id} className="py-2 px-2.5 font-bold whitespace-nowrap min-w-[220px]">
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setT2Cols((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: val } : c)));
                        }}
                        className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-dashed border-[#8B8680]/40 focus:border-[#FF6600] focus:outline-none py-0.5 w-full"
                        title="Click to rename column header"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteT2Column(col.id)}
                        className="text-stone-400 hover:text-red-600 transition-colors p-0.5 cursor-pointer shrink-0 ml-1"
                        title="Delete column"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE5]">
              {allT2Rows.map((row) => {
                return (
                  <tr key={row.id} className="hover:bg-[#FF6600]/15 transition-colors cursor-pointer">
                    {/* Hike Name & Number */}
                    <td className="py-1.5 px-2.5 font-semibold whitespace-nowrap">
                      {row.isCustom ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={row.hikeName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setT2CustomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, hikeName: val } : r)));
                            }}
                            placeholder="Hike Name..."
                            className="bg-white border border-[#E5E1DB] rounded px-2.5 py-1 text-xs font-semibold text-[#1F1F1F] focus:border-[#FF6600] focus:outline-none min-w-[160px]"
                            style={{ width: `${Math.max((row.hikeName || '').length + 1, 18)}ch` }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteT2Row(row.id);
                            }}
                            className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="break-all whitespace-normal leading-relaxed">{row.hikeName}</span>
                      )}
                    </td>

                    {/* Event Date */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap font-medium text-[11px] text-[#5A5551]">
                      {row.isCustom ? (
                        <input
                          type="text"
                          value={row.eventDate}
                          onChange={(val) => {
                            const v = val.target.value;
                            setT2CustomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, eventDate: v } : r)));
                          }}
                          placeholder="Date..."
                          className="bg-white border border-[#E5E1DB] rounded px-2.5 py-1 text-xs text-[#5A5551] focus:border-[#FF6600] focus:outline-none min-w-[100px]"
                          style={{ width: `${Math.max((row.eventDate || '').length + 1, 12)}ch` }}
                        />
                      ) : (
                        <span>{row.eventDate}</span>
                      )}
                    </td>

                    {/* Itinerary Link with Independent Copy Box */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap">
                      <CellWithCopyBox
                        value={row.itineraryLink}
                        onChange={(val) => {
                          if (row.isCustom) {
                            setT2CustomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, itineraryLink: val } : r)));
                          }
                        }}
                        isEditable={Boolean(row.isCustom)}
                        placeholder="Itinerary link..."
                        copiedPath={copiedPath}
                        onCopy={copyToClipboard}
                      />
                    </td>

                    {/* Custom Columns Cells */}
                    {t2Cols.map((col) => {
                      const cellVal = row.customData?.[col.id] || '';
                      return (
                        <td key={col.id} className="py-1.5 px-2.5 whitespace-nowrap min-w-[220px]">
                          <CellWithCopyBox
                            value={cellVal}
                            onChange={(val) => {
                              setT2CustomRows((prev) =>
                                prev.map((r) => {
                                  if (r.id !== row.id) return r;
                                  return {
                                    ...r,
                                    customData: { ...(r.customData || {}), [col.id]: val },
                                  };
                                })
                              );
                            }}
                            isEditable={true}
                            placeholder="Type text or URL..."
                            copiedPath={copiedPath}
                            onCopy={copyToClipboard}
                          />
                        </td>
                      );
                    })}
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
