// Removed unused imports: useEffect, useRef, Merge, ChevronUp
import { useState, useCallback } from 'react';
import { 
  Split, 
  Download, 
  Plus, 
  Trash2, 
  Scissors,
  LayoutGrid,
  FileStack,
  BookOpen,
  Square,
  Type,
  ListOrdered,
  Settings2,
  Check,
  X,
  ShieldCheck,
  AlertCircle,
  TextSelect
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Types
interface PDFPage {
  id: string;
  pageNumber: number;
  thumbnail: string;
  textContent: string;
  width: number;
  height: number;
  isLoaded: boolean;
  isBlank?: boolean;
}

interface SplitGroup {
  id: string;
  name: string;
  pageIndices: number[];
  color: string;
  estimatedSizeMB: number;
  splitReason?: string;
}

interface PDFOutlineItem {
  title: string;
  dest: string | unknown[] | null; // Fixed: can be string or array
  pageNumber?: number;
}

type SplitMode = 'visual' | 'everyN' | 'bySize' | 'byBookmarks' | 'byBlank' | 'byPattern' | 'byRanges';

const getGroupColor = (index: number) => {
  const colors = [
    'bg-blue-100 border-blue-300 text-blue-800',
    'bg-green-100 border-green-300 text-green-800',
    'bg-purple-100 border-purple-300 text-purple-800',
    'bg-orange-100 border-orange-300 text-orange-800',
    'bg-pink-100 border-pink-300 text-pink-800',
    'bg-teal-100 border-teal-300 text-teal-800',
    'bg-indigo-100 border-indigo-300 text-indigo-800',
    'bg-rose-100 border-rose-300 text-rose-800',
  ];
  return colors[index % colors.length];
};

export const PDFSplit = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Core state
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Selection state
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [activeMode, setActiveMode] = useState<SplitMode>('byRanges');
  
  // UI state
  const [previewGroup, setPreviewGroup] = useState<SplitGroup | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  
  // Mode specific states
  const [everyNValue, setEveryNValue] = useState<number>(1);
  const [targetSizeMB, setTargetSizeMB] = useState<number>(10);
  const [customPattern, setCustomPattern] = useState<string>('Chapter|Section|Page \\d+|\\d+\\.\\s');
  const [pageRanges, setPageRanges] = useState<string>('');
  const [blankThreshold, setBlankThreshold] = useState<number>(50);
  const [pdfOutline, setPdfOutline] = useState<PDFOutlineItem[]>([]);
  const [outlineLoaded, setOutlineLoaded] = useState(false);

  // ============================================
  // 📄 FILE HANDLING
  // ============================================
  const handleFilesDrop = useCallback(async (fileList: FileList) => {
    const pdfFile = Array.from(fileList).find(
      f => f.type === 'application/pdf' || f.name.endsWith('.pdf')
    );

    if (!pdfFile) {
      toast({ title: t.messages.error, description: t.pdfSplit.messages.pleaseUploadPdf, variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setFile(pdfFile);
      setPdfDoc(pdf);
      setOutlineLoaded(false);
      
      const initialPages: PDFPage[] = Array.from({ length: pdf.numPages }, (_, i) => ({
        id: `page-${i + 1}`,
        pageNumber: i + 1,
        thumbnail: '',
        textContent: '',
        width: 0,
        height: 0,
        isLoaded: false,
      }));
      
      setPages(initialPages);
      setGroups([{
        id: 'group-1',
        name: t.pdfSplit.groups.allPages,
        pageIndices: Array.from({ length: pdf.numPages }, (_, i) => i),
        color: getGroupColor(0),
        estimatedSizeMB: pdfFile.size / (1024 * 1024)
      }]);

      toast({ title: t.messages.success, description: t.pdfSplit.messages.fileLoaded.replace('{count}', pdf.numPages.toString()) });
      
      loadThumbnailsProgressively(pdf, initialPages);
      loadOutline(pdf);
      
    } catch (error) {
      toast({ title: t.messages.error, description: t.pdfSplit.messages.fileLoadError, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [toast]);

  // ============================================
  // 📚 PDF OUTLINE (Bookmarks) EXTRACTION
  // ============================================
  const loadOutline = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    try {
      const outline = await pdf.getOutline();
      if (outline && outline.length > 0) {
        const processedOutline: PDFOutlineItem[] = [];
        
        for (const item of outline) {
          // Fix: item.dest can be null or array, not string!
          let pageNumber: number | undefined;
          
          if (item.dest) {
            try {
              // If dest is string (rarely), convert to array
              const destArray = typeof item.dest === 'string' 
                ? await pdf.getDestination(item.dest)
                : item.dest;
                
              if (Array.isArray(destArray) && destArray.length > 0) {
                const ref = destArray[0];
                if (ref && typeof ref === 'object') {
                  const pageIndex = await pdf.getPageIndex(ref);
                  pageNumber = pageIndex + 1;
                }
              }
            } catch (e) {
              console.warn('Outline destination could not be resolved:', item.title);
            }
          }
          
          processedOutline.push({
            title: item.title,
            dest: item.dest,
            pageNumber
          });
        }
        
        setPdfOutline(processedOutline);
        setOutlineLoaded(true);
        toast({ title: t.pdfSplit.messages.sectionCreatedTitle, description: t.pdfSplit.messages.sectionsCreated.replace('{count}', processedOutline.length.toString()) });
      }
    } catch (error) {
      console.log('No outline or failed to load');
    }
  };

  // ============================================
  // 🖼️ THUMBNAIL GENERATION
  // ============================================
  const loadThumbnailsProgressively = async (pdf: pdfjsLib.PDFDocumentProxy, pagesArray: PDFPage[]) => {
    const extractTextBatch = async (startIdx: number, batchSize: number) => {
      const endIdx = Math.min(startIdx + batchSize, pagesArray.length);
      
      for (let i = startIdx; i < endIdx; i++) {
        try {
          const page = await pdf.getPage(i + 1);
          
          // Thumbnail
          const scale = 0.8;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport, background: 'white' }).promise;
          const thumbnail = canvas.toDataURL('image/jpeg', 0.85);
          
          // Text content (for blank detection)
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item: any) => item.str).join(' ');
          const isBlank = text.trim().length < blankThreshold;
          
          setPages(prev => {
            const newPages = [...prev];
            newPages[i] = { 
              ...newPages[i], 
              thumbnail, 
              textContent: text,
              isLoaded: true,
              isBlank
            };
            return newPages;
          });
          
          setProgress(Math.round(((i + 1) / pagesArray.length) * 100));
        } catch (err) {
          console.error(`${t.ui.pageText} ${i + 1} error:`, err);
        }
      }
      
      if (endIdx < pagesArray.length) {
        setTimeout(() => extractTextBatch(endIdx, 3), 100);
      }
    };
    
    extractTextBatch(0, 3);
  };

  // ============================================
  // ✂️ SPLIT ALGORITHMS
  // ============================================
  
  const calculateGroupSize = (indices: number[]): number => {
    if (!file || pages.length === 0) return 0;
    const ratio = indices.length / pages.length;
    return (file.size * ratio) / (1024 * 1024);
  };

  // 1. Every N Pages
  const applyEveryNSplit = useCallback(() => {
    if (!everyNValue || everyNValue < 1 || pages.length === 0) return;
    
    const newGroups: SplitGroup[] = [];
    for (let i = 0; i < pages.length; i += everyNValue) {
      const groupPages = Array.from(
        { length: Math.min(everyNValue, pages.length - i) }, 
        (_, j) => i + j
      );
      newGroups.push({
        id: `n-group-${i}`,
        name: t.pdfSplit.groups.unnamedSection.replace('{count}', (newGroups.length + 1).toString()),
        pageIndices: groupPages,
        color: getGroupColor(newGroups.length),
        estimatedSizeMB: calculateGroupSize(groupPages)
      });
    }
    setGroups(newGroups);
    toast({ title: t.pdfSplit.messages.splitCompleted, description: t.pdfSplit.messages.rangeSplitCompleted.replace('{count}', newGroups.length.toString()) });
  }, [everyNValue, pages.length, file]);

  // 2. By Size
  const applySizeBasedSplit = useCallback(() => {
    if (!file || !targetSizeMB || pages.length === 0) return;
    
    const avgPageSize = file.size / pages.length;
    const pagesPerGroup = Math.floor((targetSizeMB * 1024 * 1024) / avgPageSize) || 1;
    
    const newGroups: SplitGroup[] = [];
    for (let i = 0; i < pages.length; i += pagesPerGroup) {
      const groupPages = Array.from(
        { length: Math.min(pagesPerGroup, pages.length - i) }, 
        (_, j) => i + j
      );
      newGroups.push({
        id: `size-group-${i}`,
        name: t.pdfSplit.groups.unnamedSection.replace('{count}', (newGroups.length + 1).toString()) + ` (~${targetSizeMB}MB)`,
        pageIndices: groupPages,
        color: getGroupColor(newGroups.length),
        estimatedSizeMB: calculateGroupSize(groupPages)
      });
    }
    setGroups(newGroups);
    toast({ title: t.pdfSplit.messages.splitCompleted, description: t.pdfSplit.messages.smartSplitDesc.replace('{count}', newGroups.length.toString()) });
  }, [targetSizeMB, file, pages.length]);

  // 3. Outline/Bookmark Based
  const applyBookmarkSplit = useCallback(() => {
    if (pdfOutline.length === 0) {
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.bookmarkMode.noBookmarks, variant: 'destructive' });
      return;
    }

    const newGroups: SplitGroup[] = [];
    const sortedOutline = [...pdfOutline]
      .filter((o): o is PDFOutlineItem & { pageNumber: number } => 
        typeof o.pageNumber === 'number' && o.pageNumber > 0 && o.pageNumber <= pages.length
      )
      .sort((a, b) => a.pageNumber - b.pageNumber);

    // Filter duplicate pages
    const uniqueSplits = sortedOutline.filter((item, index, self) => 
      index === self.findIndex(t => t.pageNumber === item.pageNumber)
    );

    for (let i = 0; i < uniqueSplits.length; i++) {
      const current = uniqueSplits[i];
      const next = uniqueSplits[i + 1];
      const startIdx = current.pageNumber - 1;
      const endIdx = next ? next.pageNumber - 1 : pages.length;
      
      const groupPages = Array.from({ length: endIdx - startIdx }, (_, j) => startIdx + j);
      
      if (groupPages.length > 0) {
        newGroups.push({
          id: `bookmark-group-${i}`,
          name: current.title || t.pdfSplit.groups.unnamedSection.replace('{count}', (i + 1).toString()),
          pageIndices: groupPages,
          color: getGroupColor(i),
          estimatedSizeMB: calculateGroupSize(groupPages),
          splitReason: t.pdfSplit.groups.splitReasons.bookmark.replace('{title}', current.title || '')
        });
      }
    }

    setGroups(newGroups);
    toast({ title: t.pdfSplit.messages.splitCompleted, description: t.pdfSplit.messages.sectionsCreated.replace('{count}', newGroups.length.toString()) + ' (Bookmark based)' });
  }, [pdfOutline, pages.length, file]);

  // 4. Blank Pages
  const applyBlankPageSplit = useCallback(() => {
    const splitPoints: number[] = [];
    
    pages.forEach((page, idx) => {
      if (idx === 0) return;
      if (page.isBlank && !pages[idx - 1].isBlank) {
        splitPoints.push(idx);
      }
    });

    if (splitPoints.length === 0) {
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.messages.noValidRanges, variant: 'destructive' });
      return;
    }

    const newGroups: SplitGroup[] = [];
    let startIdx = 0;

    splitPoints.forEach((splitIdx, i) => {
      const groupPages = Array.from({ length: splitIdx - startIdx }, (_, j) => startIdx + j);
      if (groupPages.length > 0) {
        newGroups.push({
          id: `blank-group-${i}`,
          name: `${t.pdfSplit.groups.unnamedSection.replace('{count}', (i + 1).toString())} ${t.pdfSplit.groups.splitReasons.blankPage}`,
          pageIndices: groupPages,
          color: getGroupColor(i),
          estimatedSizeMB: calculateGroupSize(groupPages),
          splitReason: t.pdfSplit.groups.splitReasons.blankPage.replace('{page}', (splitIdx + 1).toString())
        });
      }
      startIdx = splitIdx;
    });

    if (startIdx < pages.length) {
      const remainingPages = Array.from({ length: pages.length - startIdx }, (_, j) => startIdx + j);
      newGroups.push({
        id: `blank-group-${splitPoints.length}`,
        name: `${t.pdfSplit.groups.unnamedSection.replace('{count}', (splitPoints.length + 1).toString())} ${t.pdfSplit.groups.splitReasons.blankPage}`,
        pageIndices: remainingPages,
        color: getGroupColor(splitPoints.length),
        estimatedSizeMB: calculateGroupSize(remainingPages),
        splitReason: t.pdfSplit.groups.splitReasons.lastSection
      });
    }

    setGroups(newGroups);
    toast({ title: t.pdfSplit.messages.splitCompleted, description: t.pdfSplit.messages.blankPagesFound.replace('{count}', splitPoints.length.toString()).replace('{count}', newGroups.length.toString()) });
  }, [pages, file]);

  // 5. Custom Pattern/Regex
  const applyPatternSplit = useCallback(() => {
    if (!customPattern.trim()) {
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.messages.noPatternProvided, variant: 'destructive' });
      return;
    }

    let regex: RegExp;
    try {
      regex = new RegExp(customPattern, 'i');
    } catch (e) {
      toast({ title: t.messages.error, description: t.pdfSplit.messages.invalidRegex, variant: 'destructive' });
      return;
    }

    const splitPoints: number[] = [];
    pages.forEach((page, idx) => {
      if (idx === 0) return;
      if (regex.test(page.textContent)) {
        splitPoints.push(idx);
      }
    });

    if (splitPoints.length === 0) {
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.messages.noPatternMatches, variant: 'destructive' });
      return;
    }

    const newGroups: SplitGroup[] = [];
    let startIdx = 0;

    splitPoints.forEach((splitIdx, i) => {
      const groupPages = Array.from({ length: splitIdx - startIdx }, (_, j) => startIdx + j);
      if (groupPages.length > 0) {
        newGroups.push({
          id: `pattern-group-${i}`,
          name: t.pdfSplit.groups.unnamedSection.replace('{count}', (i + 1).toString()),
          pageIndices: groupPages,
          color: getGroupColor(i),
          estimatedSizeMB: calculateGroupSize(groupPages),
          splitReason: t.pdfSplit.groups.splitReasons.pattern.replace('{page}', (splitIdx + 1).toString())
        });
      }
      startIdx = splitIdx;
    });

    if (startIdx < pages.length) {
      const remainingPages = Array.from({ length: pages.length - startIdx }, (_, j) => startIdx + j);
      newGroups.push({
        id: `pattern-group-${splitPoints.length}`,
        name: t.pdfSplit.groups.unnamedSection.replace('{count}', (splitPoints.length + 1).toString()),
        pageIndices: remainingPages,
        color: getGroupColor(splitPoints.length),
        estimatedSizeMB: calculateGroupSize(remainingPages),
        splitReason: t.pdfSplit.groups.splitReasons.lastSection
      });
    }

    setGroups(newGroups);
    toast({ title: t.pdfSplit.messages.splitCompleted, description: t.pdfSplit.messages.patternMatches.replace('{count}', splitPoints.length.toString()).replace('{count}', newGroups.length.toString()) });
  }, [customPattern, pages, file]);

  // 6. Manual Page Ranges
  const applyRangesSplit = useCallback(() => {
    if (!pageRanges.trim()) {
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.messages.noRangesProvided, variant: 'destructive' });
      return;
    }

    // Process comma-separated ranges
    const rangeItems = pageRanges.split(',').map(item => item.trim()).filter(item => item);
    const newGroups: SplitGroup[] = [];
    const usedPages = new Set<number>();

    for (let i = 0; i < rangeItems.length; i++) {
      const item = rangeItems[i];
      let pageIndices: number[] = [];

      if (item.includes('-')) {
        const [start, end] = item.split('-').map(n => parseInt(n.trim()) - 1);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.max(0, start); p <= Math.min(end, pages.length - 1); p++) {
            if (!usedPages.has(p)) {
              pageIndices.push(p);
              usedPages.add(p);
            }
          }
        }
      } else {
        const p = parseInt(item) - 1;
        if (!isNaN(p) && p >= 0 && p < pages.length && !usedPages.has(p)) {
          pageIndices.push(p);
          usedPages.add(p);
        }
      }

      if (pageIndices.length > 0) {
        newGroups.push({
          id: `range-group-${i}`,
          name: `Grup ${i + 1}`,
          pageIndices: pageIndices.sort((a, b) => a - b),
          color: getGroupColor(i),
          estimatedSizeMB: calculateGroupSize(pageIndices),
          splitReason: t.pdfSplit.groups.splitReasons.range.replace('{range}', item)
        });
      }
    }

    const unusedPages: number[] = [];
    for (let i = 0; i < pages.length; i++) {
      if (!usedPages.has(i)) unusedPages.push(i);
    }

    if (unusedPages.length > 0) {
      newGroups.push({
        id: 'range-group-unused',
        name: t.pdfSplit.groups.splitReasons.unassigned,
        pageIndices: unusedPages,
        color: getGroupColor(newGroups.length),
        estimatedSizeMB: calculateGroupSize(unusedPages),
        splitReason: t.pdfSplit.groups.splitReasons.unassigned
      });
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.messages.unassignedPages.replace('{count}', unusedPages.length.toString()), variant: 'destructive' });
    }

    if (newGroups.length === 0) {
      toast({ title: t.messages.error, description: t.pdfSplit.messages.noValidRanges, variant: 'destructive' });
      return;
    }

    setGroups(newGroups);
    toast({ title: t.pdfSplit.messages.splitCompleted, description: t.pdfSplit.messages.rangeSplitCompleted.replace('{count}', newGroups.length.toString()) });
  }, [pageRanges, pages, file]);

  // ============================================
  // 🎮 MODE HANDLING
  // ============================================
  const handleModeChange = (mode: SplitMode) => {
    setActiveMode(mode);
    
    if (mode === 'everyN') applyEveryNSplit();
    else if (mode === 'bySize') applySizeBasedSplit();
    else if (mode === 'byBookmarks' && outlineLoaded) applyBookmarkSplit();
    else if (mode === 'byBlank') applyBlankPageSplit();
    else if (mode === 'byPattern') applyPatternSplit();
    else if (mode === 'byRanges') applyRangesSplit();
  };

  // ============================================
  // 🖱️ UI HANDLERS
  // ============================================
  const [touchTimer, setTouchTimer] = useState<NodeJS.Timeout | null>(null);
  const [lastTouchedIndex, setLastTouchedIndex] = useState<number | null>(null);

  const handlePageClick = (index: number, event: React.MouseEvent | React.TouchEvent) => {
    // Mobile touch handling
    if ('touches' in event) {
      event.preventDefault();
      
      // Clear existing timer
      if (touchTimer) {
        clearTimeout(touchTimer);
        setTouchTimer(null);
      }
      
      // Long press for multi-select on mobile
      const newTimer = setTimeout(() => {
        if (lastTouchedIndex !== null && lastTouchedIndex !== index) {
          // Range selection for long press
          const start = Math.min(lastTouchedIndex, index);
          const end = Math.max(lastTouchedIndex, index);
          const newSelected = new Set(selectedPages);
          for (let i = start; i <= end; i++) {
            newSelected.add(i);
          }
          setSelectedPages(newSelected);
        } else {
          // Toggle single selection
          const newSelected = new Set(selectedPages);
          if (newSelected.has(index)) {
            newSelected.delete(index);
          } else {
            newSelected.add(index);
          }
          setSelectedPages(newSelected);
        }
        setLastTouchedIndex(index);
      }, 500); // 500ms for long press
      
      setTouchTimer(newTimer);
      return;
    }
    
    // Desktop mouse handling
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelected = new Set(selectedPages);
      for (let i = start; i <= end; i++) newSelected.add(i);
      setSelectedPages(newSelected);
    } else if (event.metaKey || event.ctrlKey) {
      const newSelected = new Set(selectedPages);
      newSelected.has(index) ? newSelected.delete(index) : newSelected.add(index);
      setSelectedPages(newSelected);
      setLastSelectedIndex(index);
    } else {
      setSelectedPages(new Set([index]));
      setLastSelectedIndex(index);
    }
  };

  const handlePageTouchEnd = (index: number) => {
    // Clear long press timer if touch ends quickly
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
      
      // Quick tap - toggle selection
      const newSelected = new Set(selectedPages);
      if (newSelected.has(index)) {
        newSelected.delete(index);
      } else {
        newSelected.add(index);
      }
      setSelectedPages(newSelected);
      setLastTouchedIndex(index);
    }
  };

  const selectAll = () => setSelectedPages(new Set(pages.map((_, i) => i)));
  const clearSelection = () => { setSelectedPages(new Set()); setLastSelectedIndex(null); };

  const createGroupFromSelection = () => {
    if (selectedPages.size === 0) {
      toast({ title: t.pdfSplit.messages.selectPagesFirst, description: t.pdfSplit.messages.selectPagesFirst, variant: 'destructive' });
      return;
    }
    const sortedIndices = Array.from(selectedPages).sort((a, b) => a - b);
    const newGroup: SplitGroup = {
      id: `group-${Date.now()}`,
      name: t.pdfSplit.groups.unnamedSection.replace('{count}', (groups.length + 1).toString()),
      pageIndices: sortedIndices,
      color: getGroupColor(groups.length),
      estimatedSizeMB: calculateGroupSize(sortedIndices),
      splitReason: t.pdfSplit.groups.splitReasons.manual
    };
    setGroups([...groups, newGroup]);
    setSelectedPages(new Set());
    toast({ title: t.pdfSplit.messages.sectionCreatedTitle, description: t.pdfSplit.messages.sectionCreated.replace('{count}', sortedIndices.length.toString()) });
  };

  const deleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
    if (previewGroup?.id === groupId) setPreviewGroup(null);
  };

  const renameGroup = (groupId: string, newName: string) => {
    setGroups(groups.map(g => g.id === groupId ? { ...g, name: newName } : g));
    setEditingGroupId(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedGroupIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedGroupIndex === null || draggedGroupIndex === index) return;
    const newGroups = [...groups];
    const [removed] = newGroups.splice(draggedGroupIndex, 1);
    newGroups.splice(index, 0, removed);
    setGroups(newGroups);
    setDraggedGroupIndex(index);
  };

  const handleClear = () => {
    setFile(null);
    setPdfDoc(null);
    setPages([]);
    setGroups([]);
    setSelectedPages(new Set());
    setPreviewGroup(null);
    setPdfOutline([]);
    setOutlineLoaded(false);
  };

  // ============================================
  // 💾 DOWNLOAD
  // ============================================
  const handleSplit = async () => {
    if (!file || !pdfDoc || groups.length === 0) return;
    
    setProcessing(true);
    setProgress(0);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const blobs: { blob: Blob; name: string }[] = [];
      
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const newPdf = await PDFDocument.create();
        
        const sortedIndices = [...group.pageIndices].sort((a, b) => a - b);
        for (const pageIdx of sortedIndices) {
          const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIdx]);
          newPdf.addPage(copiedPage);
        }
        
        const pdfBytes = await newPdf.save();
        // Fix: Convert Uint8Array to ArrayBuffer
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        
        let fileName = group.name.replace(/[\\/:*?"<>|]/g, '_');
        if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
        
        blobs.push({ blob, name: fileName });
        setProgress(Math.round(((i + 1) / groups.length) * 100));
      }
      
      if (blobs.length > 3) {
        const zip = new JSZip();
        blobs.forEach(({ blob, name }) => zip.file(name, blob));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `PDF_Split_${new Date().toISOString().split('T')[0]}.zip`);
        toast({ title: t.pdfSplit.messages.processingStarted, description: t.pdfSplit.messages.downloadingZip.replace('{count}', blobs.length.toString()) });
      } else {
        blobs.forEach(({ blob, name }) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
        toast({ title: t.pdfSplit.messages.processingStarted, description: t.pdfSplit.messages.downloadingFiles.replace('{count}', blobs.length.toString()) });
      }
    } catch (error) {
      console.error(error);
      toast({ title: t.messages.error, description: t.pdfSplit.messages.splitError, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // ============================================
  // 🎨 RENDER
  // ============================================
  if (!file) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          {/* Branding */}
          <div className="text-sm sm:text-xs font-bold text-gray-500 tracking-wider uppercase mb-2">
            FileMend.com
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <Split className="w-6 h-6 text-white" />
            </div>
            {t.pdfSplit.title}
          </h1>
          <p className="text-muted-foreground mt-2">{t.pdfSplit.description}</p>
        </div>

        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800">
            {t.pdfSplit.privacy.title}
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>{t.pdfSplit.privacy.points[0]}</li>
              <li>{t.pdfSplit.privacy.points[1]}</li>
              <li>{t.pdfSplit.privacy.points[2]}</li>
            </ul>
          </div>
        </div>

        <FileDropzone
          onFilesDrop={handleFilesDrop}
          onClear={handleClear}
          accept=".pdf"
          multiple={false}
          selectedFiles={[]}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl min-h-[calc(100vh-4rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col gap-2">
          {/* Branding */}
          <div className="text-sm sm:text-xs font-bold text-gray-500 tracking-wider uppercase">
            FileMend.com
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Split className="w-6 h-6 text-red-500" />
            {t.pdfSplit.title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              {file.name} • {pages.length} {t.ui.pages}
              {outlineLoaded && <span className="ml-2 text-xs text-blue-600">({pdfOutline.length} {t.pdfSplit.bookmarksFound})</span>}
            </p>
            <Button variant="outline" size="sm" onClick={handleClear} className="text-red-600 border-red-200 hover:bg-red-50 h-6 text-xs">
              <X className="w-3 h-3 mr-1" />
              {t.pdfSplit.clear}
            </Button>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="flex flex-wrap gap-2 shrink-0">
        {[
          { id: 'byRanges', label: t.pdfSplit.modes.range, icon: ListOrdered },
          { id: 'visual', label: t.pdfSplit.modes.visual, icon: LayoutGrid },
          { id: 'everyN', label: t.pdfSplit.modes.everyN.replace('{count}', everyNValue.toString()), icon: Scissors },
          { id: 'byBookmarks', label: t.pdfSplit.modes.bookmarks.replace('{count}', outlineLoaded ? pdfOutline.length.toString() : '0'), icon: BookOpen, disabled: !outlineLoaded },
          { id: 'bySize', label: t.pdfSplit.modes.size.replace('{size}', targetSizeMB.toString()), icon: FileStack },
          { id: 'byBlank', label: t.pdfSplit.modes.blankPage, icon: Square },
          { id: 'byPattern', label: t.pdfSplit.modes.pattern, icon: Type },
        ].map((mode) => (
          <button
            key={mode.id}
            onClick={() => !mode.disabled && handleModeChange(mode.id as SplitMode)}
            disabled={mode.disabled}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
              activeMode === mode.id 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-card border-border hover:bg-accent',
              mode.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <mode.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Mode Controls */}
      <div className="shrink-0">
        {activeMode === 'everyN' && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Label className="text-sm">{t.pdfSplit.everyNMode.every}</Label>
            <Input type="number" min={1} max={pages.length} value={everyNValue} onChange={(e) => setEveryNValue(parseInt(e.target.value) || 1)} className="w-20" />
            <span className="text-sm text-muted-foreground">{t.pdfSplit.everyNMode.pages}</span>
            <Button size="sm" onClick={applyEveryNSplit} className="ml-auto">{t.pdfSplit.everyNMode.apply}</Button>
          </div>
        )}

        {activeMode === 'bySize' && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Label className="text-sm">{t.pdfSplit.sizeMode.targetSize}</Label>
            <Input type="number" min={1} max={100} value={targetSizeMB} onChange={(e) => setTargetSizeMB(parseInt(e.target.value) || 10)} className="w-20" />
            <span className="text-sm text-muted-foreground">{t.pdfSplit.sizeMode.mb}</span>
            <Button size="sm" onClick={applySizeBasedSplit} className="ml-auto">{t.pdfSplit.sizeMode.apply}</Button>
          </div>
        )}

        {activeMode === 'byBookmarks' && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{t.pdfSplit.bookmarkMode.title}</span>
              <Button size="sm" onClick={applyBookmarkSplit} disabled={!outlineLoaded}>{t.pdfSplit.bookmarkMode.apply}</Button>
            </div>
            {outlineLoaded ? (
              <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                {pdfOutline.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span className="truncate">{item.title}</span>
                    <span className="text-blue-600">{t.ui.pageText} {item.pageNumber || '?'}</span>
                  </div>
                ))}
                {pdfOutline.length > 5 && <div className="text-muted-foreground">+ {pdfOutline.length - 5} {t.pdfSplit.bookmarkMode.moreItems}</div>}
              </div>
            ) : (
              <div className="text-sm text-orange-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {t.pdfSplit.status.noBookmarksFound}
              </div>
            )}
          </div>
        )}

        {activeMode === 'byBlank' && (
          <div className="p-3 bg-muted rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{t.pdfSplit.blankPageMode.title}</span>
              <Button size="sm" onClick={applyBlankPageSplit}>{t.pdfSplit.blankPageMode.apply}</Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">{t.pdfSplit.blankPageMode.threshold}</Label>
              <Input type="number" min={0} max={1000} value={blankThreshold} onChange={(e) => setBlankThreshold(parseInt(e.target.value) || 50)} className="w-24 h-8 text-xs" />
              <span className="text-xs text-muted-foreground">{t.pdfSplit.blankPageMode.thresholdDesc}</span>
            </div>
          </div>
        )}

        {activeMode === 'byPattern' && (
          <div className="p-3 bg-muted rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{t.pdfSplit.patternMode.title}</span>
              <Button size="sm" onClick={applyPatternSplit}>{t.pdfSplit.patternMode.apply}</Button>
            </div>
            <div className="flex gap-2">
              <TextSelect className="w-4 h-4 mt-2 text-muted-foreground" />
              <Textarea 
                value={customPattern} 
                onChange={(e) => setCustomPattern(e.target.value)}
                placeholder={t.pdfSplit.patternMode.placeholder}
                className="flex-1 h-16 text-xs font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t.pdfSplit.patternMode.description}</p>
          </div>
        )}

        {activeMode === 'byRanges' && (
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Input 
                value={pageRanges} 
                onChange={(e) => setPageRanges(e.target.value)}
                placeholder="1-5, 10, 15-20"
                className="text-xs font-mono w-36"
              />
              <Button size="sm" onClick={applyRangesSplit} className="ml-auto">{t.pdfSplit.rangeMode.apply}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        
        {/* Left: Page Grid */}
        <div className="min-h-0 flex flex-col lg:order-1 order-1">
          {activeMode === 'visual' && (
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>{t.pdfSplit.visualMode.selectAll}</Button>
                <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedPages.size === 0}>{t.pdfSplit.visualMode.clear}</Button>
                <span className="text-xs text-muted-foreground ml-2">{t.pdfSplit.visualMode.selected.replace('{count}', selectedPages.size.toString())}</span>
              </div>
              <Button size="sm" onClick={createGroupFromSelection} disabled={selectedPages.size === 0}>
                <Plus className="w-4 h-4 mr-1" /> {t.pdfSplit.visualMode.createGroup}
              </Button>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto bg-card rounded-lg border p-2 sm:p-4">
            {activeMode === 'visual' ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {pages.map((page, idx) => (
                  <div
                    key={page.id}
                    onClick={(e) => handlePageClick(idx, e)}
                    onTouchStart={(e) => handlePageClick(idx, e)}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handlePageTouchEnd(idx);
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className={cn(
                      'relative aspect-[210/297] cursor-pointer rounded-lg border-2 overflow-hidden transition-all',
                      selectedPages.has(idx) ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
                      page.isLoaded ? 'bg-white' : 'bg-muted animate-pulse',
                      page.isBlank && 'opacity-60'
                    )}
                  >
                    {page.thumbnail ? (
                      <img src={page.thumbnail} alt={`${t.ui.pageText} ${page.pageNumber}`} className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">{page.pageNumber}</div>
                    )}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {page.pageNumber}
                      {page.isBlank && <span className="ml-1 text-gray-300">(B)</span>}
                    </div>
                    {selectedPages.has(idx) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="min-h-[2.5rem] flex items-center justify-center text-muted-foreground">
                <div className="text-center text-sm">
                  {activeMode === 'byBookmarks' && !outlineLoaded ? t.pdfSplit.status.noBookmarksFound : 
                   activeMode === 'byBlank' ? t.pdfSplit.status.blankPageInstruction :
                   t.pdfSplit.status.automaticModeActive}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Right: Groups */}
      <div className="w-full lg:w-80 flex flex-col lg:order-2 order-2">
        <Card className="flex flex-col min-h-0">
          <CardHeader className="shrink-0 py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileStack className="w-4 h-4" />
                {t.pdfSplit.groups.title.replace('{count}', groups.length.toString())}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={handleSplit} disabled={processing || groups.length === 0}>
                  <Download className="w-3 h-3 mr-1" />
                  {t.pdfSplit.download}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto px-2 py-1 space-y-1 flex-1">
            {groups.map((group, index) => (
              <div
                key={group.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onClick={() => setPreviewGroup(group)}
                className={cn(
                  'group p-2 rounded-lg border cursor-pointer transition-all hover:shadow-md',
                  group.color,
                  previewGroup?.id === group.id && 'ring-2 ring-primary'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingGroupId === group.id ? (
                      <Input
                        autoFocus
                        defaultValue={group.name}
                        onBlur={(e) => renameGroup(group.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && renameGroup(group.id, e.currentTarget.value)}
                        className="h-6 text-sm bg-white/50"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="font-semibold text-sm truncate" onDoubleClick={() => setEditingGroupId(group.id)} title={group.splitReason}>
                        {group.name}
                      </p>
                    )}
                    <p className="text-xs opacity-80 mt-0.5">
                      {group.pageIndices.length} {t.ui.pages} • ~{group.estimatedSizeMB.toFixed(1)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); }} className="p-1.5 hover:bg-black/10 rounded">
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }} className="p-1.5 hover:bg-red-200 rounded text-red-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Mini thumbnails preview */}
                <div className="flex gap-1 mt-1 overflow-hidden">
                  {group.pageIndices.slice(0, 4).map((pageIdx, i) => (
                    <div key={i} className="w-8 h-10 bg-white/50 rounded border border-black/10 overflow-hidden shrink-0">
                      {pages[pageIdx]?.thumbnail ? (
                        <img src={pages[pageIdx].thumbnail} alt={`${t.ui.pageText} ${pageIdx + 1}`} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">{pageIdx + 1}</div>
                      )}
                    </div>
                  ))}
                  {group.pageIndices.length > 4 && (
                    <div className="w-8 h-10 bg-white/50 rounded border border-black/10 overflow-hidden shrink-0 flex items-center justify-center text-[8px] text-muted-foreground">
                      +{group.pageIndices.length - 4}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {groups.length === 0 && (
              <div className="text-center py-1 text-muted-foreground text-sm">
                {t.pdfSplit.groups.noGroups}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 shrink-0">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{t.pdfSplit.privacy.badge}</span>
        </div>
      </div>
      </div>

      {/* Preview Modal */}
      {previewGroup && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewGroup(null)}>
          <div className="bg-card w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold">{previewGroup.name}</h3>
                <p className="text-sm text-muted-foreground">{previewGroup.pageIndices.length} {t.ui.pages} • ~{previewGroup.estimatedSizeMB.toFixed(1)} MB</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewGroup(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-muted">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {previewGroup.pageIndices.map((pageIdx) => (
                  <div key={pageIdx} className="aspect-[210/297] bg-white rounded-lg border overflow-hidden shadow-sm">
                    {pages[pageIdx]?.thumbnail ? (
                      <img src={pages[pageIdx].thumbnail} alt={`${t.ui.pageText} ${pageIdx + 1}`} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">{t.ui.pageText} {pageIdx + 1}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t shrink-0 flex justify-end">
              <Button variant="outline" onClick={() => setPreviewGroup(null)}>{t.pdfSplit.preview.close}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {processing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-card p-6 rounded-xl shadow-xl border max-w-sm w-full mx-4">
            <ProgressBar progress={progress} label={t.pdfSplit.loading.label} />
            <p className="text-center text-sm text-muted-foreground mt-4">{t.pdfSplit.status.pleaseWait}</p>
          </div>
        </div>
      )}
    </div>
  );
};