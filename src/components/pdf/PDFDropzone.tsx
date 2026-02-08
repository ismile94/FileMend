'use client';

import { useRef, useCallback } from 'react';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DropzoneVariant = 'pdf' | 'audio' | 'image';

/** PDF/Audio/Image sayfalarında ortak "sürükle-bırak veya tıkla" alanı. variant'a göre tema: pdf=kırmızı, audio=mavi, image=yeşil. */
interface PDFDropzoneProps {
  dropText: string;
  dropSubtext?: string;
  isDragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
  inputId: string;
  className?: string;
  /** Tema: pdf=açık kırmızı, audio=açık mavi, image=açık yeşil */
  variant?: DropzoneVariant;
  /** Tıklanabilir alan için ek keyboard handler (Enter/Space). */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function PDFDropzone({
  dropText,
  dropSubtext,
  isDragOver,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInput,
  accept = '.pdf',
  multiple = false,
  inputId,
  className,
  variant = 'pdf',
  onKeyDown,
}: PDFDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-8 sm:p-10 transition-all duration-300 cursor-pointer',
        'flex flex-col items-center justify-center gap-4 min-h-[200px] group',
        'hover:shadow-lg',
        variant === 'pdf' && [
          'border-red-300/50 dark:border-red-700/50',
          'hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20',
          isDragOver && 'border-red-500 bg-red-50/50 dark:bg-red-950/20',
        ],
        variant === 'audio' && [
          'border-sky-300/50 dark:border-sky-700/50',
          'hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/20',
          isDragOver && 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/20',
        ],
        variant === 'image' && [
          'border-green-300/50 dark:border-green-700/50',
          'hover:border-green-500 hover:bg-green-50/50 dark:hover:bg-green-950/20',
          isDragOver && 'border-green-500 bg-green-50/50 dark:bg-green-950/20',
        ],
        isDragOver && 'scale-[1.02] shadow-lg',
        className
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onFileInput}
        className="hidden"
      />

      <div className="relative">
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br rounded-full blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300',
            variant === 'pdf' && 'from-red-400 to-red-500',
            variant === 'audio' && 'from-sky-400 to-sky-500',
            variant === 'image' && 'from-green-400 to-green-500'
          )}
        />
        <FileUp
          className={cn(
            'relative w-12 h-12 sm:w-14 sm:h-14 transition-transform duration-300 group-hover:scale-110',
            variant === 'pdf' && 'text-red-500 dark:text-red-400',
            variant === 'audio' && 'text-sky-500 dark:text-sky-400',
            variant === 'image' && 'text-green-500 dark:text-green-400'
          )}
        />
      </div>

      <div className="space-y-1 text-center">
        <p className="text-base sm:text-lg font-semibold text-foreground">
          {dropText}
        </p>
        {dropSubtext && (
          <p className="text-sm text-muted-foreground">{dropSubtext}</p>
        )}
      </div>
    </div>
  );
}
