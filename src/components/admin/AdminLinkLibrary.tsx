import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Copy, Check, Plus, Trash2, Cloud, RefreshCw } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div
      className={`flex items-start justify-between gap-1.5 border rounded-md px-2 py-0.5 shadow-2xs transition-all w-full min-w-0 ${
        isEditable
          ? 'bg-white border-[#E5E1DB] focus-within:border-[#FF6600] focus-within:ring-1 focus-within:ring-[#FF6600]/30'
          : 'bg-stone-100/90 border-[#D8D3CC]'
      }`}
    >
      {isEditable ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="flex-1 text-xs font-mono text-[#1F1F1F] bg-transparent focus:outline-none break-all resize-none w-full min-w-0 leading-snug py-0.5 overflow-hidden block"
        />
      ) : (
        <span className="flex-1 text-xs font-mono text-[#1F1F1F] select-all break-all whitespace-normal leading-snug py-0.5 min-w-0 block">
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
          className="ml-auto p-1 text-[#8B8680] hover:text-[#1F1F1F] rounded hover:bg-stone-100 transition-colors shrink-0 cursor-pointer border border-[#E5E1DB]/70 bg-[#FAF8F5] inline-flex items-center justify-center self-start mt-0.5"
          title="Copy link"
        >
          {isCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[#FF6600] shrink-0" />
          )}
        </button>
      )}
    </div>
  );
};

