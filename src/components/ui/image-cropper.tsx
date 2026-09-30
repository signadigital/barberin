"use client";

import React, { useState, useCallback } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw, ZoomIn, ZoomOut, Crop as CropIcon } from "lucide-react";

export interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  aspectRatio?: number; // Default 3 / 1 untuk logo, 1 / 1 untuk favicon
  title?: string;
  description?: string;
  outputType?: "logo" | "favicon";
  onCropComplete: (result: { blob: Blob; dataUrl: string; file: File }) => void | Promise<void>;
}

/**
 * Buat elemen Image HTML secara async untuk diolah Canvas
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });
}

/**
 * Hitung sudut rotasi dalam radian
 */
function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Eksekusi pemotongan gambar berbasis Canvas API
 * - Preservasi transparansi PNG (terutama untuk Favicon & Logo transparan)
 * - Output ukuran standar & kualitas tajam
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  outputType: "logo" | "favicon" = "logo",
): Promise<{ blob: Blob; dataUrl: string; file: File }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context 2D tidak tersedia pada browser.");
  }

  const rotRad = getRadianAngle(rotation);

  // Ukuran bounding box ketika diputar
  const bBoxWidth =
    Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height);
  const bBoxHeight =
    Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Putar canvas di titik pusat
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Gambar citra awal ke bounding canvas
  ctx.drawImage(image, 0, 0);

  // Canvas kedua khusus menampung area yang dicrop
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Cropped canvas context tidak tersedia.");
  }

  // Tentukan dimensi target
  let targetWidth = Math.round(pixelCrop.width);
  let targetHeight = Math.round(pixelCrop.height);

  // Standarisasi ukuran favicon jika diperlukan (512x512)
  if (outputType === "favicon") {
    targetWidth = 512;
    targetHeight = 512;
  } else {
    // Untuk logo horizontal (maks lebar 900px untuk ketajaman retina dan performa hemat payload)
    if (targetWidth > 900) {
      const ratio = 900 / targetWidth;
      targetWidth = 900;
      targetHeight = Math.round(targetHeight * ratio);
    }
  }

  croppedCanvas.width = targetWidth;
  croppedCanvas.height = targetHeight;

  // Jaga ketajaman rendering
  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = "high";

  // Potong area tepat dari canvas pertama
  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  // Format MIME: Favicon selalu PNG agar mendukung transparansi; Logo PNG untuk web
  const mimeType = "image/png";
  const fileName =
    outputType === "favicon" ? "favicon-cropped.png" : "logo-cropped.png";

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal mengonversi canvas gambar menjadi Blob."));
          return;
        }
        const dataUrl = croppedCanvas.toDataURL(mimeType, 0.95);
        const file = new File([blob], fileName, { type: mimeType });
        resolve({ blob, dataUrl, file });
      },
      mimeType,
      0.95,
    );
  });
}

/**
 * Reusable ImageCropper Modal Dialog
 */
export function ImageCropper({
  open,
  onOpenChange,
  imageSrc,
  aspectRatio = 3 / 1,
  title = "Crop Gambar",
  description = "Geser dan sesuaikan area gambar yang ingin digunakan.",
  outputType = "logo",
  onCropComplete,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state saat modal dibuka atau gambar berganti
  React.useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setIsProcessing(false);
    }
  }, [open, imageSrc]);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      const result = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        outputType,
      );
      await onCropComplete(result);
      onOpenChange(false);
      handleReset();
    } catch (err) {
      console.error("[ImageCropper] Gagal memproses pemotongan gambar:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    if (isProcessing) return;
    onOpenChange(false);
    handleReset();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-xl max-w-[95vw] p-5 sm:p-6 bg-card text-card-foreground border border-border shadow-xl rounded-2xl gap-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <CropIcon className="h-5 w-5 text-primary" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Cropper Work Area */}
        <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden bg-black/90 border border-border flex items-center justify-center select-none touch-none">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
              classes={{
                containerClassName: "rounded-xl",
              }}
              style={{
                containerStyle: {
                  width: "100%",
                  height: "100%",
                },
              }}
            />
          ) : (
            <div className="text-xs text-muted-foreground text-center p-4">
              Tidak ada gambar untuk dipotong.
            </div>
          )}
        </div>

        {/* Zoom & Rotation Controls */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <span>Zoom</span>
              <span className="font-mono text-foreground">{Math.round(zoom * 100)}%</span>
            </span>
            <button
              type="button"
              onClick={handleRotate}
              disabled={isProcessing || !imageSrc}
              className="inline-flex items-center gap-1 text-[11px] hover:text-foreground text-muted-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              title="Putar gambar 90 derajat"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>Putar</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
              disabled={zoom <= 1 || isProcessing}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Perkecil"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.02}
              onValueChange={([val]) => setZoom(val ?? 1)}
              disabled={isProcessing || !imageSrc}
              className="flex-1 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
              disabled={zoom >= 3 || isProcessing}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Perbesar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <DialogFooter className="flex-row sm:justify-between items-center gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isProcessing || !imageSrc}
            className="text-xs h-9 px-3 rounded-xl cursor-pointer"
          >
            Reset
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isProcessing}
              className="text-xs h-9 px-3 rounded-xl cursor-pointer hover:bg-muted"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={isProcessing || !imageSrc}
              className="text-xs h-9 px-4 rounded-xl cursor-pointer font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Memproses gambar...</span>
                </>
              ) : (
                <span>Gunakan</span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
