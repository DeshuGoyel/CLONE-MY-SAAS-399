"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useImageUpload } from "@/hooks/useImageUpload";

interface FileUploadAreaProps {
  images: Array<{ file: File; pixels: number }>;
  setImages: React.Dispatch<
    React.SetStateAction<Array<{ file: File; pixels: number }>>
  >;
  maxImages: number;
  onContinue: () => void;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
}

const FileUploadArea: React.FC<FileUploadAreaProps> = ({
  images,
  setImages,
  maxImages,
  onContinue,
  setIsUploading,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [hasLowResImage, setHasLowResImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadControls, setShowUploadControls] = useState(true);
  const {
    uploadImages,
    isUploading: uploadIsUploading,
    error: uploadError,
    uploadProgress,
    pauseUpload,
    resumeUpload,
    isPaused,
    resetProgress,
  } = useImageUpload();

  // Handles file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const remainingSlots = maxImages - images.length;
      if (remainingSlots === 0) {
        setError(
          "Maximum number of images reached. Please delete some images before uploading more."
        );
        return;
      }
      const newImages = Array.from(files).slice(0, remainingSlots);

      newImages.forEach((file) => {
        const img = new window.Image();
        img.onload = () => {
          const pixels = img.width * img.height;
          setImages((prevImages) => {
            const updatedImages = [...prevImages, { file, pixels }];
            const hasLowRes = updatedImages.some((img) => img.pixels < 500000);
            setHasLowResImage(hasLowRes);
            return updatedImages;
          });
        };
        img.src = URL.createObjectURL(file);
      });

      setError(null);
    }
  };

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) {
        const dataTransfer = new DataTransfer();
        Array.from(files).slice(0, maxImages - images.length).forEach(file => {
          dataTransfer.items.add(file);
        });
        fileInput.files = dataTransfer.files;
        handleFileChange({ target: fileInput } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // Removes an image from the list
  const handleDelete = (index: number) => {
    setImages((prevImages) => {
      const updatedImages = prevImages.filter((_, i) => i !== index);
      if (updatedImages.length < maxImages) {
        setError(null); // Clear the error when image count is below max
      }
      // Check if there are any remaining low-resolution images
      const hasLowRes = updatedImages.some((img) => img.pixels < 500000);
      setHasLowResImage(hasLowRes);
      return updatedImages;
    });
  };

  // Replace handleUploadToSupabase with handleContinue
  const handleUploadAndContinue = async () => {
    setIsUploading(true);
    const success = await uploadImages(images);
    setIsUploading(false);
    if (success) {
      onContinue();
    }
  };

  // Toggle upload controls visibility
  const toggleUploadControls = () => {
    setShowUploadControls(!showUploadControls);
  };

  return (
    <div>
      {/* File upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 cursor-pointer transition-all duration-300 ${
          isDragging 
            ? 'border-mainOrange bg-mainOrange/20'
            : 'border-mainBlack hover:bg-mainOrange/20 hover:border-mainOrange'
        }`}
        onClick={() => document.getElementById("file-upload")?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <svg
          className="mx-auto h-12 w-12 text-mainBlack"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="mt-2 text-sm text-mainBlack">
          {isDragging ? 'Drop images here' : 'Choose an image or drag & drop it here'}
        </p>
        <p className="text-xs text-mainBlack mt-1">
          JPEG and PNG formats, up to 50MB total
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Minimum 300x300, Maximum 8000x8000 pixels
        </p>
        <button
          className="mt-4 px-4 py-2 border border-mainBlack rounded-md text-sm font-medium text-mainBlack hover:bg-mainOrange hover:text-mainWhite hover:border-mainOrange transition-colors duration-300"
          onClick={(e) => {
            e.stopPropagation();
            document.getElementById("file-upload")?.click();
          }}
        >
          Browse file
        </button>
      </div>

      {/* Error message for maximum images */}
      {error && images.length >= maxImages && (
        <div className="mt-4 p-3 bg-mainOrange/20 border border-mainOrange text-mainBlack rounded-lg">
          {error}
        </div>
      )}

      {/* Warning for low-resolution images */}
      {hasLowResImage && (
        <div className="mt-4 p-3 bg-red-100 border border-red-500 text-mainBlack rounded-lg">
          Red marked images have lower resolution. For best AI results, use
          higher resolution images.
        </div>
      )}

      {/* Display uploaded images */}
      {images.length > 0 && (
        <div className="mt-6 p-4 bg-mainWhite/50 rounded-lg shadow-sm border border-mainBlack/10">
          <div className="mb-4 text-sm font-medium flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <span className="text-mainBlack">
              Uploaded Images: <span>{images.length}</span> / {maxImages}
            </span>
            {images.length < maxImages ? (
              <span className="text-mainBlack font-semibold">
                Upload{" "}
                <span className="text-mainOrange">
                  {maxImages - images.length}
                </span>{" "}
                more photo{maxImages - images.length !== 1 ? "s" : ""} to
                continue
              </span>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleUploadAndContinue}
                  disabled={isUploading || isPaused}
                  className={`text-mainBlack hover:text-mainOrange transition-colors duration-300 flex items-center gap-1 font-semibold ${
                    isUploading || isPaused ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isUploading ? "Uploading..." : isPaused ? "Paused" : "Continue to next step"}
                  {!isUploading && !isPaused && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                {uploadProgress.length > 0 && (
                  <button
                    onClick={isPaused ? resumeUpload : pauseUpload}
                    className="px-3 py-1 text-xs border border-mainBlack rounded-md hover:bg-mainBlack hover:text-mainWhite transition-colors"
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {images.map(({ file, pixels }, index) => (
              <div key={index} className="relative">
                <div
                  className={`aspect-square overflow-hidden rounded-lg shadow-md relative ${
                    pixels >= 500000
                      ? "border-4 border-mainGreen"
                      : "border-4 border-red-600"
                  }`}
                >
                  <Image
                    src={URL.createObjectURL(file)}
                    alt={`Uploaded image ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="rounded-lg object-cover"
                  />
                </div>
                <button
                  onClick={() => handleDelete(index)}
                  className="absolute -top-1 -right-1 bg-mainBlack/50 text-mainWhite p-1.5 rounded-full shadow-sm hover:bg-mainOrange/70 hover:text-mainBlack transition-all duration-300"
                  aria-label="Delete image"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        id="file-upload"
        type="file"
        className="hidden"
        accept=".jpeg,.jpg,.png"
        onChange={handleFileChange}
        multiple
      />
    </div>
  );
};

export default FileUploadArea;
