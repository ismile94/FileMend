'use client';

import { useState, useCallback, useRef } from 'react';
import { Minimize2, FileText, Trash2, Download, CheckCircle, AlertCircle, Plus } from 'lucide-react';

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
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type CompressionLevel = 'low' | 'medium' | 'extreme';

// Her seviye için optimize parametreler
function getSettingsForLevel(level: CompressionLevel): { 
  scale: number; 
  imageQuality: number; 
  textThreshold: number;
  minCompressionPercent: number; // Minimum kazanç oranı
  description: string;
} {
  switch (level) {
    case 'low':
      return { 
        scale: 1, 
        imageQuality: 0.85,
        textThreshold: 0.05, // Daha agresif: az metin bile olsa kopyala
        minCompressionPercent: 3, // En az %3 küçülme olmalı
        description: 'En yüksek kalite, en az sıkıştırma'
      };
    case 'medium':
      return { 
        scale: 1, 
        imageQuality: 0.65,
        textThreshold: 0.10,
        minCompressionPercent: 5,
        description: 'Dengeli kalite ve boyut'
      };
    case 'extreme':
      return { 
        scale: 0.85, 
        imageQuality: 0.45,
        textThreshold: 0.20, // Daha az sayfa text-heavy sayılır
        minCompressionPercent: 10,
        description: 'Maksimum sıkıştırma'
      };
    default:
      return { scale: 1, imageQuality: 0.65, textThreshold: 0.10, minCompressionPercent: 5, description: 'Dengeli' };
  }
}

/**
 * Sayfanın metin ağırlıklı mı yoksa görsel ağırlıklı mı olduğunu tahmin eder.
 */
async function isPageTextHeavy(
  page: pdfjsLib.PDFPageProxy, 
  textThreshold: number
): Promise<boolean> {
  const viewport = page.getViewport({ scale: 1 });
  const pageArea = viewport.width * viewport.height;
  if (pageArea <= 0) return true;

  const textContent = await page.getTextContent();
  let textArea = 0;
  
  for (const item of textContent.items) {
    if ('str' in item && typeof (item as { width?: number; height?: number }).width === 'number' && typeof (item as { width?: number; height?: number }).height === 'number') {
      const w = (item as { width: number; height: number }).width;
      const h = (item as { width: number; height: number }).height;
      textArea += w * h;
    }
  }
  
  const ratio = textArea / pageArea;
  return ratio >= textThreshold;
}

