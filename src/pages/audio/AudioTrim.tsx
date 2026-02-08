import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Scissors, Download, Loader2, Play, Pause } from 'lucide-react';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { useDragDrop } from '@/hooks/useDragDrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob } from '@/utils/fileHelpers';
import { useTranslation } from '@/contexts/LanguageContext';

export const AudioTrim: React.FC = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimming, setTrimming] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const { loaded, loading, loadFFmpeg, trimAudio, progress } = useFFmpeg();
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
    const audioFile = Array.from(fileList).find(
      f => f.type.startsWith('audio/') || 
           ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'].some(ext => 
             f.name.toLowerCase().endsWith(ext)
           )
    );

    if (!audioFile) {
      toast({
        title: t.messages.error,
        description: `${t.messages.pleaseUpload} ${t.messages.audioFile} ${t.messages.fileUpload}`,
        variant: 'destructive',
      });
      return;
    }

    setFile(audioFile);
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    
    // Get audio duration
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      setEndTime(audio.duration);
    });
  }, [toast]);

  const handleClear = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setFile(null);
    setAudioUrl(null);
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.currentTime = startTime;
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTrim = async () => {
    if (!file || !loaded) return;

    setTrimming(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const blob = await trimAudio(file, startTime, endTime, ext);
      const outputName = file.name.replace(/\.[^/.]+$/, `-trimmed.${ext}`);
      downloadBlob(blob, outputName);
      
      toast({
        title: t.messages.success,
        description: t.audioTrim.fileTrimmed,
      });
    } catch (error) {
      toast({
        title: t.messages.error,
        description: t.audioTrim.trimError,
        variant: 'destructive',
      });
    } finally {
      setTrimming(false);
    }
  };

  const isProcessing = loading || trimming;
  const { isDragging, handleDragOver, handleDragLeave, handleDrop, handleFileInput } = useDragDrop({
    onFilesDrop: handleFilesDrop,
    accept: 'audio/*',
    multiple: false,
  });

  return (
    <PDFPageLayout
      variant="audio"
      title={t.audioTrim.title}
      description={t.audioTrim.description}
      icon={Scissors}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {!loaded && (
          <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
            <CardContent className="p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-yellow-600" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                {t.audioTrim.loadingLibrary}
              </p>
            </CardContent>
          </Card>
        )}

        <PDFDropzone
          variant="audio"
          inputId="audio-trim-input"
          dropText={t.dropzone.dropTextActive}
          dropSubtext={t.dropzone.singleFile}
          isDragOver={isDragging}
          onDrop={(e) => {
            e.preventDefault();
            handleDrop(e);
          }}
          onDragOver={(e) => { e.preventDefault(); handleDragOver(e); }}
          onDragLeave={(e) => { e.preventDefault(); handleDragLeave(e); }}
          onFileInput={handleFileInput}
          accept="audio/*"
          multiple={false}
        />

        {file && audioUrl && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClear}>
                {t.dropzone.clear}
              </Button>
            </div>
            <Card>
              <CardContent className="p-6">
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-medium">{t.audioTrim.startTime}</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatTime(startTime)}
                </span>
              </div>
              <Slider
                value={[startTime]}
                onValueChange={(v) => {
                  setStartTime(v[0]);
                  if (v[0] >= endTime) setEndTime(Math.min(duration, v[0] + 1));
                }}
                max={duration}
                step={0.1}
              />
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-medium">{t.audioTrim.endTime}</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {formatTime(endTime)}
                </span>
              </div>
              <Slider
                value={[endTime]}
                onValueChange={(v) => {
                  setEndTime(v[0]);
                  if (v[0] <= startTime) setStartTime(Math.max(0, v[0] - 1));
                }}
                max={duration}
                step={0.1}
              />
            </div>

            <div className="flex items-center justify-between mb-6 p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">{t.audioTrim.selectedDuration}</span>
              <span className="font-medium">{formatTime(endTime - startTime)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={togglePlay}
                className="flex-1"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 mr-2" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                {isPlaying ? t.audioTrim.stop : t.audioTrim.preview}
              </Button>
              <Button
                onClick={handleTrim}
                disabled={isProcessing || !loaded}
                className="flex-1"
              >
                {isProcessing ? (
                  t.audioTrim.processing
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    {t.audioTrim.trimAndDownload}
                  </>
                )}
              </Button>
            </div>

            {isProcessing && (
              <div className="mt-4">
                <ProgressBar 
                  progress={loading ? 0 : progress} 
                  label={loading ? t.audioTrim.loading : t.audioTrim.trimming} 
                />
              </div>
            )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PDFPageLayout>
  );
};
