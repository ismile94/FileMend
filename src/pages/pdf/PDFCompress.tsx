'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Minimize2, FileText, Trash2, Download, CheckCircle, AlertCircle, Plus, Info } from 'lucide-react';

import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { compressPDF, checkHealth, APIError } from '@/config/api';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type CompressionLevel = 'low' | 'medium' | 'extreme';

// Minimum dosya boyutu: 500KB
const MIN_FILE_SIZE = 500 * 1024;

interface FileStatus {
  file: File;
  id: string;
  compressedBlob?: Blob;
  originalSize: number;
  compressedSize?: number;
  compressionRatio?: number;
  isProcessing: boolean;
  error?: string;
  progress?: number;
  compressionLevel?: CompressionLevel;
  wasAlreadyOptimized?: boolean;
  tooSmall?: boolean;
  stats?: {
    textPages?: number;
    imagePages?: number;
    hybridPages?: number;
    imagesCompressed?: number;
  };
}

export const PDFCompress = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isCompressingAll, setIsCompressingAll] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const fileListInputRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [rememberDeleteChoice, setRememberDeleteChoice] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const getFilesToCompress = useCallback(() => {
    return files.filter(f => !f.isProcessing && !f.compressedBlob && !f.tooSmall && !f.error);
  }, [files]);

  const handleFilesDrop = useCallback((fileList: FileList) => {
    const pdfFiles = Array.from(fileList).filter(
      f => f.type === 'application/pdf' || f.name.endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      toast({
        title: t.messages.error,
        description: `${t.messages.pleaseUpload} ${t.messages.pdfFile}`,
        variant: 'destructive',
      });
      return;
    }

    const processedFiles = pdfFiles.map(file => {
      const isTooSmall = file.size < MIN_FILE_SIZE;
      
      if (isTooSmall) {
        toast({
          title: "Dosya çok küçük",
          description: `${file.name} (${formatFileSize(file.size)}) - Sıkıştırma için minimum 500KB gereklidir.`,
          variant: 'default',
        });
      }
      
      return {
        file,
        id: Math.random().toString(36).substr(2, 9),
        originalSize: file.size,
        isProcessing: false,
        tooSmall: isTooSmall,
        error: isTooSmall ? 'Dosya boyutu 500KB altında olduğu için sıkıştırılamaz' : undefined,
      };
    });

    const newFiles = processedFiles
      .filter(pdf => !files.some(existing => 
        existing.file.name === pdf.file.name && existing.file.size === pdf.file.size
      ));

    if (newFiles.length < processedFiles.length) {
      toast({
        title: t.messages.success,
        description: t.pdfCompress.duplicateSkipped,
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, [files, toast, t.messages.error, t.messages.pleaseUpload, t.messages.pdfFile, t.messages.success, t.pdfCompress.duplicateSkipped]);

  useEffect(() => {
    const checkBackendHealth = async () => {
      const isHealthy = await checkHealth();
      if (!isHealthy) {
        console.warn('PDF Compress backend service is not available');
      }
    };

    checkBackendHealth();
  }, []);

  const compressSingleFile = async (fileId: string, level?: CompressionLevel) => {
    const fileStatus = files.find(f => f.id === fileId);
    if (!fileStatus || fileStatus.tooSmall) return;

    const currentLevel = level || compressionLevel;

    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, isProcessing: true, error: undefined, progress: 0 } : f
    ));

    try {
      const result = await compressPDF(
        fileStatus.file,
        currentLevel,
        (progress) => {
          setFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, progress: Math.round(progress) } : f
          ));
        }
      );

      // Stats (Ghostscript'te olmayabilir)
      const textPages = result.stats?.textPages || 0;
      const imagePages = result.stats?.imagePages || 0;
      const hybridPages = result.stats?.hybridPages || 0;
      const imagesCompressed = result.stats?.imagesCompressed || 0;

      const size = result.compressedSize > 0 ? result.compressedSize : result.blob.size;
      const ratio = result.originalSize > 0
        ? ((result.originalSize - size) / result.originalSize) * 100
        : result.compressionRatio;

      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? {
              ...f,
              compressedBlob: result.blob,
              compressedSize: size,
              compressionRatio: ratio,
              isProcessing: false,
              progress: 100,
              compressionLevel: currentLevel,
              wasAlreadyOptimized: result.wasAlreadyOptimized,
              stats: textPages > 0 || imagePages > 0 || hybridPages > 0 ? {
                textPages,
                imagePages,
                hybridPages,
                imagesCompressed
              } : undefined
            }
          : f
      ));

      if (result.wasAlreadyOptimized) {
        toast({
          title: t.pdfCompress.info,
          description: `${fileStatus.file.name} ${t.pdfCompress.alreadyOptimizedMessage}`,
        });
      } else {
        const levelLabel = currentLevel === 'low' ? t.pdfCompress.levelLow : currentLevel === 'medium' ? t.pdfCompress.levelMedium : t.pdfCompress.levelHigh;
        
        // Ghostscript kullanıldığında stats olmayabilir
        const modeInfo = hybridPages > 0 
          ? `${textPages} metin, ${hybridPages} hibrit, ${imagePages} görsel sayfa`
          : textPages > 0 || imagePages > 0
          ? `${textPages} metin, ${imagePages} görsel sayfa`
          : '';

        toast({
          title: t.messages.success,
          description: `${fileStatus.file.name} - %${Math.round(ratio)} küçültme${modeInfo ? ` (${levelLabel} - ${modeInfo})` : ` (${levelLabel})`}`,
        });
      }
    } catch (error) {
      console.error('Compression error:', error);

      let errorMessage = t.pdfCompress.unknownError;

      if (error instanceof APIError) {
        const errorData = error.data as { code?: string; message?: string } | undefined;
        
        if (error.status === 400 && errorData?.code === 'FILE_TOO_SMALL') {
          errorMessage = errorData?.message || 'Dosya boyutu çok küçük (min 500KB)';
          setFiles(prev => prev.map(f =>
            f.id === fileId
              ? { ...f, isProcessing: false, error: errorMessage, tooSmall: true, progress: 0 }
              : f
          ));
          
          toast({
            title: "Sıkıştırma yapılamadı",
            description: errorMessage,
            variant: 'default',
          });
          return;
        } else if (error.status === 413) {
          errorMessage = t.pdfCompress.errors.fileTooLarge;
        } else if (error.status === 408) {
          errorMessage = t.pdfCompress.errors.requestTimeout;
        } else {
          errorMessage = error.message;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, isProcessing: false, error: errorMessage, progress: 0 }
          : f
      ));

      toast({
        title: t.messages.error,
        description: `${fileStatus.file.name} ${t.pdfCompress.couldNotCompress}. ${errorMessage}`,
        variant: 'destructive',
      });
    }
  };

  const compressAllFiles = async () => {
    const filesToCompress = getFilesToCompress();
    
    if (filesToCompress.length === 0) {
      const hasSmallFiles = files.some(f => f.tooSmall && !f.compressedBlob);
      
      if (hasSmallFiles) {
        toast({
          title: "Sıkıştırılabilir dosya yok",
          description: "Tüm dosyalar 500KB altında olduğu için sıkıştırılamaz. Sadece 500KB üzerindeki dosyalar sıkıştırılabilir.",
          variant: 'default',
        });
      } else {
        toast({
          title: t.pdfCompress.info,
          description: t.pdfCompress.noFilesToCompress,
        });
      }
      return;
    }

    setIsCompressingAll(true);
    setOverallProgress(0);

    for (let i = 0; i < filesToCompress.length; i++) {
      await compressSingleFile(filesToCompress[i].id, compressionLevel);
      setOverallProgress(Math.round(((i + 1) / filesToCompress.length) * 100));
    }

    setIsCompressingAll(false);
    toast({
      title: t.pdfCompress.allDone,
      description: t.pdfCompress.filesCompressed.replace('{count}', String(filesToCompress.length)),
    });
  };

  const removeFile = (id: string, skipConfirmation = false) => {
    if (!skipConfirmation && !rememberDeleteChoice) {
      setShowDeleteConfirm(id);
      return;
    }
    
    setFiles(prev => prev.filter(f => f.id !== id));
    setShowDeleteConfirm(null);
    
    toast({
      title: t.pdfCompress.deleteFile,
      description: t.pdfCompress.fileRemoved,
    });
  };

  const downloadSingleFile = (fileId: string) => {
    const fileStatus = files.find(f => f.id === fileId);
    if (!fileStatus?.compressedBlob) return;

    const url = URL.createObjectURL(fileStatus.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    const filename = fileStatus.wasAlreadyOptimized 
      ? fileStatus.file.name 
      : `${t.pdfCompress.downloadPrefix}${fileStatus.file.name}`;
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t.pdfCompress.downloaded,
      description: fileStatus.file.name,
    });
  };

  const downloadAllAsZip = async () => {
    const compressedFiles = files.filter(f => f.compressedBlob);
    if (compressedFiles.length === 0) {
      toast({
        title: t.messages.error,
        description: t.pdfCompress.noCompressedToDownload,
        variant: 'destructive',
      });
      return;
    }

    try {
      const zip = new JSZip();
      
      compressedFiles.forEach(fileStatus => {
        const filename = fileStatus.wasAlreadyOptimized 
          ? fileStatus.file.name 
          : `${t.pdfCompress.downloadPrefix}${fileStatus.file.name}`;
        zip.file(filename, fileStatus.compressedBlob!);
      });
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipDate = new Date().toISOString().split('T')[0];
      saveAs(zipBlob, `${t.pdfCompress.zipFilenamePrefix}${zipDate}.zip`);
      
      toast({
        title: t.messages.success,
        description: t.pdfCompress.zipDownloaded.replace('{count}', String(compressedFiles.length)),
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.pdfCompress.zipError,
        variant: 'destructive',
      });
    }
  };

  const getStats = () => {
    const totalOriginal = files.reduce((sum, f) => sum + f.originalSize, 0);
    const totalCompressed = files.reduce((sum, f) => sum + (f.compressedSize || 0), 0);
    const totalSaved = totalOriginal - totalCompressed;
    const avgCompression = files.filter(f => f.compressionRatio !== undefined && f.compressionRatio > 0)
      .reduce((sum, f) => sum + f.compressionRatio!, 0) / files.filter(f => f.compressionRatio !== undefined && f.compressionRatio > 0).length || 0;
    
    return {
      totalOriginal,
      totalCompressed,
      totalSaved,
      avgCompression: avgCompression || 0,
      fileCount: files.length,
      compressedCount: files.filter(f => f.compressedBlob).length,
      alreadyOptimizedCount: files.filter(f => f.wasAlreadyOptimized).length,
      tooSmallCount: files.filter(f => f.tooSmall).length,
    };
  };

  const stats = getStats();
  const filesToCompress = getFilesToCompress();
  const canCompress = filesToCompress.length > 0;
  const hasSmallFiles = files.some(f => f.tooSmall && !f.compressedBlob);

  return (
    <PDFPageLayout
      title={t.pdfCompress.title}
      description={t.pdfCompress.description}
      icon={Minimize2}
      maxWidth="max-w-6xl"
      centerHeader={false}
    >
      {/* Info Banner - 500KB Rule */}
      {files.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <span className="font-semibold">{t.pdfCompress.infoBannerTitle}</span> {t.pdfCompress.infoBannerText}
            {hasSmallFiles && (
              <span className="block mt-1 text-blue-600 dark:text-blue-400">
                {t.pdfCompress.infoBannerSkipped.replace('{count}', String(stats.tooSmallCount))}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Card className="p-2 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-blue-600">{stats.fileCount}</span>
              <span className="text-sm text-muted-foreground">{t.pdfCompress.totalFiles}</span>
            </div>
          </Card>
          <Card className="p-2 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-green-600">{stats.compressedCount}</span>
              <span className="text-sm text-muted-foreground">{t.pdfCompress.compressed}</span>
            </div>
          </Card>
          <Card className="p-2 min-w-0">
            <div className="text-sm font-bold text-sky-600">{stats.compressedCount > 0 ? formatFileSize(stats.totalSaved) : t.pdfCompress.statsZeroSize}</div>
            <div className="text-xs text-muted-foreground">{stats.compressedCount > 0 ? (<>{formatFileSize(stats.totalOriginal)} → <span className="text-green-600">{formatFileSize(stats.totalCompressed)}</span></>) : t.pdfCompress.statsPlaceholder}</div>
          </Card>
          <Card className="p-2 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-purple-600">{Math.round(stats.avgCompression)}%</span>
              <span className="text-sm text-muted-foreground">{t.pdfCompress.avgCompression}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Compression Level Selection + How it Works */}
      {files.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t.pdfCompress.compressionLevelLabel}</span>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                type="button"
                onClick={() => setCompressionLevel('low')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-all",
                  compressionLevel === 'low'
                    ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.pdfCompress.levelLow}
              </button>
              <button
                type="button"
                onClick={() => setCompressionLevel('medium')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-all",
                  compressionLevel === 'medium'
                    ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.pdfCompress.levelMedium}
              </button>
              <button
                type="button"
                onClick={() => setCompressionLevel('extreme')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-all",
                  compressionLevel === 'extreme'
                    ? "bg-white dark:bg-gray-800 shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.pdfCompress.levelHigh}
              </button>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              ({t.pdfCompress.levelDescriptions[compressionLevel]})
            </span>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm font-semibold text-sky-600 hover:underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-sky-500/20 rounded px-1"
              >
                {t.pdfCompress.howItWorks}
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.pdfCompress.howItWorksModalTitle}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>{t.pdfCompress.howItWorksIntroSmart}</p>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-foreground mb-1">{t.pdfCompress.textPagesTitle}</p>
                    <p className="text-xs">{t.pdfCompress.textPagesDesc}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">{t.pdfCompress.imagePagesTitle}</p>
                    <p className="text-xs">{t.pdfCompress.imagePagesDesc}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">{t.pdfCompress.hybridPagesTitle}</p>
                    <p className="text-xs">{t.pdfCompress.hybridPagesDesc}</p>
                  </div>
                </div>
                
                <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-900">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-1">{t.pdfCompress.minSizeTitle}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">{t.pdfCompress.minSizeText}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold">{t.pdfCompress.qualityLevelsTitle}</p>
                  <ul className="list-disc list-inside text-xs space-y-0.5 ml-1">
                    <li>{t.pdfCompress.qualityLowBullet}</li>
                    <li>{t.pdfCompress.qualityMediumBullet}</li>
                    <li>{t.pdfCompress.qualityHighBullet}</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Overall Progress */}
      {isCompressingAll && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t.pdfCompress.bulkCompress}</span>
              <span className="text-sm text-muted-foreground">{overallProgress}%</span>
            </div>
            <ProgressBar progress={overallProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* File Dropzone */}
      {files.length === 0 && (
        <PDFDropzone
          inputId="pdf-compress-input"
          dropText={t.pdfCompress.dropOrSelect}
          dropSubtext="PDF dosyaları (min 500KB) yükleyin. Küçük dosyalar otomatik olarak atlanır."
          isDragOver={isDragOver}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const fileList = e.dataTransfer.files;
            if (fileList.length > 0) handleFilesDrop(fileList);
          }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
          onFileInput={(e) => e.target.files && handleFilesDrop(e.target.files)}
          accept=".pdf"
          multiple
        />
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">{t.pdfCompress.files} ({files.length})</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileListInputRef.current?.click()}
                className="text-sky-600 border-sky-200 hover:bg-sky-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{t.pdfCompress.addFile}</span>
              </Button>
              <input
                ref={fileListInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFilesDrop(e.target.files)}
              />
              <Button 
                onClick={compressAllFiles}
                disabled={!canCompress || isCompressingAll}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                size="sm"
              >
                <Minimize2 className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">
                  {isCompressingAll ? t.pdfCompress.compressing : 
                   !canCompress ? t.pdfCompress.noCompressibleFiles : t.pdfCompress.compressAll}
                </span>
              </Button>
              {files.some(f => f.compressedBlob) && (
                <Button 
                  variant="outline"
                  onClick={downloadAllAsZip}
                  className="border-green-600 text-green-600 hover:bg-green-50"
                  size="sm"
                >
                  <Download className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t.pdfCompress.downloadZip}</span>
                </Button>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {files.map(({ file, id, compressedBlob, originalSize, compressedSize, compressionRatio, isProcessing, error, progress, compressionLevel: fileLevel, wasAlreadyOptimized, tooSmall, stats }) => (
                <Card key={id} className={cn(
                  "overflow-hidden transition-all duration-200 hover:shadow-lg",
                  isProcessing && "ring-2 ring-blue-200",
                  error && !tooSmall && "ring-2 ring-red-200",
                  tooSmall && "ring-2 ring-amber-200 opacity-75",
                  compressedBlob && !wasAlreadyOptimized && "ring-2 ring-green-200",
                  wasAlreadyOptimized && "ring-2 ring-amber-200"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        compressedBlob && !wasAlreadyOptimized ? "bg-green-50" : 
                        wasAlreadyOptimized || tooSmall ? "bg-amber-50" : "bg-red-50"
                      )}>
                        <FileText className={cn(
                          "w-5 h-5",
                          compressedBlob && !wasAlreadyOptimized ? "text-green-600" : 
                          wasAlreadyOptimized || tooSmall ? "text-amber-600" : "text-red-500"
                        )} />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate leading-tight" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(originalSize)} {tooSmall && "• 500KB altı"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {!compressedBlob && !isProcessing && !tooSmall && (
                              <Button
                                size="sm"
                                onClick={() => compressSingleFile(id)}
                                className="bg-blue-600 hover:bg-blue-700 h-7 text-xs px-2"
                              >
                                <Minimize2 className="w-4 h-4" />
                              </Button>
                            )}
                            {tooSmall && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                Atlandı
                              </span>
                            )}
                            {compressedBlob && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => downloadSingleFile(id)}
                                className="border-green-600 text-green-600 hover:bg-green-50 h-7 text-xs px-2"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                            <button 
                              onClick={() => removeFile(id)}
                              className="p-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 rounded shrink-0 text-red-600 hover:text-red-700 transition-colors"
                              aria-label={t.pdfCompress.removeFile}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Boyut bilgisi */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          {(compressedBlob != null) && (
                            <>
                              <span className="text-slate-400">→</span>
                              <span className={cn(
                                "font-medium",
                                wasAlreadyOptimized ? "text-amber-600" : "text-green-600"
                              )}>
                                {formatFileSize(compressedSize ?? compressedBlob.size)}
                              </span>
                              {!wasAlreadyOptimized && compressionRatio !== undefined && compressionRatio > 0 && (
                                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">
                                  -{Math.round(compressionRatio)}%
                                </span>
                              )}
                              {wasAlreadyOptimized && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                                  {t.pdfCompress.optimized}
                                </span>
                              )}
                              {fileLevel && !wasAlreadyOptimized && (
                                <span className="text-xs text-muted-foreground">
                                  · {fileLevel === 'low' ? t.pdfCompress.levelLow : fileLevel === 'medium' ? t.pdfCompress.levelMedium : t.pdfCompress.levelHigh}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Sayfa istatistikleri (sadece varsa göster) */}
                        {compressedBlob && stats && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(stats.textPages ?? 0) > 0 && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                {t.pdfCompress.statsTextPages.replace('{count}', String(stats.textPages))}
                              </span>
                            )}
                            {(stats.hybridPages ?? 0) > 0 && (
                              <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">
                                {t.pdfCompress.statsHybridPages.replace('{count}', String(stats.hybridPages))}
                              </span>
                            )}
                            {(stats.imagePages ?? 0) > 0 && (
                              <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                                {t.pdfCompress.statsImagePages.replace('{count}', String(stats.imagePages))}
                              </span>
                            )}
                            {(stats.imagesCompressed ?? 0) > 0 && (
                              <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                                {t.pdfCompress.statsImagesCompressed.replace('{count}', String(stats.imagesCompressed))}
                              </span>
                            )}
                          </div>
                        )}

                        {isProcessing && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-sky-600">{t.pdfCompress.compressing}</span>
                              <span className="text-muted-foreground">{progress || 0}%</span>
                            </div>
                            <ProgressBar progress={progress || 0} className="h-1" />
                          </div>
                        )}

                        {error && !tooSmall && (
                          <div className="flex items-center gap-1 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-1.5 rounded">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span className="line-clamp-2">{error}</span>
                          </div>
                        )}

                        {tooSmall && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-1.5 rounded">
                            <Info className="w-3 h-3 shrink-0" />
                            {t.pdfCompress.tooSmallWarning}
                          </div>
                        )}

                        {compressedBlob && !isProcessing && !wasAlreadyOptimized && (
                          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 p-1.5 rounded">
                            <CheckCircle className="w-3 h-3" />
                            {t.pdfCompress.successCompressedShort}
                          </div>
                        )}

                        {wasAlreadyOptimized && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-1.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            {t.pdfCompress.alreadyOptimizedCard}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t.pdfCompress.deleteFile}</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t.pdfCompress.deleteConfirm}
            </p>
            
            <div className="flex items-center gap-2 mb-6">
              <input
                type="checkbox"
                id="remember-choice"
                checked={rememberDeleteChoice}
                onChange={(e) => setRememberDeleteChoice(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="remember-choice" className="text-sm">
                {t.pdfCompress.dontAskAgain}
              </label>
            </div>

            <div className="flex gap-3 justify-end w-full">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(null)}
                className="px-6 py-2 min-w-[80px]"
              >
                {t.pdfCompress.cancel}
              </Button>
              <Button
                onClick={() => removeFile(showDeleteConfirm, true)}
                className="bg-red-600 hover:bg-red-700 px-6 py-2 min-w-[80px]"
              >
                {t.pdfCompress.delete}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PDFPageLayout>
  );
};