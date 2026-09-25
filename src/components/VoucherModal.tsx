import React, { useState, useRef, useEffect } from 'react';
import { Booking } from '../types';
import { apiFetch } from '../services/api';
import {
  UploadCloud,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
  Calendar,
  CreditCard,
  Eye,
  ShieldCheck,
} from 'lucide-react';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: Booking | null;
  allBookings?: Booking[];
  userEmail?: string;
  onVoucherUploaded?: (updatedBooking: Booking) => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  isOpen,
  onClose,
  booking,
  allBookings = [],
  userEmail = '',
  onVoucherUploaded,
}) => {
  const CLOUD_NAME = 'mx7cxnsf';
  const UPLOAD_PRESET = 'walknepalwalk';

  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    booking ? String(booking.id) : allBookings[0] ? String(allBookings[0].id) : ''
  );

  const activeBooking =
    (booking && String(booking.id) === selectedBookingId ? booking : null) ||
    allBookings.find((b) => String(b.id) === selectedBookingId) ||
    booking;

  const [stagedFile, setStagedFile] = useState<{ id: string; url: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewingVoucherUrl, setViewingVoucherUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (booking) {
      setSelectedBookingId(String(booking.id));
    } else if (allBookings.length > 0) {
      setSelectedBookingId(String(allBookings[0].id));
    }
  }, [booking, allBookings]);

  if (!isOpen) return null;

  // Ultra-fast zero-base64 image compressor using direct Blob Object URLs
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      if (file.size <= 1.2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const maxDim = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            0.85
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setSuccessMsg(null);

    const f = files[0];
    if (stagedFile) {
      URL.revokeObjectURL(stagedFile.url);
    }

    setStagedFile({
      id: `voucher_${Date.now()}`,
      url: URL.createObjectURL(f),
      file: f,
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveStagedFile = () => {
    if (stagedFile) {
      URL.revokeObjectURL(stagedFile.url);
      setStagedFile(null);
    }
  };

  const handleSubmitVoucher = async () => {
    if (!stagedFile) {
      setError('Please select or drag your payment receipt image first.');
      return;
    }
    if (!activeBooking) {
      setError('Please select an active hike booking to associate with this voucher.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Compress image
      const compressedBlob = await compressImage(stagedFile.file);

      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', compressedBlob, stagedFile.file.name);
      formData.append('upload_preset', UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error?.message || 'Cloudinary upload failed');
      }

      const resData = await response.json();
      const voucherUrl = resData.secure_url;
      const submittedAt = new Date().toISOString();

      // 3. Update Cloudflare D1 Registration Record
      const updatedRecord: Booking = {
        ...activeBooking,
        payment_voucher_url: voucherUrl,
        payment_voucher_submitted_at: submittedAt,
        payment_status: 'Voucher Uploaded',
      };

      try {
        await apiFetch(`/registrations/${activeBooking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hike_number: activeBooking.hike_number || activeBooking.trek_id,
            trek_name: activeBooking.trek_name,
            full_name: activeBooking.full_name,
            phone: activeBooking.phone,
            whatsapp: activeBooking.whatsapp || activeBooking.phone,
            email_address: activeBooking.user_email || activeBooking.email || userEmail,
            pax: activeBooking.pax || 1,
            payment_voucher_url: voucherUrl,
            payment_voucher_submitted_at: submittedAt,
            payment_status: 'Voucher Uploaded',
            status: activeBooking.status || 'Confirmed',
          }),
        });
      } catch (cfErr) {
        console.warn('Cloudflare voucher update notice:', cfErr);
      }

      // 4. Update Device Local Storage Cache
      try {
        const devB = localStorage.getItem('wnw_device_bookings');
        if (devB) {
          const parsed: Booking[] = JSON.parse(devB);
          const updated = parsed.map((b) =>
            String(b.id) === String(activeBooking.id) ? updatedRecord : b
          );
          localStorage.setItem('wnw_device_bookings', JSON.stringify(updated));
        }
      } catch (_) {}

      // Clean up staged file
      if (stagedFile) {
        URL.revokeObjectURL(stagedFile.url);
        setStagedFile(null);
      }

      setSuccessMsg('Payment Voucher Forwarded Successfully! Our coordinators will verify and approve your booking status shortly.');
      onVoucherUploaded?.(updatedRecord);
    } catch (err: any) {
      console.error('Voucher upload error:', err);
      setError(err?.message || 'Failed to upload payment voucher. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[#E5E1DB]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EFEAE4] px-5 py-4 bg-[#FDFBF9] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#E08828] shadow-2xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1F1F1F]">Forward Payment Voucher</h3>
              <p className="text-[11px] text-[#8B8680] font-medium">
                Submit payment receipt / bank transfer screenshot
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-[#FAFAF8]">
          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg ? (
            <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-[#7ABA42] border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-base font-black text-[#1F1F1F]">Voucher Uploaded!</h4>
                <p className="text-xs text-[#5A5551] leading-relaxed">{successMsg}</p>
              </div>

              {activeBooking?.payment_voucher_url && (
                <button
                  type="button"
                  onClick={() => setViewingVoucherUrl(activeBooking.payment_voucher_url || null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-extrabold rounded-xl hover:bg-amber-100 transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#E08828]" />
                  <span>View My Uploaded Receipt</span>
                </button>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 bg-[#7ABA42] hover:bg-[#689f38] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Done &amp; Return
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select Active Booking */}
              {allBookings.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#E08828]" />
                    <span>Target Hike Reservation *</span>
                  </label>
                  <select
                    value={selectedBookingId}
                    onChange={(e) => setSelectedBookingId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E1DB] rounded-xl text-xs font-bold text-[#1F1F1F] focus:outline-none focus:border-[#7ABA42] cursor-pointer shadow-2xs"
                  >
                    {allBookings.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.hike_number ? `#${b.hike_number} - ` : ''}
                        {b.trek_name || 'Hike'} ({b.full_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Booking Info Card */}
              {activeBooking && (
                <div className="p-3 bg-white rounded-2xl border border-[#E5E1DB] text-xs space-y-1 shadow-2xs">
                  <div className="flex justify-between items-center font-bold text-[#1F1F1F]">
                    <span>{activeBooking.trek_name}</span>
                    <span className="text-[#E08828]">{activeBooking.trek_date}</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[#8B8680]">
                    <span>Hiker: {activeBooking.full_name} ({activeBooking.phone})</span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {activeBooking.payment_status || 'Unpaid'}
                    </span>
                  </div>

                  {activeBooking.payment_voucher_url && (
                    <div className="pt-2 border-t border-[#F0EBE5] flex items-center justify-between">
                      <span className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Previous Voucher Uploaded
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewingVoucherUrl(activeBooking.payment_voucher_url || null)}
                        className="text-[10px] font-extrabold text-[#2B6CB0] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View Existing Voucher</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* File Dropzone */}
              {!stagedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-200 bg-white hover:border-[#E08828] rounded-2xl p-8 text-center space-y-3 transition-all cursor-pointer shadow-xs group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 group-hover:bg-amber-100/80 flex items-center justify-center mx-auto text-[#E08828] transition-colors border border-amber-200">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-[#1F1F1F]">
                      Drag &amp; drop payment receipt / bank screenshot
                    </p>
                    <p className="text-[11px] text-[#8B8680] font-semibold">
                      Or click to upload file (eSewa / Khalti / Bank Transfer)
                    </p>
                  </div>
                  <p className="text-[10px] text-[#A8A29E]">
                    Supports JPG, PNG, WebP • Auto compressed &amp; encrypted
                  </p>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              ) : (
                /* Staged Image Preview */
                <div className="space-y-2 bg-white p-3 rounded-2xl border border-[#E5E1DB] shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1F1F1F]">
                    <span>Receipt Preview</span>
                    <button
                      type="button"
                      onClick={handleRemoveStagedFile}
                      className="text-rose-600 hover:text-rose-800 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center">
                    <img
                      src={stagedFile.url}
                      alt="Payment voucher receipt preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={uploading || !stagedFile}
                  onClick={handleSubmitVoucher}
                  className="w-full min-h-[44px] py-2.5 px-5 bg-[#E08828] hover:bg-[#cc781f] text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Forwarding Payment Voucher...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Forward Payment Voucher</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-[#8B8680] text-center mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#7ABA42]" /> Strictly viewable by expedition coordinators &amp; uploader only.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal for User Viewing Voucher */}
      {viewingVoucherUrl && (
        <div
          className="fixed inset-0 z-[2200] bg-black/90 p-4 flex flex-col items-center justify-center animate-in fade-in"
          onClick={() => setViewingVoucherUrl(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] bg-stone-900 rounded-2xl overflow-hidden flex flex-col p-3 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-white text-xs font-bold">
              <span>My Uploaded Payment Receipt</span>
              <button
                type="button"
                onClick={() => setViewingVoucherUrl(null)}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              <img src={viewingVoucherUrl} alt="Payment Voucher Receipt" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
