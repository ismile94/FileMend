import React, { useState, useCallback, useEffect } from 'react';
import { Merge, ArrowUp, ArrowDown, Trash2, Download, FileAudio, Loader2 } from 'lucide-react';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { useDragDrop } from '@/hooks/useDragDrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, formatFileSize } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';

export const AudioMerge: React.FC = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const { loaded, loading, loadFFmpeg, mergeAudio, progress } = useFFmpeg();
  const { toast } = useToast();

  useEffect(() => {
    if (!loaded && !loading) {
      loadFFmpeg().catch(() => {
        toast({
          title: t.messages.error,
          description: t.messages.ffmpegError,
          variant: 'destructive',
        });
      });
    }
  }, [loaded, loading, loadFFmpeg, toast]);

  const handleFilesDrop = useCallback((fileList: FileList) => {
    const audioFiles = Array.from(fileList).filter(
      f => f.type.startsWith('audio/') || 
           ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'].some(ext => 
             f.name.toLowerCase().endsWith(ext)
           )
    );

    if (audioFiles.length === 0) {
      toast({
        title: t.messages.error,
        description: `${t.messages.pleaseUpload} ${t.messages.audioFiles} ${t.messages.filesUpload}`,
        variant: 'destructive',
      });
      return;
    }

    setFiles(prev => [...prev, ...audioFiles]);
  }, [toast]);

  const handleClear = () => {
    setFiles([]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (direction === 'up' && index > 0) {
        [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
      } else if (direction === 'down' && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      }
      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({
        title: t.messages.error,
        description: t.audioMerge.minFilesError,
        variant: 'destructive',
      });
      return;
    }

    setMerging(true);
    try {
      const ext = files[0].name.split('.').pop() || 'mp3';
      const blob = await mergeAudio(files, ext);
      downloadBlob(blob, `birlesik.${ext}`);
      
      toast({
        title: t.messages.success,
        description: t.audioMerge.filesMerged,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.audioMerge.mergeError,
        variant: 'destructive',
      });
    } finally {
      setMerging(false);
    }
  };

  const isProcessing = loading || merging;
  const { isDragging, handleDragOver, handleDragLeave, handleDrop, handleFileInput } = useDragDrop({
    onFilesDrop: handleFilesDrop,
    accept: 'audio/*',
    multiple: true,
  });

  return (
    <PDFPageLayout
      variant="audio"
      title={t.audioMerge.title}
      description={t.audioMerge.description}
      icon={Merge}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {!loaded && (
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t.audioMerge.loadingLibrary}
              </p>
            </CardContent>
          </Card>
        )}

        <PDFDropzone
          variant="audio"
          inputId="audio-merge-input"
          dropText={t.dropzone.dropTextActive}
          dropSubtext={t.dropzone.multipleFiles}
          isDragOver={isDragging}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(e);
          }}
          onDragOver={(e) => { e.preventDefault(); handleDragOver(e); }}
          onDragLeave={(e) => { e.preventDefault(); handleDragLeave(e); }}
          onFileInput={handleFileInput}
          accept="audio/*"
          multiple
        />

        {files.length > 0 && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClear}>
                {t.dropzone.clear}
              </Button>
            </div>
            <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t.audioMerge.sorting}</h3>
              <span className="text-sm text-muted-foreground">
                {t.audioMerge.filesCount.replace('{count}', files.length.toString())}
              </span>
            </div>

            <div className="space-y-2 mb-6">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                >
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    {index + 1}
                  </span>
                  <FileAudio className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveFile(index, 'up')}
                      disabled={index === 0}
                      className="h-8 w-8"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveFile(index, 'down')}
                      disabled={index === files.length - 1}
                      className="h-8 w-8"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {isProcessing && (
              <div className="mb-6">
                <ProgressBar 
                  progress={loading ? 0 : progress} 
                  label={loading ? t.audioMerge.loading : t.audioMerge.merging} 
                />
              </div>
            )}

            <Button
              onClick={handleMerge}
              disabled={isProcessing || files.length < 2 || !loaded}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                t.audioMerge.processing
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t.audioMerge.mergeAndDownload}
                </>
              )}
            </Button>
            </CardContent>
          </Card>
        </>
        )}
      </div>
    </PDFPageLayout>
  );
};
