import React, { useState, useCallback } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

interface ImageCropperModalProps {
  image: string;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
  aspectRatio?: number;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  image,
  onClose,
  onCropComplete,
  aspectRatio = 1200 / 600, // Default 2:1 for banners
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropChange = (crop: Point) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropCompleteInternal = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) return;

    try {
      const img = new Image();
      img.src = image;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );

      // We want to limit the size of the result while maintaining quality
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) return;

      const maxDimension = 1200;
      let targetWidth = canvas.width;
      let targetHeight = canvas.height;

      if (targetWidth > maxDimension) {
        targetHeight = (maxDimension / targetWidth) * targetHeight;
        targetWidth = maxDimension;
      }

      finalCanvas.width = targetWidth;
      finalCanvas.height = targetHeight;
      finalCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

      const base64Image = finalCanvas.toDataURL('image/jpeg', 0.85);
      onCropComplete(base64Image);
    } catch (e) {
      console.error('Error cropping image:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh] sm:h-[700px]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-stone-900 leading-tight">Adjust Cover Image</h3>
            <p className="text-[11px] text-stone-500 font-bold uppercase tracking-wider mt-0.5">Drag to reposition • Zoom to fit</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Area */}
        <div className="relative flex-1 bg-stone-900">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteInternal}
            classes={{
              containerClassName: 'bg-stone-900',
              cropAreaClassName: 'border-2 border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]',
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-5 bg-white border-t border-stone-100 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex-1 flex items-center gap-4">
              <ZoomOut className="w-4 h-4 text-stone-400" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 bg-stone-100 rounded-full appearance-none cursor-pointer accent-[#E08828]"
              />
              <ZoomIn className="w-4 h-4 text-stone-400" />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setZoom(1);
                  setCrop({ x: 0, y: 0 });
                }}
                className="p-2.5 bg-stone-50 hover:bg-stone-100 text-stone-600 rounded-xl transition-all cursor-pointer"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-stone-600 font-bold text-sm hover:bg-stone-50 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={createCroppedImage}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply Crop</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
