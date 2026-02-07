'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  FileEdit, 
  Download, 
  Trash2, 
  RotateCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  File,
  Grid3X3,
  Layers,
  Undo2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDigit,
  Type,
  SortAsc,
  SortDesc,
  RotateCcw
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';
import { useTranslation } from '@/contexts/LanguageContext';

// Dnd Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragStartEvent,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PDFPageLayout } from '@/components/pdf/PDFPageLayout';
import { PDFDropzone } from '@/components/pdf/PDFDropzone';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

// {t.comments.pdfWorkerConfigured}
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type ViewMode = 'pages' | 'files';
type SortOrder = 'asc' | 'desc';

// History action types
type HistoryAction = 
  | { type: 'ADD_FILE'; data: { files: PDFFile[]; pages: PDFPage[] } }
  | { type: 'REMOVE_FILE'; data: { index: number; file: PDFFile; pages: PDFPage[] } }
  | { type: 'REORDER_FILES'; data: { oldOrder: PDFFile[]; oldPages: PDFPage[] } }
  | { type: 'ROTATE_FILE'; data: { fileIndex: number; oldRotations: Map<string, number> } }
  | { type: 'REMOVE_PAGE'; data: { index: number; page: PDFPage } }
  | { type: 'ROTATE_PAGE'; data: { index: number; oldRotation: number } }
  | { type: 'REORDER_PAGES'; data: { oldPages: PDFPage[] } }
  | { type: 'ROTATE_ALL_PAGES'; data: { oldRotations: number[] } };

interface PDFPage {
  id: string;
  pdfIndex: number;
  pageNumber: number;
  rotation: 0 | 90 | 180 | 270;
  thumbnail: string;
  width: number;
  height: number;
}

interface PDFFile {
  file: File;
  pdf: pdfjsLib.PDFDocumentProxy;
  pageCount: number;
  id: string;
}

// {t.comments.sortablePageComponent}
interface SortablePageProps {
  page: PDFPage;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  t: any;
}

const SortablePageItem = ({ 
  page, 
  index, 
  selected, 
  onSelect, 
  onRemove,
  t
}: SortablePageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: page.id,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes} 
      {...listeners}
      style={style}
      className={cn(
        'group relative flex flex-col gap-0.5 p-1 sm:p-1.5 rounded-lg border-2 bg-white dark:bg-gray-900 cursor-grab active:cursor-grabbing transition-all duration-200',
        selected 
          ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md' 
          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300',
        isDragging && 'opacity-50 scale-105 rotate-2 shadow-2xl ring-2 ring-sky-500'
      )}
      onClick={() => !isDragging && onSelect(index)}
    >
      {/* {t.comments.mobileOptimized} */}
      <div className="flex items-center justify-between gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100 sm:group-hover:opacity-100">
        <span className="text-[7px] sm:text-[9px] font-bold text-muted-foreground bg-muted px-1 sm:px-1.5 py-0.5 rounded-full">
          {index + 1}
        </span>
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="p-0.5 sm:p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
        >
          <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>
      </div>

      {/* Thumbnail - Yüksek kalite */}
      <div className="relative aspect-[210/297] w-full overflow-hidden rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pointer-events-none">
        <img
          src={page.thumbnail}
          alt={`${t.ui.pageText} ${index + 1}`}
          className="w-full h-full object-contain image-pixelated"
          style={{ 
            transform: `rotate(${page.rotation}deg)`,
            imageRendering: 'crisp-edges'
          }}
          draggable={false}
        />
        
        {selected && (
          <div className="absolute inset-0 bg-sky-500/10 flex items-center justify-center">
            <div className="bg-sky-600 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
              {t.pdfEdit.selected}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// {t.comments.sortableFileComponent}
interface SortableFileProps {
  file: PDFFile;
  fileIndex: number;
  thumbnail?: string;
  selected: boolean;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  pageCount: number;
  t: any;
}

const SortableFileItem = ({
  file,
  fileIndex,
  thumbnail,
  selected,
  onSelect,
  onRemove,
  pageCount,
  t
}: SortableFileProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `file-${file.id}`,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes} 
      {...listeners}
      style={style}
      className={cn(
        'group relative flex flex-col gap-1.5 sm:gap-2 p-1.5 sm:p-3 rounded-xl border-2 bg-white dark:bg-gray-900 cursor-grab active:cursor-grabbing transition-all duration-200',
        selected 
          ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-md' 
          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300',
        isDragging && 'opacity-50 scale-105 rotate-2 shadow-2xl ring-2 ring-sky-500'
      )}
      onClick={() => !isDragging && onSelect(fileIndex)}
    >
      {/* {t.comments.mobileCompact} */}
      <div className="flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold truncate" title={file.file.name}>
            {file.file.name}
          </p>
          <p className="text-[8px] sm:text-[10px] text-muted-foreground">
            {pageCount} s • {(file.file.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <button
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onRemove(fileIndex);
          }}
          className="p-0.5 sm:p-1 rounded hover:bg-red-100 text-red-600 transition-colors shrink-0"
        >
          <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>

      {/* Thumbnail - Yüksek kalite */}
      <div className="relative aspect-[210/297] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pointer-events-none">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={`${file.file.name} - Önizleme`}
            className="w-full h-full object-contain"
            style={{ imageRendering: 'crisp-edges' }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
            <File className="w-6 h-6 sm:w-8 sm:h-8 opacity-50" />
            <span className="text-[9px] sm:text-[10px]">{t.ui.noPreview}</span>
          </div>
        )}
        
        {selected && (
          <div className="absolute inset-0 bg-sky-500/10 flex items-center justify-center">
            <div className="bg-sky-600 text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
              {t.pdfEdit.selected}
            </div>
          </div>
        )}

        <div className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 bg-black/70 text-white text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded backdrop-blur-sm">
          {pageCount}
        </div>
      </div>
    </div>
  );
};

