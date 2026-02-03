/**
 * PDF to DOCX API & pipeline data structures.
 * Aligns with backend schema for optional REST/WebSocket integration.
 */

export type RegionType = 'text' | 'image' | 'table' | 'header' | 'footer' | 'caption' | 'formula';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutBlock {
  type: RegionType;
  coordinates: BoundingBox;
  pageNumber: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface TableResult {
  data: string[][];
  coordinates: BoundingBox;
}

export interface UnifiedContentBlock {
  type: RegionType;
  content: string | string[][] | { base64?: string; alt?: string };
  formatting?: Record<string, unknown>;
  position: { page: number; bbox: BoundingBox };
}

export interface ConversionProgress {
  stage: 'upload' | 'split' | 'layout' | 'extract' | 'merge' | 'docx';
  progress: number;
  message?: string;
}

export interface ConversionStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: ConversionProgress;
  downloadUrl?: string;
  error?: string;
}
