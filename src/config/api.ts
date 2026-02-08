/**
 * API Configuration - PDF Compress Backend
 */

export const API_CONFIG = {
  baseURL:
    import.meta.env.VITE_PDF_COMPRESS_API_URL || 'http://localhost:7860',
  endpoints: {
    compress: '/compress',
    health: '/',
  },
  timeout: 120000, // 2 dakika
  maxFileSize: 50 * 1024 * 1024, // 50 MB
  minFileSize: 500 * 1024, // 500 KB - Yeni eklendi
} as const;

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown, // Yeni eklendi
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = API_CONFIG.timeout, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError('Request timeout', 408);
    }
    throw error;
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${API_CONFIG.baseURL}${API_CONFIG.endpoints.health}`,
      { timeout: 5000 }
    );
    return response.ok;
  } catch {
    return false;
  }
}

// Yeni detaylı istatistikler için interface
export interface PageStats {
  textPages?: number;
  imagePages?: number;
  hybridPages?: number;
  imagesCompressed?: number;
}

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasAlreadyOptimized: boolean;
  textHeavyPages: number; // Eski, geriye uyumluluk için
  imageHeavyPages: number; // Eski, geriye uyumluluk için
  compressionLevel: string;
  headers?: { [key: string]: string }; // Tüm header'lar
  stats?: PageStats; // Yeni detaylı istatistikler
}

export async function compressPDF(
  file: File,
  level: 'low' | 'medium' | 'extreme' = 'medium',
  onProgress?: (progress: number) => void
): Promise<CompressResult> {
  // 500KB minimum kontrolü (frontend tarafında da yapılır ama double-check)
  if (file.size < API_CONFIG.minFileSize) {
    throw new APIError(
      `File too small. Minimum size is ${API_CONFIG.minFileSize / 1024}KB`,
      400,
      { code: 'FILE_TOO_SMALL', minRequired: API_CONFIG.minFileSize, actualSize: file.size }
    );
  }

  if (file.size > API_CONFIG.maxFileSize) {
    throw new APIError(
      `File too large. Maximum size is ${API_CONFIG.maxFileSize / 1024 / 1024}MB`,
      413
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('level', level);

  const progressInterval = setInterval(() => {
    if (onProgress) {
      const randomProgress = Math.min(95, Math.random() * 90);
      onProgress(randomProgress);
    }
  }, 500);

  try {
    const response = await fetchWithTimeout(
      `${API_CONFIG.baseURL}${API_CONFIG.endpoints.compress}`,
      {
        method: 'POST',
        body: formData,
        timeout: API_CONFIG.timeout,
      }
    );

    clearInterval(progressInterval);

    // 400 hatası özel işleme (FILE_TOO_SMALL)
    if (response.status === 400) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.code === 'FILE_TOO_SMALL') {
        throw new APIError(
          errorData.message || `File too small. Minimum required: ${API_CONFIG.minFileSize / 1024}KB`,
          400,
          errorData
        );
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new APIError(
        `Compression failed: ${errorText}`,
        response.status,
        null,
        errorText
      );
    }

    const blob = await response.blob();

    if (onProgress) {
      onProgress(100);
    }

    // Header'ları topla
    const headers: { [key: string]: string } = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const originalSize = parseInt(
      headers['x-original-size'] || response.headers.get('X-Original-Size') || '0'
    );
    const compressedSizeFromHeader = parseInt(
      headers['x-compressed-size'] || response.headers.get('X-Compressed-Size') || '0'
    );
    const compressionRatio = parseFloat(
      headers['x-compression-ratio'] || response.headers.get('X-Compression-Ratio') || '0'
    );
    const wasAlreadyOptimized =
      (headers['x-already-optimized'] || response.headers.get('X-Already-Optimized')) === 'true';
    
    // Eski header'lar (geriye uyumluluk)
    const textHeavyPages = parseInt(
      headers['x-text-heavy-pages'] || response.headers.get('X-Text-Heavy-Pages') || '0'
    );
    const imageHeavyPages = parseInt(
      headers['x-image-heavy-pages'] || response.headers.get('X-Image-Heavy-Pages') || '0'
    );
    
    // Yeni header'lar
    const textPages = parseInt(
      headers['x-text-pages'] || response.headers.get('X-Text-Pages') || '0'
    );
    const hybridPages = parseInt(
      headers['x-hybrid-pages'] || response.headers.get('X-Hybrid-Pages') || '0'
    );
    const imagePages = parseInt(
      headers['x-image-pages'] || response.headers.get('X-Image-Pages') || '0'
    );
    const imagesCompressed = parseInt(
      headers['x-images-compressed'] || response.headers.get('X-Images-Compressed') || '0'
    );
    
    const compressionLevel =
      headers['x-compression-level'] || response.headers.get('X-Compression-Level') || level;

    // CORS'da header okunamıyorsa blob boyutunu kullan
    const compressedSize =
      compressedSizeFromHeader > 0 ? compressedSizeFromHeader : blob.size;

    // Yeni stats objesi
    const stats: PageStats = {};
    if (textPages > 0 || hybridPages > 0 || imagePages > 0 || imagesCompressed > 0) {
      stats.textPages = textPages || undefined;
      stats.hybridPages = hybridPages || undefined;
      stats.imagePages = imagePages || undefined;
      stats.imagesCompressed = imagesCompressed || undefined;
    }

    return {
      blob,
      originalSize,
      compressedSize,
      compressionRatio,
      wasAlreadyOptimized,
      textHeavyPages, // Eski
      imageHeavyPages, // Eski
      compressionLevel,
      headers, // Tüm header'lar (ihtiyaç olursa)
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  } catch (error) {
    clearInterval(progressInterval);

    if (error instanceof APIError) {
      throw error;
    }

    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      500,
      null,
      error
    );
  }
}