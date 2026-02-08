'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { FileUp, Loader2, Zap, CheckCircle2, Download, X, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const SUCCESS_MESSAGE_DURATION_MS = 5000;
const POLLING_INTERVAL_MS = 500; // Poll every 500ms

/** API base URL - Hugging Face Space veya lokal backend. Örn: https://kullanici-space.hf.space */
const API_URL = import.meta.env.VITE_API_URL
  || import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.DEV ? '/api' : 'http://localhost:10000');

function formatSizeMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

type JobStatus = 'pending' | 'uploading' | 'processing' | 'downloading' | 'completed' | 'failed';

interface JobStatusResponse {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  filename?: string;
  error?: string;
}

export const PDFtoWord = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const baseUrl = API_URL.replace(/\/$/, '');

  const resetState = useCallback(() => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setJobStatus(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const showSuccess = useCallback(() => {
    setSuccess(true);
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      setSuccess(false);
      resetState();
    }, SUCCESS_MESSAGE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [success, resetState]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (!dropped) return;
      if (dropped.type !== 'application/pdf' && !dropped.name.toLowerCase().endsWith('.pdf')) {
        setError(t.pdfToWord.errors.notPdf);
        return;
      }
      if (dropped.size > MAX_FILE_SIZE_BYTES) {
        setError(t.pdfToWord.errors.fileTooBig.replace('{max}', String(MAX_FILE_SIZE_MB)));
        return;
      }
      setError(null);
      setFile(dropped);
    },
    [t.pdfToWord.errors.notPdf, t.pdfToWord.errors.fileTooBig]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      e.target.value = '';
      if (!selected) return;
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        setError(t.pdfToWord.errors.notPdf);
        return;
      }
      if (selected.size > MAX_FILE_SIZE_BYTES) {
        setError(t.pdfToWord.errors.fileTooBig.replace('{max}', String(MAX_FILE_SIZE_MB)));
        return;
      }
      setError(null);
      setFile(selected);
    },
    [t.pdfToWord.errors.notPdf, t.pdfToWord.errors.fileTooBig]
  );

  // Poll job status
  const pollJobStatus = useCallback(
    async (currentJobId: string) => {
      try {
        const response = await axios.get<JobStatusResponse>(
          `${baseUrl}/convert/status/${currentJobId}`
        );
        const status = response.data;
        setJobStatus(status);

        if (status.status === 'completed') {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Download the file
          const downloadUrl = `${baseUrl}/convert/download/${currentJobId}`;
          const downloadResponse = await axios.get(downloadUrl, {
            responseType: 'blob',
          });

          const blob = downloadResponse.data as Blob;
          const contentDisposition = downloadResponse.headers['content-disposition'];
          let filename = status.filename || 'converted.docx';
          if (contentDisposition) {
            const match = /filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i.exec(contentDisposition);
            if (match?.[1]) filename = match[1].trim();
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          setLoading(false);
          showSuccess();
        } else if (status.status === 'failed') {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setLoading(false);
          setError(status.error || 'Dönüştürme işlemi başarısız oldu');
        }
      } catch (err) {
        console.error('[PDFtoWord] Status polling hatası:', err);
        // Don't stop polling on network errors
      }
    },
    [baseUrl, showSuccess]
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Start conversion job
      const response = await axios.post<{ job_id: string; status: string }>(
        `${baseUrl}/convert/start`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      const { job_id } = response.data;

      // Start polling
      pollingIntervalRef.current = setInterval(() => {
        pollJobStatus(job_id);
      }, POLLING_INTERVAL_MS);

      // Poll immediately
      pollJobStatus(job_id);
    } catch (err) {
      let message = t.pdfToWord.errors.convertFailed;
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 413) {
          message = t.pdfToWord.errors.fileTooBig.replace('{max}', String(MAX_FILE_SIZE_MB));
        } else if (err.response?.data instanceof Blob) {
          try {
            const text = await (err.response.data as Blob).text();
            try {
              const parsed = JSON.parse(text) as { detail?: string };
              if (parsed.detail) message = parsed.detail;
            } catch {
              if (text.trim()) message = text;
            }
          } catch {
            // use default message
          }
        } else if (typeof err.response?.data === 'object' && err.response?.data && 'detail' in err.response.data) {
          message = String((err.response.data as { detail: string }).detail);
        }
      }
      setError(message);
      console.error('[PDFtoWord] Hata:', err);
      setLoading(false);
    }
  }, [file, baseUrl, t.pdfToWord.errors.convertFailed, t.pdfToWord.errors.fileTooBig, pollJobStatus]);

  const getStageIcon = (status: JobStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'failed':
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    }
  };

  return (
    <PDFPageLayout
      variant="pdf"
      title={t.pdfToWord.title}
      description={t.pdfToWord.description}
      icon={FileUp}
      maxWidth="max-w-3xl"
    >
      {!file ? (
        <PDFDropzone
          variant="pdf"
          inputId="pdf-to-word-input"
          dropText={t.pdfToWord.dropText}
          dropSubtext={t.pdfToWord.maxSize.replace('{max}', String(MAX_FILE_SIZE_MB))}
          isDragOver={isDragOver}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onFileInput={handleFileInput}
          accept=".pdf"
          multiple={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              document.getElementById('pdf-to-word-input')?.click();
            }
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* File info */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-sky-50/50 to-sky-50/50 dark:from-sky-950/30 dark:to-sky-950/30 border border-sky-200/30 dark:border-sky-800/30">
            <div className="flex-shrink-0 p-2 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600">
              <FileUp className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">{formatSizeMB(file.size)}</p>
            </div>

            {!loading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetState}
                className="flex-shrink-0 hover:bg-sky-100 dark:hover:bg-sky-900/30"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

                {/* Progress section */}
                {loading && jobStatus && (
                  <div className="space-y-4">
                    {/* Overall progress bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {getStageIcon(jobStatus.status)}
                          <span className="font-medium text-foreground">{jobStatus.message}</span>
                        </div>
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">
                          {jobStatus.progress}%
                        </span>
                      </div>
                      <div className="relative h-3 bg-sky-100 dark:bg-sky-950/30 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-300 ease-out rounded-full"
                          style={{ width: `${jobStatus.progress}%` }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer" />
                        </div>
                      </div>
                    </div>

                    {/* Stage indicators */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {['uploading', 'processing', 'downloading', 'completed'].map((stage) => (
                        <div
                          key={stage}
                          className={cn(
                            "flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg transition-all duration-300",
                            jobStatus.status === stage || 
                            (stage === 'uploading' && jobStatus.progress >= 20) ||
                            (stage === 'processing' && jobStatus.progress >= 50) ||
                            (stage === 'downloading' && jobStatus.progress >= 90) ||
                            (stage === 'completed' && jobStatus.progress === 100)
                              ? "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
                              : "bg-gray-100 dark:bg-gray-800/30 text-gray-500"
                          )}
                        >
                          {stage === 'downloading' && jobStatus.status === 'downloading' && (
                            <Download className="w-3.5 h-3.5 animate-bounce" />
                          )}
                          <span className="font-medium capitalize">{stage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Convert button */}
                {!loading && !success && (
                  <Button
                    type="button"
                    onClick={handleConvert}
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    {t.pdfToWord.convert}
                  </Button>
                )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-6 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400 animate-in slide-in-from-top-2 duration-300">
          {error}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="mt-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400 animate-in slide-in-from-top-2 duration-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          {t.pdfToWord.successMessage}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-8 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          Powered by Adobe PDF Services • Real-time Progress Tracking
        </p>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </PDFPageLayout>
  );
};