export const AdminLinkLibrary: React.FC<{ baseURL: string; treks: any[] }> = ({ baseURL, treks }) => {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(false);

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
    const defaultRows: PageRow[] = [
      { id: '1', name: 'Rate and Review Form', path: '/?page=reviews' },
      { id: '2', name: 'Register Form', path: '/?page=register' },
      { id: '3', name: 'Payment Page', path: '/?page=payment' },
      { id: '4', name: 'Blogs & Stories', path: '/?page=blogs' },
      { id: '5', name: 'Trek Tips & Gear', path: '/?page=trek_tips' },
      { id: '6', name: 'Creator Guide', path: '/?page=creator_guide' },
      { id: '7', name: 'Safety & Refund Policy', path: '/?page=safety_policy' },
      { id: '8', name: 'Request Private Trek', path: '/?page=request_private_trek' },
      { id: '9', name: 'Contact Support', path: '/?page=contact' },
    ];

    try {
      const saved = localStorage.getItem('wnw_link_lib_t1_rows');
      if (saved) {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some((r: PageRow) => r.name === 'Creator Guide' || r.path?.includes('creator'))) {
            const index = parsed.findIndex((r: PageRow) => r.path?.includes('trek_tips') || r.name?.includes('Trek Tips'));
            const creatorRow: PageRow = { id: `row_cg_${Date.now()}`, name: 'Creator Guide', path: '/?page=creator_guide' };
            parsed = [...parsed];
            if (index !== -1) {
              parsed.splice(index + 1, 0, creatorRow);
            } else {
              parsed.push(creatorRow);
            }
          }
          return parsed;
        }
      }
    } catch {}
    return defaultRows;
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

  const [t2TrekCustomData, setT2TrekCustomData] = useState<Record<string, Record<string, string>>>(() => {
    try {
      const saved = localStorage.getItem('wnw_link_lib_t2_trek_data');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Flag to prevent echo saves when receiving remote updates
  const isSyncingFromRemoteRef = useRef(false);

  // Firestore Real-Time Listener
  useEffect(() => {
    const docRef = doc(db, 'pwa_metrics', 'link_library');
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          isSyncingFromRemoteRef.current = true;
          if (Array.isArray(data.t1Cols)) setT1Cols(data.t1Cols);
          if (Array.isArray(data.t1Rows)) {
            let rows = data.t1Rows;
            if (!rows.some((r: PageRow) => r.name === 'Creator Guide' || r.path?.includes('creator'))) {
              const index = rows.findIndex((r: PageRow) => r.path?.includes('trek_tips') || r.name?.includes('Trek Tips'));
              const creatorRow: PageRow = { id: `row_cg_${Date.now()}`, name: 'Creator Guide', path: '/?page=creator_guide' };
              rows = [...rows];
              if (index !== -1) {
                rows.splice(index + 1, 0, creatorRow);
              } else {
                rows.push(creatorRow);
              }
            }
            setT1Rows(rows);
          }
          if (Array.isArray(data.t2Cols)) setT2Cols(data.t2Cols);
          if (Array.isArray(data.t2CustomRows)) setT2CustomRows(data.t2CustomRows);
          if (data.t2TrekCustomData && typeof data.t2TrekCustomData === 'object') {
            setT2TrekCustomData(data.t2TrekCustomData);
          }
          setIsSynced(true);
          setTimeout(() => {
            isSyncingFromRemoteRef.current = false;
          }, 150);
        } else {
          setIsSynced(true);
        }
      },
      (err) => {
        console.warn('Firestore link library listener error:', err);
        setIsSynced(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Save changes to Firestore & local storage
  const saveToFirestore = useCallback(
    (
      nextT1Cols: CustomColumn[],
      nextT1Rows: PageRow[],
      nextT2Cols: CustomColumn[],
      nextT2CustomRows: EventRow[],
      nextT2TrekCustomData: Record<string, Record<string, string>>
    ) => {
      if (isSyncingFromRemoteRef.current) return;
      try {
        const docRef = doc(db, 'pwa_metrics', 'link_library');
        setDoc(
          docRef,
          {
            t1Cols: nextT1Cols,
            t1Rows: nextT1Rows,
            t2Cols: nextT2Cols,
            t2CustomRows: nextT2CustomRows,
            t2TrekCustomData: nextT2TrekCustomData,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        ).catch((e) => console.warn('Failed to save link library to Firestore:', e));
      } catch (e) {
        console.warn('Firestore setDoc error:', e);
      }
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem('wnw_link_lib_t1_cols', JSON.stringify(t1Cols));
      localStorage.setItem('wnw_link_lib_t1_rows', JSON.stringify(t1Rows));
      localStorage.setItem('wnw_link_lib_t2_cols', JSON.stringify(t2Cols));
      localStorage.setItem('wnw_link_lib_t2_rows', JSON.stringify(t2CustomRows));
      localStorage.setItem('wnw_link_lib_t2_trek_data', JSON.stringify(t2TrekCustomData));
    } catch {}

    if (!isSyncingFromRemoteRef.current) {
      const timer = setTimeout(() => {
        saveToFirestore(t1Cols, t1Rows, t2Cols, t2CustomRows, t2TrekCustomData);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [t1Cols, t1Rows, t2Cols, t2CustomRows, t2TrekCustomData, saveToFirestore]);

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
    setT2CustomRows((prev) =>
      prev.map((r) => {
        if (!r.customData) return r;
        const next = { ...r.customData };
        delete next[colId];
        return { ...r, customData: next };
      })
    );
    setT2TrekCustomData((prev) => {
      const updated = { ...prev };
      for (const rId in updated) {
        if (updated[rId]) {
          const next = { ...updated[rId] };
          delete next[colId];
          updated[rId] = next;
        }
      }
      return updated;
    });
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
    const rowId = `trek_${t.id}`;
    return {
      id: rowId,
      hikeName: `${t.name} (#${t.hike_number || t.id})`,
      eventDate: t.date || t.data?.hikeDate || 'TBA',
      itineraryLink: `${baseLink} Namaste! Here is the link please.`,
      isCustom: false,
      customData: t2TrekCustomData[rowId] || {},
    };
  });

  const allT2Rows = [...trekEventRows, ...t2CustomRows];

  return (
    <div className="space-y-5 font-sans select-none w-full max-w-full">
      {/* ==================== TABLE 1: APPLICATION PAGE LINKS ==================== */}
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E1DB] shadow-2xs space-y-3 w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#1F1F1F] uppercase tracking-wide">
                Application Page Links
              </h3>
              {isSynced && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" title="Real-time global cloud sync active">
                  <Cloud className="w-3 h-3 text-emerald-600" />
                  <span>Cloud Synced</span>
                </span>
              )}
            </div>
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

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="border-b border-[#E5E1DB] text-[#8B8680] uppercase text-[10px] bg-[#FAF8F5]">
                <th className="py-2 px-2 font-bold w-1/4">Page Name</th>
                <th className="py-2 px-2 font-bold">Page Link</th>
                {t1Cols.map((col) => (
                  <th key={col.id} className="py-2 px-2 font-bold">
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setT1Cols((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: val } : c)));
                        }}
                        className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-dashed border-[#8B8680]/40 focus:border-[#FF6600] focus:outline-none py-0.5 w-full min-w-0"
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
                    <td className="py-1.5 px-2 font-semibold align-top">
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
                            className="bg-white border border-[#E5E1DB] rounded px-2 py-1 text-xs font-semibold text-[#1F1F1F] focus:border-[#FF6600] focus:outline-none w-full min-w-0"
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
                        <span className="break-words whitespace-normal leading-relaxed text-xs text-[#1F1F1F] block py-1">
                          {row.name}
                        </span>
                      )}
                    </td>

                    {/* Page Link with Independent Copy Box */}
                    <td className="py-1.5 px-2 align-top">
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
                        <td key={col.id} className="py-1.5 px-2 align-top">
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
      <div className="bg-white p-3.5 rounded-xl border border-[#E5E1DB] shadow-2xs space-y-3 w-full overflow-hidden">
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

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead>
              <tr className="border-b border-[#E5E1DB] text-[#8B8680] uppercase text-[10px] bg-[#FAF8F5]">
                <th className="py-2 px-2 font-bold w-1/5">Hike Name &amp; Number</th>
                <th className="py-2 px-2 font-bold w-24">Event Date</th>
                <th className="py-2 px-2 font-bold">Itinerary Link</th>
                {t2Cols.map((col) => (
                  <th key={col.id} className="py-2 px-2 font-bold">
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setT2Cols((prev) => prev.map((c) => (c.id === col.id ? { ...c, name: val } : c)));
                        }}
                        className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-[#1F1F1F] border-b border-dashed border-[#8B8680]/40 focus:border-[#FF6600] focus:outline-none py-0.5 w-full min-w-0"
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
                    <td className="py-1.5 px-2 font-semibold align-top">
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
                            className="bg-white border border-[#E5E1DB] rounded px-2 py-1 text-xs font-semibold text-[#1F1F1F] focus:border-[#FF6600] focus:outline-none w-full min-w-0"
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
                        <span className="break-words whitespace-normal leading-relaxed text-xs text-[#1F1F1F] block py-1">
                          {row.hikeName}
                        </span>
                      )}
                    </td>

                    {/* Event Date */}
                    <td className="py-1.5 px-2 align-top font-medium text-[11px] text-[#5A5551]">
                      {row.isCustom ? (
                        <input
                          type="text"
                          value={row.eventDate}
                          onChange={(val) => {
                            const v = val.target.value;
                            setT2CustomRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, eventDate: v } : r)));
                          }}
                          placeholder="Date..."
                          className="bg-white border border-[#E5E1DB] rounded px-2 py-1 text-xs text-[#5A5551] focus:border-[#FF6600] focus:outline-none w-full min-w-0"
                        />
                      ) : (
                        <span className="block py-1">{row.eventDate}</span>
                      )}
                    </td>

                    {/* Itinerary Link with Independent Copy Box */}
                    <td className="py-1.5 px-2 align-top">
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
                        <td key={col.id} className="py-1.5 px-2 align-top">
                          <CellWithCopyBox
                            value={cellVal}
                            onChange={(val) => {
                              if (row.isCustom) {
                                setT2CustomRows((prev) =>
                                  prev.map((r) => {
                                    if (r.id !== row.id) return r;
                                    return {
                                      ...r,
                                      customData: { ...(r.customData || {}), [col.id]: val },
                                    };
                                  })
                                );
                              } else {
                                setT2TrekCustomData((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...(prev[row.id] || {}),
                                    [col.id]: val,
                                  },
                                }));
                              }
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

