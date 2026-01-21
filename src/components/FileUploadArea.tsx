"use client";

import { useState, useRef, useCallback } from 'react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { imageUploadSchema } from '@/lib/validations';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { generateRequestId } from '@/lib/apiHelpers';

interface FileUploadAreaProps {
  onUploadComplete: (urls: string[]) => void;
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
}

export default function FileUploadArea({
  onUploadComplete,
  maxFiles = 10,
  maxFileSize = 10 * 1024 * 1024,
  allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
}: FileUploadAreaProps) {
  const {
    uploadImages,
    isUploading,
    isPaused,
    error,
    uploadProgress,
    pauseUpload,
    resumeUpload,
    getOverallProgress,
    resetProgress,
  } = useImageUpload();

  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(generateRequestId());

  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    try {
      const result = imageUploadSchema.parse({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      return { valid: true };
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return {
          valid: false,
          error: validationError.errors[0]?.message || 'Invalid file',
        };
      }
      return { valid: false, error: 'Validation failed' };
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      addFiles(newFiles);
    }
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    if (files.length + newFiles.length > maxFiles) {
      setValidationErrors(prev => ({
        ...prev,
        limit: `Maximum ${maxFiles} files allowed`,
      }));
      return;
    }

    const validatedFiles: File[] = [];
    const errors: Record<string, string> = {};

    newFiles.forEach(file => {
      const validation = validateFile(file);
      if (validation.valid) {
        validatedFiles.push(file);
      } else {
        errors[file.name] = validation.error || 'Invalid file';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
    }

    if (validatedFiles.length > 0) {
      setFiles(prev => [...prev, ...validatedFiles]);
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.limit;
        return newErrors;
      });
    }
  }, [files.length, maxFiles, validateFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  }, [addFiles]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.limit;
      return newErrors;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) {
      setValidationErrors(prev => ({
        ...prev,
        noFiles: 'Please select at least one file to upload',
      }));
      return;
    }

    logger.info('Starting image upload', {
      requestId: requestId.current,
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
    });

    try {
      const success = await uploadImages(
        files.map(file => ({ file, pixels: 0 })) // pixels can be calculated if needed
      );

      if (success) {
        const uploadedUrls = uploadProgress
          .filter(p => p.status === 'completed' && p.url)
          .map(p => p.url!);

        logger.info('Image upload completed successfully', {
          requestId: requestId.current,
          uploadedCount: uploadedUrls.length,
          totalCount: files.length,
        });

        onUploadComplete(uploadedUrls);
      }
    } catch (error) {
      logger.error('Image upload failed', {
        requestId: requestId.current,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [files, uploadImages, uploadProgress, onUploadComplete]);

  const handleRemoveAll = useCallback(() => {
    setFiles([]);
    setValidationErrors({});
    resetProgress();
  }, [resetProgress]);

  const overallProgress = getOverallProgress();

  return (
    <div className="space-y-6">
      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          dragActive ? 'border-mainOrange bg-mainOrange/10' : 'border-gray-300 bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={allowedTypes.join(',')}
          multiple
          className="hidden"
          id="file-upload-input"
        />

        <label htmlFor="file-upload-input" className="cursor-pointer">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-sm text-gray-600 mb-1">
            <span className="font-medium text-mainBlack">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            {allowedTypes.join(', ')} up to {maxFileSize / (1024 * 1024)}MB each
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Maximum {maxFiles} files, {maxFiles * (maxFileSize / (1024 * 1024))}MB total
          </p>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-mainBlack">Selected Files ({files.length})</h3>
            <button
              onClick={handleRemoveAll}
              className="text-sm text-red-600 hover:text-red-800"
              disabled={isUploading}
            >
              Remove All
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {files.map((file, index) => {
              const progress = uploadProgress[index] || {
                fileName: file.name,
                progress: 0,
                status: 'pending',
              };

              return (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-mainBlack truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                      {/* Show progress details */}
                      {progress.status === 'uploading' && (
                        <div className="text-xs text-gray-600 mt-1">
                          {progress.speed && <span>{progress.speed} • </span>}
                          {progress.eta && <span>ETA: {progress.eta}</span>}
                        </div>
                      )}

                      {/* Show error */}
                      {progress.error && (
                        <p className="text-xs text-red-600 mt-1">Error: {progress.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {progress.status === 'uploading' && (
                      <div className="w-16 h-16 relative">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="#E5E7EB"
                            strokeWidth="4"
                            fill="none"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="#F97316"
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray="176"
                            strokeDashoffset={176 - (176 * progress.progress) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-mainOrange">{progress.progress}%</span>
                        </div>
                      </div>
                    )}

                    {progress.status === 'completed' && (
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {progress.status === 'error' && (
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}

                    {progress.status === 'paused' && (
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}

                    {!['uploading', 'completed', 'error', 'paused'].includes(progress.status) && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-600"
                        disabled={isUploading}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}</div>
        </div>
      )}

      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-medium text-red-800 mb-2">Validation Errors</h3>
          <ul className="text-sm text-red-600 space-y-1">
            {Object.entries(validationErrors).map(([key, error]) => (
              <li key={key}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {files.length > 0 && !isUploading && (
          <button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className="flex-1 bg-mainOrange hover:bg-mainOrange/90 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Upload Images'}
          </button>
        )}

        {isUploading && (
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <button
              onClick={pauseUpload}
              disabled={!isUploading || isPaused}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Pause Upload
            </button>

            <button
              onClick={resumeUpload}
              disabled={!isPaused}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Resume Upload
            </button>
          </div>
        )}

        {files.length === 0 && !isUploading && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 bg-mainOrange hover:bg-mainOrange/90 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Select Files
          </button>
        )}
      </div>

      {/* Overall Progress */}
      {isUploading && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-mainBlack">Overall Progress</h3>
            <span className="text-sm text-gray-600">
              {overallProgress.completed} of {overallProgress.total} files
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-mainOrange h-3 rounded-full transition-all"
              style={{ width: `${overallProgress.totalProgress}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-sm text-gray-600">
            <span>{overallProgress.totalProgress}% Complete</span>
            <span>
              {overallProgress.speed && <span>{overallProgress.speed} • </span>}
              {overallProgress.eta && <span>ETA: {overallProgress.eta}</span>}
            </span>
          </div>
        </div>
      )}

      {/* API Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-3">
              <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-red-800 mb-1">Upload Error</h3>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Upload Tips</h3>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• Use high-quality, well-lit photos for best results</li>
          <li>• Remove backgrounds for cleaner AI processing</li>
          <li>• Upload multiple angles for more accurate models</li>
          <li>• Supported formats: {allowedTypes.join(', ')}</li>
          <li>• Maximum file size: {maxFileSize / (1024 * 1024)}MB per file</li>
        </ul>
      </div>
    </div>
  );
}