/** Sayfayı canvas'a çizip JPEG blob döner */
const renderPageToJpeg = (
  page: pdfjsLib.PDFPageProxy,
  scale: number,
  imageQuality: number,
  errors: { canvasContext: string; toBlob: string }
): Promise<{ blob: Blob; widthPt: number; heightPt: number }> => {
  const viewport = page.getViewport({ scale });
  const sizePt = page.getViewport({ scale: 1 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return Promise.reject(new Error(errors.canvasContext));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return page
    .render({ canvasContext: ctx, viewport, background: 'white' })
    .promise.then(() => {
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error(errors.toBlob))),
          'image/jpeg',
          imageQuality
        );
      });
    })
    .then((blob) => ({ blob, widthPt: sizePt.width, heightPt: sizePt.height }));
};

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
  wasAlreadyOptimized?: boolean; // Zaten optimize mi?
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
    return files.filter(f => !f.isProcessing && !f.compressedBlob);
  }, [files]);

  // Dosya seçildiğinde
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

    // Duplicate önleme
    const newFiles = pdfFiles
      .filter(pdf => !files.some(existing => 
        existing.file.name === pdf.name && existing.file.size === pdf.size
      ))
      .map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        originalSize: file.size,
        isProcessing: false,
      }));

    if (newFiles.length < pdfFiles.length) {
      toast({
        title: t.messages.success,
        description: t.pdfCompress.duplicateSkipped,
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
  }, [files, toast, t.messages.error, t.messages.pleaseUpload, t.messages.pdfFile, t.messages.success, t.pdfCompress.duplicateSkipped]);

  const compressSingleFile = async (fileId: string, level?: CompressionLevel) => {
    const fileStatus = files.find(f => f.id === fileId);
    if (!fileStatus) return;

    const currentLevel = level || compressionLevel;
    const settings = getSettingsForLevel(currentLevel);

    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, isProcessing: true, error: undefined, progress: 0 } : f
    ));

    try {
      const arrayBuffer = await fileStatus.file.arrayBuffer();
      const bufferForPdfJs = arrayBuffer.slice(0);
      const bufferForPdfLib = arrayBuffer.slice(0);

      setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: 5 } : f)));
      const renderErrors = {
        canvasContext: t.pdfCompress.errors.canvasContextMissing,
        toBlob: t.pdfCompress.errors.toBlobFailed,
      };

      // Hybrid yaklaşım: Her sayfayı analiz et
      const pdfJsDoc = await pdfjsLib.getDocument({ data: bufferForPdfJs }).promise;
      const sourcePdf = await PDFDocument.load(bufferForPdfLib);
      const numPages = pdfJsDoc.numPages;
      const outPdf = await PDFDocument.create();

      let textHeavyCount = 0;
      let imageHeavyCount = 0;

      for (let i = 0; i < numPages; i++) {
        const pct = 5 + Math.round(((i + 1) / numPages) * 90);
        setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: pct } : f)));

        const page = await pdfJsDoc.getPage(i + 1);
        const textHeavy = await isPageTextHeavy(page, settings.textThreshold);

        if (textHeavy) {
          // Text ağırlıklı sayfa: Lossless kopyala
          textHeavyCount++;
          const [copiedPage] = await outPdf.copyPages(sourcePdf, [i]);
          outPdf.addPage(copiedPage);
        } else {
          // Görsel ağırlıklı sayfa: JPEG'e çevir
          imageHeavyCount++;
          const { blob, widthPt, heightPt } = await renderPageToJpeg(
            page,
            settings.scale,
            settings.imageQuality,
            renderErrors
          );
          const jpegBytes = await blob.arrayBuffer();
          const image = await outPdf.embedJpg(jpegBytes);
          const pdfPage = outPdf.addPage([widthPt, heightPt]);
          pdfPage.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });
        }
      }

      setFiles(prev => prev.map(f => (f.id === fileId ? { ...f, progress: 95 } : f)));
      
      // PDF'i kaydet
      const pdfBytes = await outPdf.save({ 
        useObjectStreams: false, // Daha küçük dosya için
        addDefaultPage: false,
        objectsPerTick: 50,
      });
      
      const compressedBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const compressedSize = compressedBlob.size;
      const compressionRatio = ((fileStatus.originalSize - compressedSize) / fileStatus.originalSize) * 100;

      // KONTROL: Eğer dosya büyüdü veya çok az küçüldüyse, orijinali kullan
      let finalBlob = compressedBlob;
      let finalSize = compressedSize;
      let finalRatio = compressionRatio;
      let wasAlreadyOptimized = false;

      if (compressionRatio < settings.minCompressionPercent) {
        // Yeterli küçülme yok, orijinali kullan
        finalBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
        finalSize = fileStatus.originalSize;
        finalRatio = 0;
        wasAlreadyOptimized = true;
      }

      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? {
              ...f,
              compressedBlob: finalBlob,
              compressedSize: finalSize,
              compressionRatio: finalRatio,
              isProcessing: false,
              progress: 100,
              compressionLevel: currentLevel,
              wasAlreadyOptimized,
            }
          : f
      ));

      // Bilgilendirme mesajı
      if (wasAlreadyOptimized) {
        toast({
          title: 'Bilgi',
          description: `${fileStatus.file.name} zaten optimize edilmiş. Orijinal dosya korundu.`,
        });
      } else {
        const levelLabel = currentLevel === 'low' ? 'Düşük' : currentLevel === 'medium' ? 'Orta' : 'Yüksek';
        const modeInfo = imageHeavyCount > 0 
          ? `${textHeavyCount} sayfa korundu, ${imageHeavyCount} sayfa sıkıştırıldı`
          : 'Metin sayfaları optimize edildi';
        
        toast({
          title: t.messages.success,
          description: `${fileStatus.file.name} - %${Math.round(compressionRatio)} küçültme (${levelLabel} - ${modeInfo})`,
        });
      }
    } catch (error) {
      console.error(t.pdfCompress.log.compressionError, error);
      setFiles(prev => prev.map(f =>
        f.id === fileId
          ? { ...f, isProcessing: false, error: t.pdfCompress.compressionFailed, progress: 0 }
          : f
      ));

      const message = error instanceof Error ? error.message : t.pdfCompress.unknownError;
      toast({
        title: t.messages.error,
        description: `${fileStatus.file.name} ${t.pdfCompress.couldNotCompress}. ${message}`,
        variant: 'destructive',
      });
    }
  };

  // Toplu sıkıştırma
  const compressAllFiles = async () => {
    const filesToCompress = getFilesToCompress();
    
    if (filesToCompress.length === 0) {
      toast({
        title: t.pdfCompress.info,
        description: t.pdfCompress.noFilesToCompress,
      });
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

  // Dosya silme
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

  // Tek dosya indirme
  const downloadSingleFile = (fileId: string) => {
    const fileStatus = files.find(f => f.id === fileId);
    if (!fileStatus?.compressedBlob) return;

    const url = URL.createObjectURL(fileStatus.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    
    // Eğer zaten optimize edilmişse orijinal ismi kullan
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

  // ZIP olarak indir
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

  // İstatistikler
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
    };
  };

  const stats = getStats();
  const filesToCompress = getFilesToCompress();
  const canCompress = filesToCompress.length > 0;
  const currentSettings = getSettingsForLevel(compressionLevel);

  // Kalite seviyesi etiketleri
  const qualityLabels = {
    low: t.pdfCompress?.qualityLow || 'Low',
    medium: t.pdfCompress?.qualityMedium || 'Medium',
    extreme: t.pdfCompress?.qualityExtreme || 'Extreme',
  };

  return (
    <PDFPageLayout
      title={t.pdfCompress.title}
      description={t.pdfCompress.description}
      icon={Minimize2}
      maxWidth="max-w-6xl"
      centerHeader={false}
    >
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
          {/* Compression Level Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Sıkıştırma Seviyesi:</span>
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
                Düşük
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
                Orta
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
                Yüksek
              </button>
            </div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              ({currentSettings.description})
            </span>
          </div>

          {/* How it Works */}
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
                <DialogTitle>Sıkıştırma Nasıl Çalışır?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  PDF'leriniz sayfa sayfa analiz edilir ve her sayfa içeriğine göre en uygun yöntem uygulanır.
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-foreground mb-1">📝 Metin Ağırlıklı Sayfalar</p>
                    <p className="text-xs">
                      Seçilebilir yazılar, tablolar içeren sayfalar <strong>kayıpsız</strong> kopyalanır. 
                      Yazılar seçilebilir kalır.
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-1">🖼️ Görsel Ağırlıklı Sayfalar</p>
                    <p className="text-xs">
                      Resim ve grafikler içeren sayfalar seçilen seviyeye göre sıkıştırılır:
                    </p>
                    <ul className="list-disc list-inside text-xs mt-1 ml-2 space-y-0.5">
                      <li><strong>Düşük:</strong> %85 kalite - En yüksek görsel kalite</li>
                      <li><strong>Orta:</strong> %65 kalite - Dengeli</li>
                      <li><strong>Yüksek:</strong> %45 kalite - Maksimum sıkıştırma</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs bg-sky-50 dark:bg-sky-950/20 p-2 rounded border border-sky-200 dark:border-sky-900">
                  <strong>⚠️ Önemli:</strong> Eğer sıkıştırma sonrası dosya büyürse veya çok az küçülürse, 
                  orijinal dosya otomatik olarak korunur.
                </p>
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
          dropSubtext={t.pdfCompress.multipleSupported}
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
                   !canCompress ? t.pdfCompress.compressAllDone : t.pdfCompress.compressAll}
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
            {files.map(({ file, id, compressedBlob, originalSize, compressedSize, compressionRatio, isProcessing, error, progress, compressionLevel: fileLevel, wasAlreadyOptimized }) => (
                <Card key={id} className={cn(
                  "overflow-hidden transition-all duration-200 hover:shadow-lg",
                  isProcessing && "ring-2 ring-blue-200",
                  error && "ring-2 ring-red-200",
                  compressedBlob && !wasAlreadyOptimized && "ring-2 ring-green-200",
                  wasAlreadyOptimized && "ring-2 ring-amber-200"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "p-1.5 rounded-lg shrink-0",
                        compressedBlob && !wasAlreadyOptimized ? "bg-green-50" : 
                        wasAlreadyOptimized ? "bg-amber-50" : "bg-red-50"
                      )}>
                        <FileText className={cn(
                          "w-5 h-5",
                          compressedBlob && !wasAlreadyOptimized ? "text-green-600" : 
                          wasAlreadyOptimized ? "text-amber-600" : "text-red-500"
                        )} />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate leading-tight">
                            {file.name}
                          </p>
                          <div className="flex items-center gap-1">
                            {!compressedBlob && !isProcessing && (
                              <Button
                                size="sm"
                                onClick={() => compressSingleFile(id)}
                                className="bg-blue-600 hover:bg-blue-700 h-7 text-xs px-2"
                              >
                                <Minimize2 className="w-4 h-4" />
                              </Button>
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
                        
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatFileSize(originalSize)}</span>
                          {compressedSize && (
                            <>
                              <span className="text-slate-300">→</span>
                              <span className={cn(
                                "font-medium",
                                wasAlreadyOptimized ? "text-amber-600" : "text-green-600"
                              )}>
                                {formatFileSize(compressedSize)}
                              </span>
                              {!wasAlreadyOptimized && compressionRatio !== undefined && compressionRatio > 0 && (
                                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1 py-0.5 rounded-full">
                                  -{Math.round(compressionRatio)}%
                                </span>
                              )}
                              {wasAlreadyOptimized && (
                                <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1 py-0.5 rounded-full">
                                  Optimize
                                </span>
                              )}
                              {fileLevel && !wasAlreadyOptimized && (
                                <span className="text-xs text-muted-foreground">
                                  · {fileLevel === 'low' ? 'Düşük' : fileLevel === 'medium' ? 'Orta' : 'Yüksek'}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        {/* Progress Bar */}
                        {isProcessing && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-sky-600">{t.pdfCompress.compressing}</span>
                              <span className="text-muted-foreground">{progress || 0}%</span>
                            </div>
                            <ProgressBar progress={progress || 0} className="h-1" />
                          </div>
                        )}

                        {/* Error */}
                        {error && (
                          <div className="flex items-center gap-1 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 p-1.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                          </div>
                        )}

                        {/* Success */}
                        {compressedBlob && !isProcessing && !wasAlreadyOptimized && (
                          <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/20 p-1.5 rounded">
                            <CheckCircle className="w-3 h-3" />
                            {t.pdfCompress.successCompressedShort}
                          </div>
                        )}

                        {/* Already Optimized */}
                        {wasAlreadyOptimized && (
                          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-1.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Dosya zaten optimize
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
