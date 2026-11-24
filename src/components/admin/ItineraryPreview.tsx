import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  TrekItineraryData,
  normalizeItineraryData,
  getEventPhotos
} from '../../data/defaultItineraryTemplate';
import {
  Calendar,
  Clock,
  MapPin,
  Mountain,
  CheckCircle2,
  XCircle,
  PlusCircle,
  ShieldCheck,
  Phone,
  MessageCircle,
  ArrowLeft,
  Share2,
  FileCheck2,
  Layers,
  Sparkles,
  HelpCircle,
  Printer,
  ExternalLink,
} from 'lucide-react';

interface ItineraryPreviewProps {
  data: TrekItineraryData;
  onBackToEdit: () => void;
  onPublishTemplate?: () => void;
  onShare?: () => void;
}

export const ItineraryPreview: React.FC<ItineraryPreviewProps> = ({
  data: rawData,
  onBackToEdit,
  onPublishTemplate,
  onShare,
}) => {
  const data = normalizeItineraryData(rawData);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const loadImageForPdf = (url: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const timeout = setTimeout(() => resolve(null), 3000);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const maxW = 1200;
          const scale = img.width > maxW ? maxW / img.width : 1;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: w, height: h });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      img.src = url;
    });
  };

  const handleDownloadPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageBottom = 276;
      let y = 18;

      const checkPageOverflow = (neededHeight: number) => {
        if (y + neededHeight > pageBottom) {
          doc.addPage();
          y = 18;
        }
      };

      const drawWrappedText = (
        lines: string[],
        x: number,
        lineHeight: number,
        bottomGap = 0
      ) => {
        lines.forEach((line) => {
          checkPageOverflow(lineHeight + 1);
          doc.text(line, x, y);
          y += lineHeight;
        });
        y += bottomGap;
      };

      const drawSectionHeading = (title: string, r = 31, g = 31, b = 31) => {
        checkPageOverflow(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(r, g, b);
        doc.text(title, 15, y);
        y += 6;
      };

      // Header Banner
      doc.setFillColor(122, 186, 66); // Brand Green
      doc.rect(15, y, 180, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('WALK NEPAL WALK • OFFICIAL TRIP ITINERARY', 20, y + 6.5);
      y += 16;

      // Category, Hike Tag & Date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(224, 136, 40); // Brand Orange
      doc.text(
        `HIKE #${data.hikeNumber || '---'}  •  ${(data.category || 'OVERNIGHT HIKES').toUpperCase()}  •  ${data.hikeDate || 'Date to be announced'}`,
        15,
        y
      );
      y += 6;

      // Trip Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(31, 31, 31);
      const titleLines = doc.splitTextToSize(data.title || 'Untitled Hike Itinerary', 180);
      drawWrappedText(titleLines, 15, 6.5, 3);

      // Cover & Preview Photos (if loadable via CORS/data URL)
      const photos = getEventPhotos(data.coverImageUrl);
      if (photos.length > 0) {
        const loadedPhotos = await Promise.all(photos.map((p) => loadImageForPdf(p.url)));
        const coverLoaded = loadedPhotos[0];
        if (coverLoaded) {
          const maxImgW = 180;
          const imgH = Math.min(82, (coverLoaded.height / coverLoaded.width) * maxImgW);
          checkPageOverflow(imgH + (photos[0].caption ? 8 : 4));
          doc.addImage(coverLoaded.dataUrl, 'JPEG', 15, y, maxImgW, imgH);
          y += imgH + 3;
          if (photos[0].caption) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(100, 95, 90);
            const capLines = doc.splitTextToSize(photos[0].caption, 180);
            drawWrappedText(capLines, 15, 4, 2);
          } else {
            y += 2;
          }
        }

        // Additional preview thumbnails (4 per row)
        const extraPhotos = photos
          .slice(1)
          .map((p, i) => ({ photo: p, loaded: loadedPhotos[i + 1] }))
          .filter((item) => Boolean(item.loaded));
        if (extraPhotos.length > 0) {
          const thumbW = 42;
          const thumbH = 28;
          const gap = 4;
          for (let i = 0; i < extraPhotos.length; i += 4) {
            const rowItems = extraPhotos.slice(i, i + 4);
            const hasCaption = rowItems.some((it) => Boolean(it.photo.caption));
            checkPageOverflow(thumbH + (hasCaption ? 10 : 5));
            const rowStartY = y;
            let maxCapH = 0;
            rowItems.forEach((item, colIdx) => {
              const xPos = 15 + colIdx * (thumbW + gap);
              if (item.loaded) {
                doc.addImage(item.loaded.dataUrl, 'JPEG', xPos, rowStartY, thumbW, thumbH);
              }
              if (item.photo.caption) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(90, 85, 81);
                const cLines = doc.splitTextToSize(item.photo.caption, thumbW).slice(0, 2);
                doc.text(cLines, xPos, rowStartY + thumbH + 3.5);
                maxCapH = Math.max(maxCapH, cLines.length * 3.5 + 2);
              }
            });
            y = rowStartY + thumbH + maxCapH + 4;
          }
        }
      }

      // Pricing Tiers & Pricing Notes
      if ((data.priceTiers && data.priceTiers.length > 0) || data.pricingNotes) {
        drawSectionHeading('Available Package Pricing');

        if (data.priceTiers && data.priceTiers.length > 0) {
          data.priceTiers.forEach((tier) => {
            checkPageOverflow(10);
            doc.setFillColor(250, 248, 245);
            doc.rect(15, y, 180, 8, 'F');
            doc.setDrawColor(239, 234, 228);
            doc.rect(15, y, 180, 8, 'D');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
            doc.text(tier.label || 'Standard Package', 20, y + 5.3);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(224, 136, 40);
            doc.text(`${data.currency} ${Number(tier.price).toLocaleString()} / person`, 135, y + 5.3);
            y += 9.5;
          });
        }

        if (data.pricingNotes) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(120, 115, 110);
          const noteLines = doc.splitTextToSize(`Note: ${data.pricingNotes}`, 180);
          drawWrappedText(noteLines, 15, 4.2, 2);
        } else {
          y += 3;
        }
      }

      // Hike Overview & Metrics (Full 2-column dynamic box)
      drawSectionHeading('Hike Overview & Metrics');
      const elevationSummary = [data.overview.elevationRange, data.overview.elevationGross]
        .filter(Boolean)
        .join(' • ') || '---';
      const durationSummary = [data.overview.expectedDuration, data.overview.days]
        .filter(Boolean)
        .join(' • ') || '---';
      const meetingPointVal = data.overview.meetingPointLink
        ? `${data.overview.meetingPoint || '---'} (${data.overview.meetingPointLink})`
        : (data.overview.meetingPoint || '---');
      const endingPointVal = data.overview.endingPointLink
        ? `${data.overview.endingPoint || '---'} (${data.overview.endingPointLink})`
        : (data.overview.endingPoint || '---');

      const overviewRows: Array<[string, string, string, string]> = [
        ['Date:', data.hikeDate || 'Date to be announced', 'Meeting Time:', data.overview.meetingTime || '---'],
        ['Duration:', durationSummary, 'Difficulty:', data.overview.difficulty || '---'],
        ['Distance:', data.overview.approxDistance || '---', 'Elevation:', elevationSummary],
        ['Meeting Point:', meetingPointVal, 'Ending Point:', endingPointVal],
        ['Team Leader:', data.teamLeader || '---', 'Max Capacity:', data.maxCapacity ? `${data.maxCapacity} Trekkers` : '---'],
      ];

      overviewRows.forEach(([l1, v1, l2, v2]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const v1Lines = doc.splitTextToSize(v1, 57);
        const v2Lines = doc.splitTextToSize(v2, 57);
        const rowLines = Math.max(v1Lines.length, v2Lines.length);
        const rowHeight = Math.max(8, rowLines * 4.2 + 3.5);
        checkPageOverflow(rowHeight + 1);

        doc.setFillColor(250, 248, 245);
        doc.rect(15, y, 180, rowHeight, 'F');
        doc.setDrawColor(239, 234, 228);
        doc.rect(15, y, 180, rowHeight, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(120, 115, 110);
        doc.text(l1, 18, y + 5);
        doc.text(l2, 108, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(v1Lines, 46, y + 5);
        doc.text(v2Lines, 134, y + 5);

        y += rowHeight;
      });
      y += 6;

      // External Resources Quick Links
      if (data.whatsappLink || data.itineraryLink) {
        drawSectionHeading('Quick Links & Resources');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        if (data.whatsappLink) {
          const waLines = doc.splitTextToSize(`WhatsApp Group: ${data.whatsappLink}`, 176);
          doc.setTextColor(18, 140, 126);
          drawWrappedText(waLines, 15, 4.5, 1.5);
        }
        if (data.itineraryLink) {
          const linkLines = doc.splitTextToSize(`Full Itinerary Link: ${data.itineraryLink}`, 176);
          doc.setTextColor(29, 78, 216);
          drawWrappedText(linkLines, 15, 4.5, 1.5);
        }
        y += 3;
      }

      // Cost Includes
      if (data.costIncludes && data.costIncludes.length > 0) {
        drawSectionHeading('Cost Includes (What is Included)', 6, 95, 70);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        data.costIncludes.forEach((inc) => {
          const splitInc = doc.splitTextToSize(`• ${inc}`, 175);
          drawWrappedText(splitInc, 15, 4.8, 1);
        });
        y += 4;
      }

      // Cost Excludes
      if (data.costExcludes && data.costExcludes.length > 0) {
        drawSectionHeading('Cost Excludes (What is Excluded)', 159, 18, 57);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        data.costExcludes.forEach((exc) => {
          const splitExc = doc.splitTextToSize(`• ${exc}`, 175);
          drawWrappedText(splitExc, 15, 4.8, 1);
        });
        y += 4;
      }

      // Optional Add-Ons & Room Customizations
      if (data.addOns && data.addOns.length > 0) {
        drawSectionHeading('Optional Add-Ons & Room Customizations');
        data.addOns.forEach((addon) => {
          checkPageOverflow(9);
          doc.setFillColor(250, 248, 245);
          doc.rect(15, y, 180, 7.5, 'F');
          doc.setDrawColor(239, 234, 228);
          doc.rect(15, y, 180, 7.5, 'D');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.8);
          doc.setTextColor(31, 31, 31);
          doc.text(addon.name || 'Add-on', 19, y + 5);

          doc.setTextColor(224, 136, 40);
          const addonPriceText = `${data.currency} ${Number(addon.price || 0).toLocaleString()}${addon.unit ? ` ${addon.unit}` : ''}`;
          doc.text(addonPriceText, 130, y + 5);
          y += 9;
        });
        if (data.addOnsNotice) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.2);
          doc.setTextColor(120, 115, 110);
          const noticeLines = doc.splitTextToSize(data.addOnsNotice, 180);
          drawWrappedText(noticeLines, 15, 4.2, 2);
        } else {
          y += 3;
        }
      }

      // Day-by-day Itinerary
      if (data.itineraryDays && data.itineraryDays.length > 0) {
        drawSectionHeading('Itinerary Details & Schedule');

        data.itineraryDays.forEach((day) => {
          checkPageOverflow(16);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(day.type === 'night' ? 67 : 224, day.type === 'night' ? 56 : 136, day.type === 'night' ? 202 : 40);
          const dayHeaderLines = doc.splitTextToSize(
            `${day.type === 'night' ? 'NIGHT' : 'DAY'} ${day.dayNumber}: ${day.title || ''}`,
            180
          );
          drawWrappedText(dayHeaderLines, 15, 5, 1.5);

          if (day.items && day.items.length > 0) {
            day.items.forEach((item) => {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.8);
              const timeLines = doc.splitTextToSize(item.time || '---', 27);
              doc.setFont('helvetica', 'normal');
              const activityLines = doc.splitTextToSize(item.activity || '', 142);
              const needed = Math.max(timeLines.length, activityLines.length) * 4.6 + 1.5;
              checkPageOverflow(needed);

              doc.setFont('helvetica', 'bold');
              doc.setTextColor(122, 186, 66);
              doc.text(timeLines, 18, y);

              doc.setFont('helvetica', 'normal');
              doc.setTextColor(50, 50, 50);
              doc.text(activityLines, 48, y);
              y += needed;
            });
          }
          y += 3.5;
        });
      }

      // Booking Process & Policy Notes
      const hasSection8 =
        (data.bookingProcessSteps && data.bookingProcessSteps.length > 0) ||
        (data.bookingNotes && data.bookingNotes.length > 0) ||
        Boolean(data.participationGuidelines) ||
        (data.safetyRules && data.safetyRules.length > 0) ||
        (data.helpContacts && data.helpContacts.length > 0);

      if (hasSection8) {
        drawSectionHeading('Booking Process & Policy Notes');

        if (data.bookingProcessSteps && data.bookingProcessSteps.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          data.bookingProcessSteps.forEach((step, idx) => {
            const splitStep = doc.splitTextToSize(`${idx + 1}. ${step}`, 175);
            drawWrappedText(splitStep, 15, 4.8, 1);
          });
          y += 2;
        }

        if (data.bookingNotes && data.bookingNotes.length > 0) {
          checkPageOverflow(14);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(146, 64, 14);
          doc.text('Important Booking Notes:', 15, y);
          y += 5;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.8);
          doc.setTextColor(120, 53, 15);
          data.bookingNotes.forEach((note) => {
            const noteLines = doc.splitTextToSize(`• ${note}`, 175);
            drawWrappedText(noteLines, 15, 4.6, 1);
          });
          y += 2.5;
        }

        if (data.participationGuidelines) {
          checkPageOverflow(14);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(31, 31, 31);
          doc.text('Participation & Age Guidelines', 15, y);
          y += 5;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.8);
          doc.setTextColor(70, 66, 62);
          const guideLines = doc.splitTextToSize(data.participationGuidelines, 178);
          drawWrappedText(guideLines, 15, 4.6, 3);
        }

        if (data.safetyRules && data.safetyRules.length > 0) {
          checkPageOverflow(14);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(31, 31, 31);
          doc.text('Participation, Safety & Trail Ethics', 15, y);
          y += 5;

          data.safetyRules.forEach((rule) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.8);
            const titleLinesRule = doc.splitTextToSize(`• ${rule.title}`, 176);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            const descLinesRule = doc.splitTextToSize(rule.description || '', 172);
            checkPageOverflow(titleLinesRule.length * 4.5 + descLinesRule.length * 4.2 + 3);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.8);
            doc.setTextColor(31, 31, 31);
            drawWrappedText(titleLinesRule, 15, 4.5, 0.5);

            if (rule.description) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(90, 85, 81);
              drawWrappedText(descLinesRule, 19, 4.2, 2);
            }
          });
          y += 2;
        }

        if (data.helpContacts && data.helpContacts.length > 0) {
          checkPageOverflow(12);
          doc.setFillColor(242, 249, 236);
          doc.rect(15, y, 180, 10, 'F');
          doc.setDrawColor(194, 224, 168);
          doc.rect(15, y, 180, 10, 'D');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(31, 31, 31);
          doc.text('Need help or custom coordination? Direct WhatsApp assistance:', 19, y + 4.3);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(70, 110, 40);
          doc.text(data.helpContacts.filter(Boolean).join('  •  '), 19, y + 8.3);
          y += 14;
        }
      }

      // FAQs
      if (data.faqs && data.faqs.length > 0) {
        drawSectionHeading('Trek-Specific Frequently Asked Questions (FAQ)');

        data.faqs.forEach((faq, idx) => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(224, 136, 40);
          const qLines = doc.splitTextToSize(`Q${idx + 1}: ${faq.question}`, 175);
          drawWrappedText(qLines, 15, 4.6, 1);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.8);
          doc.setTextColor(60, 60, 60);
          const aLines = doc.splitTextToSize(`A: ${faq.answer}`, 175);
          drawWrappedText(aLines, 15, 4.5, 3);
        });
      }

      // Add footer to every page
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(140, 135, 130);
        doc.text(`Walk Nepal Walk • Hike #${data.hikeNumber || '---'} Itinerary`, 15, 287);
        doc.text(`Page ${p} of ${totalPages}`, 180, 287);
      }

      // Save PDF document
      const safeTitle = (data.title || 'hike_itinerary')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      doc.save(`itinerary_hike_${data.hikeNumber || 'draft'}_${safeTitle}.pdf`);
    } catch (err) {
      console.error('PDF Generation Failed:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="w-full bg-[#FDFBF9] min-h-screen text-[#1F1F1F]">
      {/* Sticky Admin Preview Action Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#EFEAE4] px-4 py-3 shadow-xs print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackToEdit}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F4EFEA] hover:bg-[#EBE5DE] text-[#1F1F1F] rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Editor</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Public Itinerary Preview Mode
            </span>
            <button
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-50 hover:bg-sky-600 border border-sky-200 hover:border-sky-600 text-sky-700 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-60"
              title="Download full itinerary as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#25D366]/15 hover:bg-[#25D366] text-[#128C7E] hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            )}
            {onPublishTemplate && (
              <button
                type="button"
                onClick={onPublishTemplate}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#7ABA42] hover:bg-[#6CA838] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Publish Itinerary</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Section 1 & 2: Hero & Basic Info */}
        <div className="bg-white rounded-3xl border border-[#EFEAE4] shadow-xs relative overflow-hidden">
          {(() => {
            const photos = getEventPhotos(data.coverImageUrl);
            const mainPhoto = photos[0];
            return (
              <>
                {mainPhoto && (
                  <div
                    className="relative w-full overflow-hidden bg-neutral-900 flex items-center justify-center cursor-pointer group"
                    onClick={() => setSelectedLightboxImage(mainPhoto.url)}
                    title="Click to view full image"
                  >
                    <img
                      src={mainPhoto.url}
                      alt={data.title}
                      className="w-full h-auto object-contain block transition-transform duration-500 group-hover:scale-101"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80';
                      }}
                    />
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      Click to expand
                    </div>
                  </div>
                )}

                {/* Preview Photos Strip underneath main cover photo */}
                {photos.length > 1 && (
                  <div className="px-3 py-3 sm:px-6 sm:py-5 bg-[#FAF8F5] border-t border-[#EFEAE4]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
                      {photos.map((photo, idx) => (
                        <div key={idx} className="bg-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border border-[#E5E1DB] shadow-2xs space-y-1.5 sm:space-y-2">
                          <button
                            type="button"
                            onClick={() => setSelectedLightboxImage(photo.url)}
                            className="relative w-full aspect-4/3 sm:h-40 rounded-lg sm:rounded-xl overflow-hidden bg-neutral-900 block cursor-pointer group"
                          >
                            <img
                              src={photo.url}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            {idx === 0 && (
                              <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 bg-[#E08828] text-white text-[9px] font-bold rounded-md uppercase">
                                Cover
                              </span>
                            )}
                          </button>
                          {photo.caption && (
                            <p className="text-[11px] sm:text-xs text-[#5A5551] font-medium px-0.5 sm:px-1 line-clamp-2">
                              {photo.caption}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-[#E08828]/10 text-[#E08828] border border-[#E08828]/20">
                Hike #{data.hikeNumber || '---'}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#7ABA42]/10 text-[#5B8F2D] border border-[#7ABA42]/20">
                {data.category}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-[#5A5551]">
                <Calendar className="w-3 h-3 inline mr-1 text-[#8B8680]" />
                {data.hikeDate || 'Date to be announced'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#1F1F1F] tracking-tight leading-tight mb-4">
              {data.title || 'Untitled Hike Itinerary'}
            </h1>

          {/* Pricing Tiers Matrix */}
          <div className="mt-6 pt-5 border-t border-[#F0EBE5]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B8680] block mb-2.5">
              Available Package Pricing
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.priceTiers && data.priceTiers.length > 0 ? (
                data.priceTiers.map((tier, idx) => (
                  <div
                    key={tier.id || idx}
                    className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#EFEAE4] flex flex-col justify-between"
                  >
                    <span className="text-xs font-semibold text-[#5A5551]">{tier.label}</span>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-lg sm:text-xl font-black text-[#1F1F1F]">
                        {data.currency} {Number(tier.price).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8B8680]">/ person</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-[#FAF8F5] text-xs text-[#8B8680]">
                  No pricing tiers specified
                </div>
              )}
            </div>

              {data.pricingNotes && (
                <p className="mt-3 text-xs text-[#8B8680] italic flex items-center gap-1.5">
                  <span>ℹ️</span>
                  <span>{data.pricingNotes}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Hike Overview Cards */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFEAE4] shadow-xs">
          <h2 className="text-base sm:text-lg font-black text-[#1F1F1F] mb-4 flex items-center gap-2">
            <Mountain className="w-5 h-5 text-[#7ABA42]" />
            <span>Hike Overview & Metrics</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
              <span className="text-[11px] text-[#8B8680] font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#E08828]" /> Meeting Time
              </span>
              <p className="text-sm font-bold text-[#1F1F1F] mt-1">{data.overview.meetingTime || '---'}</p>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
              <span className="text-[11px] text-[#8B8680] font-semibold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#E08828]" /> Meeting Point
              </span>
              {data.overview.meetingPointLink ? (
                <a
                  href={data.overview.meetingPointLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-[#E08828] hover:text-[#C86B1A] hover:underline mt-1 truncate flex items-center gap-1 group"
                  title={`Open map/link for ${data.overview.meetingPoint || 'Meeting Point'}`}
                >
                  <span className="truncate">{data.overview.meetingPoint || '---'}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                </a>
              ) : (
                <p className="text-sm font-bold text-[#1F1F1F] mt-1">{data.overview.meetingPoint || '---'}</p>
              )}
            </div>

            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
              <span className="text-[11px] text-[#8B8680] font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#7ABA42]" /> Duration
              </span>
              <p className="text-sm font-bold text-[#1F1F1F] mt-1">{data.overview.expectedDuration || '---'}</p>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
              <span className="text-[11px] text-[#8B8680] font-semibold flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5 text-[#7ABA42]" /> Difficulty
              </span>
              <div className="mt-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-black uppercase tracking-wide border ${
                  (data.overview.difficulty || '').toLowerCase() === 'easy'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : (data.overview.difficulty || '').toLowerCase() === 'moderate'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    : (data.overview.difficulty || '').toLowerCase() === 'hard' || (data.overview.difficulty || '').toLowerCase() === 'difficult'
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : (data.overview.difficulty || '').toLowerCase() === 'extreme'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                }`}>
                  {data.overview.difficulty || '---'}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
              <span className="text-[11px] text-[#8B8680] font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#E08828]" /> Distance & Altitudes
              </span>
              <p className="text-sm font-bold text-[#1F1F1F] mt-1">{data.overview.approxDistance || '---'}</p>
              <p className="text-[11px] text-[#8B8680] mt-0.5">
                {data.overview.elevationRange} • {data.overview.elevationGross}
              </p>
            </div>

            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4]">
              <span className="text-[11px] text-[#8B8680] font-semibold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Ending Point
              </span>
              {data.overview.endingPointLink ? (
                <a
                  href={data.overview.endingPointLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline mt-1 truncate flex items-center gap-1 group"
                  title={`Open map/link for ${data.overview.endingPoint || 'Ending Point'}`}
                >
                  <span className="truncate">{data.overview.endingPoint || '---'}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:opacity-100" />
                </a>
              ) : (
                <p className="text-sm font-bold text-[#1F1F1F] mt-1">{data.overview.endingPoint || '---'}</p>
              )}
            </div>

            <div className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-100">
              <span className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> Team Leader
              </span>
              <p className="text-sm font-bold text-amber-950 mt-1">{data.teamLeader || '---'}</p>
            </div>

            <div className="p-3.5 bg-blue-50/40 rounded-2xl border border-blue-100">
              <span className="text-[11px] text-blue-800 font-semibold flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Max Capacity
              </span>
              <p className="text-sm font-bold text-blue-950 mt-1">{data.maxCapacity ? `${data.maxCapacity} Trekkers` : '---'}</p>
            </div>
          </div>
        </div>

        {/* External Resources Quick Links */}
        {(data.whatsappLink || data.itineraryLink) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.whatsappLink && (
              <a 
                href={data.whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-[#25D366]/10 hover:bg-[#25D366] text-[#128C7E] hover:text-white border border-[#25D366]/30 rounded-2xl transition-all font-bold text-xs shadow-2xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Join WhatsApp Group</span>
              </a>
            )}
            {data.itineraryLink && (
              <a 
                href={data.itineraryLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 p-3.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-2xl transition-all font-bold text-xs shadow-2xs"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>View Full Itinerary</span>
              </a>
            )}
          </div>
        )}

        {/* Section 4 & 5: Cost Includes & Cost Excludes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inclusions */}
          <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-xs">
            <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Cost Includes</span>
            </h3>
            <ul className="space-y-2.5">
              {data.costIncludes.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Exclusions */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs">
            <h3 className="text-sm font-bold text-rose-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              <span>Cost Excludes</span>
            </h3>
            <ul className="space-y-2.5">
              {data.costExcludes.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-[#3D3A37] leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Section 6: Additional Add-Ons */}
        {data.addOns && data.addOns.length > 0 && (
          <div className="bg-white rounded-3xl p-6 border border-[#EFEAE4] shadow-xs">
            <h3 className="text-sm font-bold text-[#1F1F1F] uppercase tracking-wider mb-3 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-[#E08828]" />
              <span>Optional Add-Ons & Room Customizations</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {data.addOns.map((addon, idx) => (
                <div key={addon.id || idx} className="p-3 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F1F1F]">{addon.name}</span>
                  <span className="text-xs font-black text-[#E08828]">
                    {data.currency} {Number(addon.price).toLocaleString()} <span className="text-[10px] font-normal text-[#8B8680]">{addon.unit}</span>
                  </span>
                </div>
              ))}
            </div>
            {data.addOnsNotice && (
              <p className="text-[11px] text-[#8B8680] italic">
                {data.addOnsNotice}
              </p>
            )}
          </div>
        )}

        {/* Section 7: Itinerary Details (Day-by-Day Timeline) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFEAE4] shadow-xs">
          <h2 className="text-base sm:text-lg font-black text-[#1F1F1F] mb-6 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#E08828]" />
            <span>Itinerary Details & Schedule</span>
          </h2>

          <div className="space-y-6">
            {data.itineraryDays.map((day) => {
              const isNight = day.type === 'night';
              return (
              <div key={day.id} className={`border-l-2 pl-4 sm:pl-6 space-y-3 relative ${isNight ? 'border-indigo-400/50' : 'border-[#E08828]/40'}`}>
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full text-white flex items-center justify-center text-[9px] font-bold ${isNight ? 'bg-indigo-700' : 'bg-[#E08828]'}`}>
                  {isNight ? `N` : day.dayNumber}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#1F1F1F]">
                    {isNight ? 'Night' : 'Day'} {day.dayNumber}: {day.title}
                  </h3>
                </div>

                <div className="space-y-2 mt-2">
                  {day.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-2.5 rounded-xl bg-[#FAF8F5] text-xs"
                    >
                      <span className="font-bold text-[#E08828] shrink-0 w-24">
                        {item.time}
                      </span>
                      <span className="text-[#3D3A37]">{item.activity}</span>
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Section 8: Booking Process & Participation Guidelines */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFEAE4] shadow-xs space-y-6">
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#1F1F1F] mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#7ABA42]" />
              <span>Booking Process & Policy Notes</span>
            </h2>

            <ol className="space-y-3">
              {data.bookingProcessSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-xs text-[#3D3A37]">
                  <span className="w-5 h-5 rounded-full bg-[#7ABA42]/15 text-[#5B8F2D] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>

            {data.bookingNotes && data.bookingNotes.length > 0 && (
              <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1.5">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider block">Important Booking Notes:</span>
                {data.bookingNotes.map((note, idx) => (
                  <p key={idx} className="text-xs text-amber-900/90 leading-relaxed">
                    • {note}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-[#F0EBE5]">
            <h3 className="text-sm font-black text-[#1F1F1F] mb-2">
              Participation & Age Guidelines
            </h3>
            <p className="text-xs text-[#5A5551] leading-relaxed">
              {data.participationGuidelines}
            </p>
          </div>

          <div className="pt-5 border-t border-[#F0EBE5]">
            <h3 className="text-sm font-black text-[#1F1F1F] mb-3">
              Participation, Safety & Trail Ethics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.safetyRules.map((rule) => (
                <div key={rule.id} className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EFEAE4]">
                  <span className="text-xs font-bold text-[#1F1F1F] block mb-0.5">{rule.title}</span>
                  <p className="text-[11px] text-[#6A6560] leading-relaxed">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Need Help WhatsApp footer */}
          <div className="p-4 bg-[#7ABA42]/10 border border-[#7ABA42]/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#1F1F1F] flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#5B8F2D]" />
                Need help or custom coordination?
              </span>
              <p className="text-[11px] text-[#5A5551] mt-0.5">
                Direct WhatsApp assistance: {data.helpContacts.join('  •  ')}
              </p>
            </div>
            <a
              href={`https://wa.me/9779803568612?text=${encodeURIComponent(`Hi Walk Nepal Walk, I have a question regarding Hike #${data.hikeNumber} (${data.title})`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-[#7ABA42] hover:bg-[#6CA838] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>

        {/* Section 9: Trek-Specific Frequently Asked Questions (FAQ Preview) */}
        {data.faqs && data.faqs.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#EFEAE4] shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F0EBE5]">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#E08828]" />
                <h2 className="text-base sm:text-lg font-black text-[#1F1F1F]">
                  Trek-Specific Frequently Asked Questions (FAQ)
                </h2>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Shared via FAQ Link Only
              </span>
            </div>

            <p className="text-xs text-[#5A5551] leading-relaxed">
              These questions and answers are specifically prepared for {data.title || `Hike #${data.hikeNumber}`}. Public users only see this section when accessing through the dedicated coordinator FAQ link.
            </p>

            <div className="space-y-3 pt-2">
              {data.faqs.map((faq, idx) => (
                <div key={faq.id || idx} className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#EFEAE4] space-y-1.5">
                  <div className="text-xs font-bold text-[#1F1F1F] flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#E08828]/15 text-[#C86B1A] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                      Q
                    </span>
                    <span className="leading-snug">{faq.question}</span>
                  </div>
                  <div className="text-xs text-[#5A5551] leading-relaxed pl-7 whitespace-pre-line font-medium">
                    {faq.answer}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedLightboxImage && (
        <div
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedLightboxImage}
              alt="Full size view"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              onClick={() => setSelectedLightboxImage(null)}
              className="absolute -top-12 right-0 sm:-right-4 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
