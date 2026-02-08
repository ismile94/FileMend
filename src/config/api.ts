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
} as const;

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
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

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasAlreadyOptimized: boolean;
  textHeavyPages: number;
  imageHeavyPages: number;
  compressionLevel: string;
}

export async function compressPDF(
  file: File,
  level: 'low' | 'medium' | 'extreme' = 'medium',
  onProgress?: (progress: number) => void
): Promise<CompressResult> {
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new APIError(
        `Compression failed: ${errorText}`,
        response.status,
        errorText
      );
    }

    const blob = await response.blob();

    if (onProgress) {
      onProgress(100);
    }

    const originalSize = parseInt(
      response.headers.get('X-Original-Size') || '0'
    );
    const compressedSizeFromHeader = parseInt(
      response.headers.get('X-Compressed-Size') || '0'
    );
    const compressionRatio = parseFloat(
      response.headers.get('X-Compression-Ratio') || '0'
    );
    const wasAlreadyOptimized =
      response.headers.get('X-Already-Optimized') === 'true';
    const textHeavyPages = parseInt(
      response.headers.get('X-Text-Heavy-Pages') || '0'
    );
    const imageHeavyPages = parseInt(
      response.headers.get('X-Image-Heavy-Pages') || '0'
    );
    const compressionLevel =
      response.headers.get('X-Compression-Level') || level;

    // CORS'da header okunamıyorsa blob boyutunu kullan (sıkıştırılmış boyut her zaman gösterilsin)
    const compressedSize =
      compressedSizeFromHeader > 0 ? compressedSizeFromHeader : blob.size;

    return {
      blob,
      originalSize,
      compressedSize,
      compressionRatio,
      wasAlreadyOptimized,
      textHeavyPages,
      imageHeavyPages,
      compressionLevel,
    };
  } catch (error) {
    clearInterval(progressInterval);

    if (error instanceof APIError) {
      throw error;
    }

    throw new APIError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      500,
      error
    );
  }
}
