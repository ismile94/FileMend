'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PageLayoutVariant = 'pdf' | 'audio' | 'image';

/** Sayfa teması: pdf=açık kırmızı, audio=açık mavi, image=açık yeşil. */
interface PDFPageLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
  /** Kart içeriğinin max genişliği (örn max-w-3xl, max-w-4xl). */
  maxWidth?: string;
  /** Header'ı merkeze al (PDFToWord gibi). Varsayılan true. */
  centerHeader?: boolean;
  /** Tema: pdf=kırmızı, audio=mavi, image=yeşil. PDF sayfalarında "pdf" kullanın. */
  variant?: PageLayoutVariant;
}

export function PDFPageLayout({
  title,
  description,
  icon: Icon,
  children,
  maxWidth = 'max-w-3xl',
  centerHeader = true,
  variant = 'pdf',
}: PDFPageLayoutProps) {
  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-br via-white dark:via-background',
        variant === 'pdf' && 'from-red-50 to-red-50 dark:from-red-950/10 dark:to-red-950/10',
        variant === 'audio' && 'from-sky-50 to-sky-50 dark:from-sky-950/10 dark:to-sky-950/10',
        variant === 'image' && 'from-green-50 to-green-50 dark:from-green-950/10 dark:to-green-950/10'
      )}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            'absolute top-20 -right-20 w-96 h-96 bg-gradient-to-br rounded-full blur-3xl',
            variant === 'pdf' && 'from-red-200/30 to-red-300/30 dark:from-red-600/10 dark:to-red-700/10',
            variant === 'audio' && 'from-sky-200/30 to-sky-300/30 dark:from-sky-600/10 dark:to-sky-700/10',
            variant === 'image' && 'from-green-200/30 to-green-300/30 dark:from-green-600/10 dark:to-green-700/10'
          )}
        />
        <div
          className={cn(
            'absolute -bottom-20 -left-20 w-96 h-96 bg-gradient-to-tr rounded-full blur-3xl',
            variant === 'pdf' && 'from-red-200/30 to-red-300/30 dark:from-red-600/10 dark:to-red-700/10',
            variant === 'audio' && 'from-sky-200/30 to-sky-300/30 dark:from-sky-600/10 dark:to-sky-700/10',
            variant === 'image' && 'from-green-200/30 to-green-300/30 dark:from-green-600/10 dark:to-green-700/10'
          )}
        />
      </div>

      <div className={cn('relative container mx-auto px-4 py-6 sm:px-6 sm:py-10', maxWidth)}>
        <div
          className={cn(
            'mb-6 sm:mb-8 space-y-4',
            centerHeader && 'text-center'
          )}
        >
          <div className={cn('inline-flex items-center justify-center gap-3 mb-2', !centerHeader && 'flex')}>
            <div className="relative">
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl blur-lg opacity-60 animate-pulse',
                  variant === 'pdf' && 'bg-gradient-to-br from-red-500 to-red-600',
                  variant === 'audio' && 'bg-gradient-to-br from-sky-500 to-sky-600',
                  variant === 'image' && 'bg-gradient-to-br from-green-500 to-green-600'
                )}
              />
              <div
                className={cn(
                  'relative p-2.5 sm:p-3 rounded-2xl shadow-2xl',
                  variant === 'pdf' && 'bg-gradient-to-br from-red-500 to-red-600',
                  variant === 'audio' && 'bg-gradient-to-br from-sky-500 to-sky-600',
                  variant === 'image' && 'bg-gradient-to-br from-green-500 to-green-600'
                )}
              >
                <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
          </div>
          <h1
            className={cn(
              'text-2xl sm:text-4xl font-bold bg-clip-text text-transparent leading-tight',
              variant === 'pdf' && 'bg-gradient-to-r from-red-600 to-red-600 dark:from-red-400 dark:to-red-500',
              variant === 'audio' && 'bg-gradient-to-r from-sky-600 to-sky-600 dark:from-sky-400 dark:to-sky-500',
              variant === 'image' && 'bg-gradient-to-r from-green-600 to-green-600 dark:from-green-400 dark:to-green-500'
            )}
          >
            {title}
          </h1>
          <p className={cn('text-muted-foreground text-sm sm:text-base leading-relaxed', centerHeader && 'max-w-lg mx-auto')}>
            {description}
          </p>
        </div>

        <div className="relative">
          <div
            className={cn(
              'absolute -inset-0.5 rounded-2xl blur opacity-20',
              variant === 'pdf' && 'bg-gradient-to-r from-red-500 to-red-600',
              variant === 'audio' && 'bg-gradient-to-r from-sky-500 to-sky-600',
              variant === 'image' && 'bg-gradient-to-r from-green-500 to-green-600'
            )}
          />
          <div
            className={cn(
              'relative bg-white/80 dark:bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border p-4 sm:p-6',
              variant === 'pdf' && 'border-red-200/50 dark:border-red-900/50',
              variant === 'audio' && 'border-sky-200/50 dark:border-sky-900/50',
              variant === 'image' && 'border-green-200/50 dark:border-green-900/50'
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