// {t.comments.mainPdfEditComponent}
export const PDFEdit = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [, setSelectedPage] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('files');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // {t.comments.gridContainerRef}
  const gridRef = useRef<HTMLDivElement>(null);
  
  // {t.comments.historyState}
  const [history, setHistory] = useState<HistoryAction[]>([]);
  
  // {t.comments.modalStates}
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [modalPageIndex, setModalPageIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { toast } = useToast();

  // {t.comments.mobileDragFix}
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { 
        delay: 200, // {t.comments.mobileOptimized}
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (_event, { active }) => {
        const index = pages.findIndex(p => p.id === active);
        if (index === -1) return { x: 0, y: 0 };
        const column = index % 4;
        const row = Math.floor(index / 4);
        return { x: column * 200, y: row * 250 };
      },
    })
  );

  // {t.comments.dragScrollPrevention}
  useEffect(() => {
    const gridElement = gridRef.current;
    
    if (activeId) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      
      if (gridElement) {
        gridElement.style.overflowY = 'hidden';
        gridElement.style.touchAction = 'none';
      }
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      
      if (gridElement) {
        gridElement.style.overflowY = '';
        gridElement.style.touchAction = '';
      }
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      if (gridElement) {
        gridElement.style.overflowY = '';
        gridElement.style.touchAction = '';
      }
    };
  }, [activeId]);

  // {t.comments.historySystem}
  
  const addToHistory = useCallback((action: HistoryAction) => {
    setHistory(prev => [...prev, action]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    
    const lastAction = history[history.length - 1];
    const remainingHistory = history.slice(0, -1);
    
    switch (lastAction.type) {
      case 'ADD_FILE':
        const addedFileIds = lastAction.data.files.map(f => f.id);
        setFiles(prev => prev.filter(f => !addedFileIds.includes(f.id)));
        setPages(prev => prev.filter(p => !lastAction.data.pages.some(lp => lp.id === p.id)));
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.addFileCanceled });
        break;
        
      case 'REMOVE_FILE':
        const { index, file, pages: removedPages } = lastAction.data;
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles.splice(index, 0, file);
          return newFiles;
        });
        setPages(prev => [...prev, ...removedPages]);
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.fileRemoved });
        break;
        
      case 'REORDER_FILES':
        setFiles(lastAction.data.oldOrder);
        setPages(lastAction.data.oldPages);
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.sortingReverted });
        break;
        
      case 'ROTATE_FILE':
        const { fileIndex: rotFileIdx, oldRotations } = lastAction.data;
        setPages(prev => prev.map(p => {
          if (p.pdfIndex === rotFileIdx) {
            const oldRotation = oldRotations.get(p.id) || 0;
            return { ...p, rotation: oldRotation as 0 | 90 | 180 | 270 };
          }
          return p;
        }));
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.rotationCanceled });
        break;
        
      case 'REMOVE_PAGE':
        const { index: rmPageIdx, page: removedPage } = lastAction.data;
        setPages(prev => {
          const newPages = [...prev];
          newPages.splice(rmPageIdx, 0, removedPage);
          return newPages;
        });
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.pageRemoved });
        break;
        
      case 'ROTATE_PAGE':
        const { index: rotPageIdx, oldRotation } = lastAction.data;
        setPages(prev => {
          const newPages = [...prev];
          if (newPages[rotPageIdx]) {
            newPages[rotPageIdx] = { ...newPages[rotPageIdx], rotation: oldRotation as 0 | 90 | 180 | 270 };
          }
          return newPages;
        });
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.rotationCanceled });
        break;
        
      case 'REORDER_PAGES':
        setPages(lastAction.data.oldPages);
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.pageSortingReverted });
        break;
        
      case 'ROTATE_ALL_PAGES':
        setPages(prev => prev.map((p, i) => ({
          ...p,
          rotation: (lastAction.data.oldRotations[i] || 0) as 0 | 90 | 180 | 270
        })));
        toast({ title: t.pdfEdit.undoAction, description: t.pdfEdit.batchRotationCanceled });
        break;
    }
    
    setHistory(remainingHistory);
  }, [history, toast]);

  // {t.comments.sortingFunctions}
  
  const sortFilesByName = (order: SortOrder) => {
    if (files.length < 2) return;
    
    addToHistory({ type: 'REORDER_FILES', data: { oldOrder: [...files], oldPages: [...pages] } });
    
    const sortedFiles = [...files].sort((a, b) => {
      const comparison = a.file.name.localeCompare(b.file.name, 'tr');
      return order === 'asc' ? comparison : -comparison;
    });
    
    const newPages = [...pages];
    sortedFiles.forEach((file, newIndex) => {
      const oldIndex = files.findIndex(f => f.id === file.id);
      newPages.filter(p => p.pdfIndex === oldIndex).forEach(p => { p.pdfIndex = newIndex; });
    });
    
    setFiles(sortedFiles);
    setPages(newPages.sort((a, b) => {
      if (a.pdfIndex !== b.pdfIndex) return a.pdfIndex - b.pdfIndex;
      return a.pageNumber - b.pageNumber;
    }));
    
    toast({ title: t.pdfEdit.sorted, description: t.pdfEdit.sortedByName.replace('{order}', order === 'asc' ? t.pdfEdit.ascendingOrder : t.pdfEdit.descendingOrder) });
  };

  const sortFilesByPageCount = (order: SortOrder) => {
    if (files.length < 2) return;
    
    addToHistory({ type: 'REORDER_FILES', data: { oldOrder: [...files], oldPages: [...pages] } });
    
    const sortedFiles = [...files].sort((a, b) => {
      const comparison = a.pageCount - b.pageCount;
      return order === 'asc' ? comparison : -comparison;
    });
    
    const newPages = [...pages];
    sortedFiles.forEach((file, newIndex) => {
      const oldIndex = files.findIndex(f => f.id === file.id);
      newPages.filter(p => p.pdfIndex === oldIndex).forEach(p => { p.pdfIndex = newIndex; });
    });
    
    setFiles(sortedFiles);
    setPages(newPages.sort((a, b) => {
      if (a.pdfIndex !== b.pdfIndex) return a.pdfIndex - b.pdfIndex;
      return a.pageNumber - b.pageNumber;
    }));
    
    toast({ title: t.pdfEdit.sorted, description: t.pdfEdit.sortedByPageCount.replace('{order}', order === 'asc' ? t.pdfEdit.actions.ascending : t.pdfEdit.actions.descending) });
  };

  const sortFilesBySize = (order: SortOrder) => {
    if (files.length < 2) return;
    
    addToHistory({ type: 'REORDER_FILES', data: { oldOrder: [...files], oldPages: [...pages] } });
    
    const sortedFiles = [...files].sort((a, b) => {
      const comparison = a.file.size - b.file.size;
      return order === 'asc' ? comparison : -comparison;
    });
    
    const newPages = [...pages];
    sortedFiles.forEach((file, newIndex) => {
      const oldIndex = files.findIndex(f => f.id === file.id);
      newPages.filter(p => p.pdfIndex === oldIndex).forEach(p => { p.pdfIndex = newIndex; });
    });
    
    setFiles(sortedFiles);
    setPages(newPages.sort((a, b) => {
      if (a.pdfIndex !== b.pdfIndex) return a.pdfIndex - b.pdfIndex;
      return a.pageNumber - b.pageNumber;
    }));
    
    toast({ title: t.pdfEdit.sorted, description: t.pdfEdit.sortedBySize.replace('{order}', order === 'asc' ? t.pdfEdit.sizeAscending : t.pdfEdit.sizeDescending) });
  };

  const sortPagesByNumber = (order: SortOrder) => {
    if (pages.length < 2) return;
    
    addToHistory({ type: 'REORDER_PAGES', data: { oldPages: [...pages] } });
    
    const sortedPages = [...pages].sort((a, b) => {
      if (a.pdfIndex !== b.pdfIndex) {
        return order === 'asc' ? a.pdfIndex - b.pdfIndex : b.pdfIndex - a.pdfIndex;
      }
      const comparison = a.pageNumber - b.pageNumber;
      return order === 'asc' ? comparison : -comparison;
    });
    
    setPages(sortedPages);
    toast({ title: t.pdfEdit.sorted, description: t.pdfEdit.sortedByPageNumber.replace('{order}', order === 'asc' ? t.pdfEdit.numericAscending : t.pdfEdit.numericDescending) });
  };

  const sortPagesByFileName = (order: SortOrder) => {
    if (pages.length < 2) return;
    
    addToHistory({ type: 'REORDER_PAGES', data: { oldPages: [...pages] } });
    
    const sortedPages = [...pages].sort((a, b) => {
      const fileA = files[a.pdfIndex];
      const fileB = files[b.pdfIndex];
      if (!fileA || !fileB) return 0;
      
      const comparison = fileA.file.name.localeCompare(fileB.file.name, 'tr');
      if (comparison !== 0) return order === 'asc' ? comparison : -comparison;
      return a.pageNumber - b.pageNumber;
    });
    
    setPages(sortedPages);
    toast({ title: t.pdfEdit.sorted, description: t.pdfEdit.sortedByFileName.replace('{order}', order === 'asc' ? t.pdfEdit.ascendingOrder : t.pdfEdit.descendingOrder) });
  };

  // {t.comments.highQualityThumbnail}
  const renderPageThumbnail = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<{url: string, width: number, height: number}> => {
    const page = await pdf.getPage(pageNum);
    const scale = 1.5; // {t.comments.sharpRendering}
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false })!; // Alpha false = performans
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // {t.comments.sharpRendering}
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    
    await page.render({ 
      canvasContext: context, 
      viewport,
      background: 'white' // {t.comments.whiteBackground}
    }).promise;
    
    return { 
      url: canvas.toDataURL('image/jpeg', 0.92), // {t.comments.jpegQualityBalance}
      width: page.getViewport({ scale: 1 }).width,
      height: page.getViewport({ scale: 1 }).height
    };
  };

  const handleFilesDrop = useCallback(async (fileList: FileList) => {
    const pdfFiles = Array.from(fileList).filter(
      file => file.type === 'application/pdf' || file.name.endsWith('.pdf')
    );
    
    if (pdfFiles.length === 0) {
      toast({ title: t.messages.error, description: `${t.messages.pleaseUpload} ${t.messages.pdfFiles} ${t.messages.filesUpload}`, variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setProgress(0);

    try {
      const currentFileCount = files.length;
      const newFiles: PDFFile[] = [];
      const newPages: PDFPage[] = [];
      
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        const fileId = `file-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
        const newFile: PDFFile = {
          id: fileId,
          file,
          pdf,
          pageCount: pdf.numPages
        };
        
        newFiles.push(newFile);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const { url, width, height } = await renderPageThumbnail(pdf, pageNum);
          newPages.push({
            id: `page-${fileId}-${pageNum}`,
            pdfIndex: currentFileCount + i,
            pageNumber: pageNum,
            rotation: 0,
            thumbnail: url,
            width,
            height
          });
        }
        setProgress(Math.round(((i + 1) / pdfFiles.length) * 100));
      }
      
      addToHistory({ type: 'ADD_FILE', data: { files: newFiles, pages: newPages } });
      setFiles(prev => [...prev, ...newFiles]);
      setPages(prev => [...prev, ...newPages]);
      
      toast({ title: t.messages.success, description: `${pdfFiles.length} ${t.messages.fileLoaded}` });
    } catch (error) {
      console.error(t.messages.pdfLoadError, error);
      toast({ title: t.messages.error, description: `PDF ${t.messages.loadError}`, variant: 'destructive' });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [files.length, addToHistory, toast]);

  const handleClear = useCallback(() => {
    setFiles([]);
    setPages([]);
    setSelectedPage(null);
    setSelectedFile(null);
    setHistory([]);
  }, []);

  const removePage = useCallback((index: number) => {
    const pageToRemove = pages[index];
    if (!pageToRemove) return;
    
    addToHistory({ type: 'REMOVE_PAGE', data: { index, page: pageToRemove } });
    setPages(prev => prev.filter((_, i) => i !== index));
    setIsPageModalOpen(false);
  }, [pages, addToHistory]);

  const removeFile = useCallback((fileIndex: number) => {
    const fileToRemove = files[fileIndex];
    const pagesToRemove = pages.filter(p => p.pdfIndex === fileIndex);
    
    addToHistory({ 
      type: 'REMOVE_FILE', 
      data: { index: fileIndex, file: fileToRemove, pages: pagesToRemove } 
    });
    
    setFiles(prev => prev.filter((_, i) => i !== fileIndex));
    setPages(prev => {
      const filtered = prev.filter(p => p.pdfIndex !== fileIndex);
      return filtered.map(p => ({
        ...p,
        pdfIndex: p.pdfIndex > fileIndex ? p.pdfIndex - 1 : p.pdfIndex
      }));
    });

    if (selectedFile === fileIndex) {
      setSelectedFile(null);
      setIsFileModalOpen(false);
    } else if (selectedFile !== null && selectedFile > fileIndex) {
      setSelectedFile(selectedFile - 1);
    }
  }, [files, pages, selectedFile, addToHistory]);

  const movePage = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    
    addToHistory({ type: 'REORDER_PAGES', data: { oldPages: [...pages] } });
    setPages(prev => arrayMove(prev, oldIndex, newIndex));
  }, [pages, addToHistory]);

  const moveFile = useCallback((oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    
    addToHistory({ type: 'REORDER_FILES', data: { oldOrder: [...files], oldPages: [...pages] } });
    
    setFiles(prev => {
      const newFiles = arrayMove(prev, oldIndex, newIndex);
      
      setPages(currentPages => {
        const updatedPages = currentPages.map(page => {
          const oldPdfIndex = page.pdfIndex;
          let newPdfIndex: number;
          if (oldPdfIndex === oldIndex) newPdfIndex = newIndex;
          else if (oldIndex < newIndex && oldPdfIndex > oldIndex && oldPdfIndex <= newIndex) newPdfIndex = oldPdfIndex - 1;
          else if (oldIndex > newIndex && oldPdfIndex < oldIndex && oldPdfIndex >= newIndex) newPdfIndex = oldPdfIndex + 1;
          else newPdfIndex = oldPdfIndex;
          return { ...page, pdfIndex: newPdfIndex };
        });
        return updatedPages.sort((a, b) => {
          if (a.pdfIndex !== b.pdfIndex) return a.pdfIndex - b.pdfIndex;
          return a.pageNumber - b.pageNumber;
        });
      });
      return newFiles;
    });
  }, [files, pages, addToHistory]);

  const rotateFile = useCallback((fileIndex: number) => {
    const oldRotations = new Map<string, number>();
    pages.filter(p => p.pdfIndex === fileIndex).forEach(p => oldRotations.set(p.id, p.rotation));
    
    addToHistory({ type: 'ROTATE_FILE', data: { fileIndex, oldRotations } });
    
    setPages(prev => prev.map(page => {
      if (page.pdfIndex !== fileIndex) return page;
      return { ...page, rotation: ((page.rotation + 90) % 360) as 0 | 90 | 180 | 270 };
    }));
    
    toast({ title: t.pdfEdit.fileRotated, description: t.pdfEdit.fileRotated });
  }, [pages, addToHistory, toast]);

  const rotatePage = useCallback((index: number) => {
    if (index < 0 || index >= pages.length) return;
    
    addToHistory({ type: 'ROTATE_PAGE', data: { index, oldRotation: pages[index].rotation } });
    
    setPages(prev => {
      const newPages = [...prev];
      newPages[index] = { 
        ...newPages[index], 
        rotation: ((newPages[index].rotation + 90) % 360) as 0 | 90 | 180 | 270 
      };
      return newPages;
    });
  }, [pages, addToHistory]);

  const rotateAllPages = useCallback(() => {
    addToHistory({ type: 'ROTATE_ALL_PAGES', data: { oldRotations: pages.map(p => p.rotation) } });
    setPages(prev => prev.map(page => ({
      ...page,
      rotation: ((page.rotation + 90) % 360) as 0 | 90 | 180 | 270
    })));
  }, [pages, addToHistory]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      setActiveId(null);
      return;
    }

    if (viewMode === 'pages') {
      if (active.id !== over.id) {
        const oldIndex = pages.findIndex((p: PDFPage) => p.id === active.id);
        const newIndex = pages.findIndex((p: PDFPage) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          movePage(oldIndex, newIndex);
        }
      }
    } else {
      const activeIdStr = active.id as string;
      const overIdStr = over.id as string;
      if (activeIdStr !== overIdStr) {
        const oldIndex = files.findIndex((f: PDFFile) => `file-${f.id}` === activeIdStr);
        const newIndex = files.findIndex((f: PDFFile) => `file-${f.id}` === overIdStr);
        if (oldIndex !== -1 && newIndex !== -1) {
          moveFile(oldIndex, newIndex);
        }
      }
    }
    setActiveId(null);
  };

  const handleExport = useCallback(async () => {
    if (pages.length === 0) {
      toast({ title: t.messages.error, description: t.messages.minPageError, variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setProgress(0);

    try {
      const newPdf = await PDFDocument.create();
      const loadedPdfs = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>();

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pdfFile = files[page.pdfIndex];

        if (!pdfFile) {
          toast({ title: t.messages.error, description: t.messages.exportError, variant: 'destructive' });
          return;
        }

        const pageIndex = page.pageNumber - 1;
        if (pageIndex < 0 || page.pageNumber > pdfFile.pageCount) {
          toast({ title: t.messages.error, description: t.messages.exportError, variant: 'destructive' });
          return;
        }

        let sourcePdf = loadedPdfs.get(pdfFile.id);
        if (!sourcePdf) {
          try {
            const arrayBuffer = await pdfFile.file.arrayBuffer();
            sourcePdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            loadedPdfs.set(pdfFile.id, sourcePdf);
          } catch (loadErr) {
            console.error('PDF load failed:', loadErr);
            const fileName = pdfFile.file?.name ?? 'PDF';
            toast({
              title: t.messages.error,
              description: `${t.messages.exportError} (${fileName})`,
              variant: 'destructive',
            });
            return;
          }
        }

        let pageCount: number;
        try {
          pageCount = sourcePdf.getPageCount();
        } catch (e) {
          const fileName = pdfFile.file?.name ?? 'PDF';
          toast({
            title: t.messages.error,
            description: `${t.messages.exportError} (${fileName})`,
            variant: 'destructive',
          });
          return;
        }
        if (pageIndex >= pageCount) {
          toast({ title: t.messages.error, description: t.messages.exportError, variant: 'destructive' });
          return;
        }

        let copiedPage;
        try {
          [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
        } catch (copyErr) {
          console.error('copyPages failed:', copyErr);
          const fileName = pdfFile.file?.name ?? 'PDF';
          toast({
            title: t.messages.error,
            description: `${t.messages.exportError} (${fileName})`,
            variant: 'destructive',
          });
          return;
        }
        if (!copiedPage) {
          toast({ title: t.messages.error, description: t.messages.exportError, variant: 'destructive' });
          return;
        }

        if (page.rotation !== 0) copiedPage.setRotation(degrees(page.rotation));

        newPdf.addPage(copiedPage);
        setProgress(Math.round(((i + 1) / pages.length) * 100));
      }

      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'duzenlenmis.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: t.messages.success, description: `PDF ${t.messages.fileExported}` });
    } catch (error) {
      console.error(t.messages.exportPdfError, error);
      toast({ title: t.messages.error, description: `PDF ${t.messages.exportError}`, variant: 'destructive' });
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [pages, files, toast]);

  const getFileThumbnail = (fileIndex: number) => {
    return pages.find(p => p.pdfIndex === fileIndex && p.pageNumber === 1)?.thumbnail;
  };

  const openPageModal = (index: number) => {
    setModalPageIndex(index);
    setIsPageModalOpen(true);
  };

  const openFileModal = (index: number) => {
    setSelectedFile(index);
    setIsFileModalOpen(true);
  };

  const getActiveItem = () => {
    if (!activeId) return null;
    
    if (viewMode === 'pages') {
      const page = pages.find(p => p.id === activeId);
      return page ? (
        <div className="flex flex-col gap-2 p-3 rounded-xl border-2 border-sky-500 bg-white shadow-2xl rotate-3 scale-105 opacity-90 cursor-grabbing">
          <div className="aspect-[210/297] w-32 sm:w-40 overflow-hidden rounded-lg bg-gray-100">
            <img src={page.thumbnail} className="w-full h-full object-contain" style={{ imageRendering: 'crisp-edges' }} alt="" />
          </div>
        </div>
      ) : null;
    } else {
      const file = files.find(f => `file-${f.id}` === activeId);
      if (!file) return null;
      const thumb = getFileThumbnail(files.indexOf(file));
      return (
        <div className="flex flex-col gap-2 p-4 rounded-xl border-2 border-sky-500 bg-white shadow-2xl rotate-3 scale-105 opacity-90 cursor-grabbing w-48 sm:w-64">
          <div className="flex items-center gap-2">
            <File className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
            <span className="font-semibold truncate text-xs sm:text-sm">{file.file.name}</span>
          </div>
          {thumb && <img src={thumb} className="w-full object-contain" style={{ imageRendering: 'crisp-edges' }} alt="" />}
        </div>
      );
    }
  };

  if (pages.length === 0) {
    return (
      <PDFPageLayout
        title={t.pdfEdit.title}
        description={t.pdfEdit.description}
        icon={FileEdit}
        maxWidth="max-w-4xl"
        centerHeader={false}
      >
        <div className="space-y-4">
          <PDFDropzone
            inputId="pdf-edit-input"
            dropText={t.pdfToWord.dropText}
            dropSubtext={t.dropzone.multipleFiles}
            isDragOver={isDragOver}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files.length > 0) handleFilesDrop(e.dataTransfer.files);
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            onFileInput={(e) => e.target.files && handleFilesDrop(e.target.files)}
            accept=".pdf"
            multiple
          />
          {processing && <ProgressBar progress={progress} label={t.ui.pdfLoading} className="mt-4" />}
        </div>
      </PDFPageLayout>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-7xl h-[calc(100vh-4rem)] flex flex-col gap-4 sm:gap-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl shadow-lg shrink-0">
              <FileEdit className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold truncate">
                {t.pdfEdit.title}
              </h1>
              <p className="text-muted-foreground text-[10px] sm:text-sm hidden lg:block">
                {t.ui.pagesText}
              </p>
            </div>
          </div>
          
          {/* Geri Al - Sadece sayfa varken göster */}
          {pages.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={undo} 
              disabled={history.length === 0}
              className="h-9 sm:h-10 px-2.5 sm:px-3 shrink-0 gap-1.5 sm:gap-2 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 disabled:opacity-50"
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline text-xs sm:text-sm font-medium">{t.ui.undo}</span>
              {history.length > 0 && (
                <span className="bg-sky-500/10 text-sky-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {history.length}
                </span>
              )}
            </Button>
          )}
        </div>
        
        {/* {t.comments.rightGroup} */}
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('add-pdf')?.click()}
            className="h-9 sm:h-10 px-2.5 sm:px-4 gap-1.5 sm:gap-2 hover:bg-green-50 hover:border-green-200 hover:text-green-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline text-xs sm:text-sm">{t.pdfEdit.addPdf}</span>
          </Button>
          
          <input 
            id="add-pdf" 
            type="file" 
            accept=".pdf" 
            multiple 
            className="hidden" 
            onChange={(e) => e.target.files && handleFilesDrop(e.target.files)} 
          />
          
          {pages.length > 0 && (
            <Button 
              onClick={handleExport} 
              disabled={processing}
              size="sm"
              className="h-9 sm:h-10 px-3 sm:px-4 gap-1.5 sm:gap-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 shadow-md font-medium"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline text-xs sm:text-sm">{t.pdfEdit.download}</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 gap-3 sm:gap-4 min-h-0">
          {/* {t.comments.toolbarRedesigned} */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-2.5 sm:p-3 rounded-xl border shadow-sm">
            {/* {t.comments.leftGroupModeSelector} */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              {/* {t.comments.segmentedControl} */}
              <div className="flex items-center bg-white dark:bg-gray-950 rounded-lg p-1 border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                <button
                  onClick={() => setViewMode('files')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200',
                    viewMode === 'files' 
                      ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white shadow-md scale-105' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Grid3X3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{t.pdfEdit.viewMode.files}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                    viewMode === 'files' 
                      ? "bg-white/20 text-white" 
                      : "bg-sky-500/10 text-sky-600"
                  )}>
                    {files.length}
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('pages')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-semibold transition-all duration-200',
                    viewMode === 'pages' 
                      ? 'bg-gradient-to-r from-sky-600 to-sky-700 text-white shadow-md scale-105' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{t.ui.pages}</span>
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                    viewMode === 'pages' 
                      ? "bg-white/20 text-white" 
                      : "bg-sky-500/10 text-sky-600"
                  )}>
                    {pages.length}
                  </span>
                </button>
              </div>

              {/* {t.comments.sortingDropdown} */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-9 sm:h-10 px-2.5 sm:px-3 gap-1.5 sm:gap-2 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 font-medium"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline text-xs sm:text-sm">{t.pdfEdit.sort}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {viewMode === 'files' ? (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-sm">
                          <Type className="w-4 h-4 mr-2" />
                          <span>{t.pdfEdit.sortByName}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => sortFilesByName('asc')} className="text-sm">
                            <SortAsc className="w-4 h-4 mr-2" />{t.pdfEdit.ascendingOrder}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sortFilesByName('desc')} className="text-sm">
                            <SortDesc className="w-4 h-4 mr-2" />{t.pdfEdit.descendingOrder}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-sm">
                          <FileDigit className="w-4 h-4 mr-2" />
                          <span>{t.pdfEdit.pageCount}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => sortFilesByPageCount('asc')} className="text-sm">
                            <ArrowUp className="w-4 h-4 mr-2" />{t.pdfEdit.fewToMany}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sortFilesByPageCount('desc')} className="text-sm">
                            <ArrowDown className="w-4 h-4 mr-2" />{t.pdfEdit.manyToFew}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-sm">
                          <File className="w-4 h-4 mr-2" />
                          <span>{t.pdfEdit.fileSize}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => sortFilesBySize('asc')} className="text-sm">
                            <ArrowUp className="w-4 h-4 mr-2" />{t.pdfEdit.smallToLarge}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sortFilesBySize('desc')} className="text-sm">
                            <ArrowDown className="w-4 h-4 mr-2" />{t.pdfEdit.largeToSmall}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  ) : (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-sm">
                          <FileDigit className="w-4 h-4 mr-2" />
                          <span>{t.pdfEdit.pageNumber}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => sortPagesByNumber('asc')} className="text-sm">
                            <SortAsc className="w-4 h-4 mr-2" />{t.pdfEdit.numericAscending}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sortPagesByNumber('desc')} className="text-sm">
                            <SortDesc className="w-4 h-4 mr-2" />{t.pdfEdit.numericDescending}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-sm">
                          <Type className="w-4 h-4 mr-2" />
                          <span>{t.pdfEdit.fileName}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => sortPagesByFileName('asc')} className="text-sm">
                            <SortAsc className="w-4 h-4 mr-2" />{t.pdfEdit.ascendingOrder}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => sortPagesByFileName('desc')} className="text-sm">
                            <SortDesc className="w-4 h-4 mr-2" />{t.pdfEdit.descendingOrder}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tümünü Döndür - Sadece sayfa modunda */}
              {viewMode === 'pages' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={rotateAllPages}
                  className="h-9 sm:h-10 px-2.5 sm:px-3 gap-1.5 sm:gap-2 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 font-medium"
                >
                  <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden lg:inline text-xs sm:text-sm">{t.pdfEdit.rotateAll}</span>
                </Button>
              )}

              {/* {t.comments.clearButton} */}
              <Button 
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="h-9 sm:h-10 px-2.5 sm:px-3 gap-1.5 sm:gap-2 text-red-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 border-red-200 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {viewMode === 'files' && <span className="text-xs sm:text-sm">{t.pdfEdit.clear}</span>}
              </Button>
            </div>
          </div>

          {/* Grid Container */}
          <div 
            ref={gridRef}
            className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-gray-950 rounded-xl border-2 border-gray-200 dark:border-gray-800 p-2 sm:p-4 touch-pan-y shadow-sm"
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {viewMode === 'pages' ? (
                <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-9 gap-1.5 sm:gap-2">
                    {pages.map((page, index) => (
                      <SortablePageItem key={page.id} page={page} index={index} selected={false} onSelect={openPageModal} onRemove={removePage} t={t} />
                    ))}
                  </div>
                </SortableContext>
              ) : (
                <SortableContext items={files.map(f => `file-${f.id}`)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-3">
                    {files.map((file, index) => (
                      <SortableFileItem key={file.id} file={file} fileIndex={index} thumbnail={getFileThumbnail(index)} selected={false} onSelect={openFileModal} onRemove={removeFile} pageCount={file.pageCount} t={t} />
                    ))}
                  </div>
                </SortableContext>
              )}

              <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                {getActiveItem()}
              </DragOverlay>
            </DndContext>
          </div>

          {processing && <ProgressBar progress={progress} label={t.pdfEdit.creating} />}
        </div>

      {/* {t.comments.pageModalDesign} */}
      <Dialog open={isPageModalOpen} onOpenChange={setIsPageModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-base sm:text-lg flex items-center justify-between font-semibold">
              <span>{t.pdfEdit.page} {modalPageIndex !== null ? modalPageIndex + 1 : ''} {t.pdfEdit.of} {pages.length}</span>
            </DialogTitle>
          </DialogHeader>
          
          {modalPageIndex !== null && pages[modalPageIndex] && (
            <div className="flex flex-col gap-4 overflow-hidden flex-1">
              {/* {t.comments.controlButtonsLarge} */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={() => { if (modalPageIndex > 0) setModalPageIndex(modalPageIndex - 1); }} 
                  disabled={modalPageIndex === 0}
                  className="h-11 w-11 sm:h-12 sm:w-12 p-0 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-40"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
                
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={() => rotatePage(modalPageIndex)}
                  className="h-11 w-11 sm:h-12 sm:w-12 p-0 hover:bg-sky-50 hover:border-sky-200"
                >
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
                
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={() => removePage(modalPageIndex)}
                  className="h-11 w-11 sm:h-12 sm:w-12 p-0 text-red-600 hover:bg-red-50 hover:border-red-300 border-red-200"
                >
                  <Trash2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
                
                <Button 
                  variant="outline"
                  size="lg"
                  onClick={() => { if (modalPageIndex < pages.length - 1) setModalPageIndex(modalPageIndex + 1); }} 
                  disabled={modalPageIndex === pages.length - 1}
                  className="h-11 w-11 sm:h-12 sm:w-12 p-0 hover:bg-blue-50 hover:border-blue-200 disabled:opacity-40"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>

              <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl overflow-auto flex items-center justify-center min-h-0 p-3 sm:p-6 border-2">
                <img 
                  src={pages[modalPageIndex].thumbnail} 
                  alt={`${t.pdfEdit.altPage} ${modalPageIndex + 1}`} 
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg bg-white border" 
                  style={{ 
                    transform: `rotate(${pages[modalPageIndex].rotation}deg)`,
                    imageRendering: 'crisp-edges'
                  }} 
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* {t.comments.fileModalDesign} */}
      <Dialog open={isFileModalOpen} onOpenChange={setIsFileModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
          {selectedFile !== null && files[selectedFile] && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="text-base sm:text-lg flex items-center gap-2 font-semibold">
                  <File className="w-5 h-5 shrink-0 text-sky-600" />
                  <span className="truncate max-w-[250px] sm:max-w-md">{files[selectedFile].file.name}</span>
                  <span className="text-sm font-normal text-muted-foreground shrink-0">
                    ({files[selectedFile].pageCount} {t.ui.pages})
                  </span>
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex flex-col gap-4 overflow-hidden flex-1">
                {/* {t.comments.controlButtons} */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => rotateFile(selectedFile)}
                    className="h-10 px-3 sm:px-4 gap-2 hover:bg-sky-50 hover:border-sky-200 font-medium"
                  >
                    <RotateCw className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">{t.pdfEdit.rotateAll}</span>
                  </Button>
                  
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => { 
                      setViewMode('pages'); 
                      const firstPageIndex = pages.findIndex(p => p.pdfIndex === selectedFile); 
                      if (firstPageIndex !== -1) setModalPageIndex(firstPageIndex); 
                      setIsFileModalOpen(false); 
                      setIsPageModalOpen(true); 
                    }}
                    className="h-10 px-3 sm:px-4 gap-2 hover:bg-blue-50 hover:border-blue-200 font-medium"
                  >
                    <Layers className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">{t.pdfEdit.pageView}</span>
                  </Button>
                  
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => removeFile(selectedFile)}
                    className="h-10 px-3 sm:px-4 gap-2 text-red-600 hover:bg-red-50 hover:border-red-300 border-red-200 font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-xs sm:text-sm">{t.pdfEdit.deleteFile}</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl p-3 sm:p-4 border-2">
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 sm:gap-3">
                    {pages.filter(p => p.pdfIndex === selectedFile).map((page) => {
                      const globalIndex = pages.findIndex(p => p.id === page.id);
                      return (
                        <button 
                          key={page.id} 
                          onClick={() => { setIsFileModalOpen(false); setModalPageIndex(globalIndex); setIsPageModalOpen(true); }} 
                          className="group relative flex flex-col gap-1.5 p-2 rounded-lg border-2 bg-white dark:bg-gray-800 hover:border-sky-500 hover:shadow-md transition-all text-left"
                        >
                          <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="bg-sky-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                              #{globalIndex + 1}
                            </span>
                          </div>
                          <div className="relative aspect-[210/297] w-full overflow-hidden rounded bg-gray-100">
                            <img 
                              src={page.thumbnail} 
                              alt={`${t.pdfEdit.altPage} ${page.pageNumber}`} 
                              className="w-full h-full object-contain" 
                              style={{ 
                                transform: `rotate(${page.rotation}deg)`,
                                imageRendering: 'crisp-edges'
                              }} 
                            />
                          </div>
                          <p className="text-[10px] sm:text-xs text-center text-muted-foreground font-medium">
                            {t.pdfEdit.page} {page.pageNumber}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};