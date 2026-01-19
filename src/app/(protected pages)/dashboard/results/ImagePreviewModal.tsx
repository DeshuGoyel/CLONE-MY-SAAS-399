"use client";

import Image from "next/image";
import { X, Download } from "lucide-react";
import { useEffect } from "react";

interface ImagePreviewModalProps {
  isOpen: boolean;
  imageUrl: string;
  imageIndex: number;
  onClose: () => void;
  onDownload: () => void;
  onNext: () => void;
  onPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  isDownloaded: boolean;
}

export default function ImagePreviewModal({
  isOpen,
  imageUrl,
  imageIndex,
  onClose,
  onDownload,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  isDownloaded,
}: ImagePreviewModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-mainBlack/90 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-mainOrange transition-colors p-2 rounded-full bg-mainBlack/50 hover:bg-mainBlack/70 z-10"
          aria-label="Close preview"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Previous button */}
        {hasPrevious && (
          <button
            onClick={onPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-mainOrange transition-colors p-3 rounded-full bg-mainBlack/50 hover:bg-mainBlack/70"
            aria-label="Previous image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Next button */}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-mainOrange transition-colors p-3 rounded-full bg-mainBlack/50 hover:bg-mainBlack/70"
            aria-label="Next image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Image container */}
        <div className="relative w-full h-[70vh] flex items-center justify-center">
          <Image
            src={imageUrl}
            alt={`AI-generated image ${imageIndex + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
          
          {/* Beta badge */}
          <div className="absolute top-4 left-4 bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm">
            Beta V4
          </div>

          {/* Downloaded badge */}
          {isDownloaded && (
            <div className="absolute top-4 right-4 bg-mainGreen/80 text-mainBlack text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm shadow-sm">
              Downloaded
            </div>
          )}
        </div>

        {/* Download button and info */}
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="text-white text-sm">
            Image {imageIndex + 1}
          </div>
          <button
            onClick={onDownload}
            className="flex items-center gap-2 bg-mainOrange text-mainBlack px-6 py-3 rounded-full font-semibold hover:bg-[#E0B50E] transition-colors"
          >
            <Download className="w-5 h-5" />
            Download High-Resolution
          </button>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs flex gap-4">
          <span>← Previous</span>
          <span>→ Next</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
