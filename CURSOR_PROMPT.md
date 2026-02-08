# Cursor Prompt: PDF Compress Backend Entegrasyonu

## 🎯 Görev Özeti

Mevcut `src/pages/pdf/PDFCompress.tsx` sayfasındaki client-side PDF compression mantığını, Python FastAPI backend'e taşıyacaksın. Backend Hugging Face Spaces'te, frontend Vercel'de deploy edilecek.

---

## 📁 ADIM 1: Backend Dosyaları Oluştur

Proje root'unda `backend/` klasörü oluştur ve şu dosyaları ekle:

### backend/pdfcompress.py

```python
"""
PDF Compression API Service
FastAPI backend for intelligent PDF compression
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
import logging
from typing import Optional
from PIL import Image
import fitz  # PyMuPDF
from pypdf import PdfReader, PdfWriter
import tempfile
import os

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI App
app = FastAPI(
    title="PDF Compress API",
    description="Intelligent PDF compression with hybrid text/image optimization",
    version="1.0.0"
)

# CORS - Vercel deployment için
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://*.hf.space",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def compress_image(image_bytes: bytes, quality: int, scale: float = 1.0) -> bytes:
    """Compress image with given quality and scale"""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # RGB'ye çevir (RGBA varsa)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Scale uygula
        if scale != 1.0:
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # JPEG olarak sıkıştır
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        return output.getvalue()
    except Exception as e:
        logger.error(f"Image compression error: {e}")
        return image_bytes


def analyze_page_content(page) -> dict:
    """Analyze page to determine if it's text-heavy or image-heavy"""
    try:
        text = page.get_text()
        text_length = len(text.strip())
        
        # Görsel sayısı
        image_list = page.get_images()
        image_count = len(image_list)
        
        # Sayfa boyutu
        rect = page.rect
        page_area = rect.width * rect.height
        
        # Basit sınıflandırma: 
        # - Eğer 100'den fazla karakter varsa ve görsel yoksa -> text-heavy
        # - Eğer görsel varsa -> image-heavy
        is_text_heavy = text_length > 100 and image_count == 0
        
        return {
            'is_text_heavy': is_text_heavy,
            'text_length': text_length,
            'image_count': image_count
        }
    except Exception as e:
        logger.error(f"Page analysis error: {e}")
        return {'is_text_heavy': False, 'text_length': 0, 'image_count': 0}


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "PDF Compress API",
        "version": "1.0.0"
    }


@app.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium")
):
    """
    Compress PDF file with intelligent hybrid approach
    
    Parameters:
    - file: PDF file to compress
    - level: Compression level (low/medium/extreme)
    """
    
    # Compression settings
    settings = {
        'low': {'quality': 85, 'scale': 1.0, 'min_compression': 3},
        'medium': {'quality': 65, 'scale': 1.0, 'min_compression': 5},
        'extreme': {'quality': 45, 'scale': 0.85, 'min_compression': 10}
    }
    
    if level not in settings:
        level = 'medium'
    
    config = settings[level]
    
    try:
        # PDF'i oku
        pdf_bytes = await file.read()
        original_size = len(pdf_bytes)
        
        # Temporary file oluştur
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_input:
            tmp_input.write(pdf_bytes)
            tmp_input_path = tmp_input.name
        
        # PyMuPDF ile aç
        pdf_document = fitz.open(tmp_input_path)
        
        # Yeni PDF oluştur
        output_pdf_path = tempfile.mktemp(suffix='.pdf')
        output_pdf = fitz.open()
        
        text_heavy_count = 0
        image_heavy_count = 0
        
        # Her sayfayı işle
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            analysis = analyze_page_content(page)
            
            if analysis['is_text_heavy']:
                # Text-heavy: Direkt kopyala (lossless)
                text_heavy_count += 1
                output_pdf.insert_pdf(pdf_document, from_page=page_num, to_page=page_num)
            else:
                # Image-heavy: Render edip sıkıştır
                image_heavy_count += 1
                
                # Sayfayı resme çevir
                mat = fitz.Matrix(config['scale'], config['scale'])
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img_bytes = pix.tobytes("jpeg", quality=config['quality'])
                
                # Yeni sayfa oluştur
                img_pdf = fitz.open("pdf", img_bytes)
                rect = page.rect
                new_page = output_pdf.new_page(width=rect.width, height=rect.height)
                
                # Görseli ekle
                new_page.insert_image(rect, stream=img_bytes)
                img_pdf.close()
        
        # PDF'i kaydet
        output_pdf.save(output_pdf_path, garbage=4, deflate=True, clean=True)
        output_pdf.close()
        pdf_document.close()
        
        # Compressed PDF'i oku
        with open(output_pdf_path, 'rb') as f:
            compressed_bytes = f.read()
        
        compressed_size = len(compressed_bytes)
        compression_ratio = ((original_size - compressed_size) / original_size) * 100
        
        # Cleanup
        os.unlink(tmp_input_path)
        os.unlink(output_pdf_path)
        
        # Eğer yeterli sıkıştırma olmadıysa orijinali döndür
        if compression_ratio < config['min_compression']:
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="compressed_{file.filename}"',
                    "X-Original-Size": str(original_size),
                    "X-Compressed-Size": str(original_size),
                    "X-Compression-Ratio": "0",
                    "X-Already-Optimized": "true",
                    "X-Text-Heavy-Pages": str(text_heavy_count),
                    "X-Image-Heavy-Pages": str(image_heavy_count)
                }
            )
        
        # Başarılı sıkıştırma
        return StreamingResponse(
            io.BytesIO(compressed_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="compressed_{file.filename}"',
                "X-Original-Size": str(original_size),
                "X-Compressed-Size": str(compressed_size),
                "X-Compression-Ratio": f"{compression_ratio:.2f}",
                "X-Already-Optimized": "false",
                "X-Text-Heavy-Pages": str(text_heavy_count),
                "X-Image-Heavy-Pages": str(image_heavy_count),
                "X-Compression-Level": level
            }
        )
        
    except Exception as e:
        logger.error(f"Compression error: {e}")
        raise HTTPException(status_code=500, detail=f"PDF compression failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
```

### backend/requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6
PyMuPDF==1.23.26
pypdf==4.0.1
Pillow==10.2.0
```

### backend/Dockerfile

```dockerfile
FROM python:3.11-slim

# Sistem bağımlılıkları
RUN apt-get update && apt-get install -y \
    build-essential \
    mupdf \
    mupdf-tools \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# Requirements'ı kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyalarını kopyala
COPY pdfcompress.py .

# Port expose
EXPOSE 7860

# Hugging Face Spaces için gerekli environment variables
ENV GRADIO_SERVER_NAME="0.0.0.0"
ENV GRADIO_SERVER_PORT=7860

# Uvicorn ile başlat
CMD ["uvicorn", "pdfcompress:app", "--host", "0.0.0.0", "--port", "7860"]
```

### backend/README.md

```markdown
# PDF Compress API Backend

FastAPI backend for PDF compression service.

## Deployment

Deploy to Hugging Face Spaces with Docker SDK.

## Local Development

```bash
pip install -r requirements.txt
python pdfcompress.py
```

API: http://localhost:7860
```

### backend/.gitignore

```
__pycache__/
*.py[cod]
*.pyc
.Python
venv/
ENV/
.DS_Store
*.log
```

---

## 📁 ADIM 2: Frontend API Modülü Oluştur

### src/config/api.ts

```typescript
/**
 * API Configuration
 */

export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7860',
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

    const originalSize = parseInt(response.headers.get('X-Original-Size') || '0');
    const compressedSize = parseInt(response.headers.get('X-Compressed-Size') || '0');
    const compressionRatio = parseFloat(response.headers.get('X-Compression-Ratio') || '0');
    const wasAlreadyOptimized = response.headers.get('X-Already-Optimized') === 'true';
    const textHeavyPages = parseInt(response.headers.get('X-Text-Heavy-Pages') || '0');
    const imageHeavyPages = parseInt(response.headers.get('X-Image-Heavy-Pages') || '0');
    const compressionLevel = response.headers.get('X-Compression-Level') || level;

    const blob = await response.blob();

    if (onProgress) {
      onProgress(100);
    }

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
```

---

## 📁 ADIM 3: PDFCompress.tsx Güncelle

`src/pages/pdf/PDFCompress.tsx` dosyasında şu değişiklikleri yap:

### Import ekle (dosyanın başına):

```typescript
import { compressPDF, checkHealth, APIError } from '@/config/api';
```

### compressSingleFile fonksiyonunu değiştir:

Mevcut `compressSingleFile` fonksiyonunun TÜM içeriğini sil ve bununla değiştir:

```typescript
const compressSingleFile = async (fileId: string, level?: CompressionLevel) => {
  const fileStatus = files.find(f => f.id === fileId);
  if (!fileStatus) return;

  const currentLevel = level || compressionLevel;

  setFiles(prev => prev.map(f =>
    f.id === fileId ? { ...f, isProcessing: true, error: undefined, progress: 0 } : f
  ));

  try {
    // Backend API'sini kullan
    const result = await compressPDF(
      fileStatus.file,
      currentLevel,
      // Progress callback
      (progress) => {
        setFiles(prev => prev.map(f =>
          f.id === fileId ? { ...f, progress: Math.round(progress) } : f
        ));
      }
    );

    // State'i güncelle
    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? {
            ...f,
            compressedBlob: result.blob,
            compressedSize: result.compressedSize,
            compressionRatio: result.compressionRatio,
            isProcessing: false,
            progress: 100,
            compressionLevel: currentLevel,
            wasAlreadyOptimized: result.wasAlreadyOptimized,
          }
        : f
    ));

    // Bilgilendirme mesajı
    if (result.wasAlreadyOptimized) {
      toast({
        title: 'Bilgi',
        description: `${fileStatus.file.name} zaten optimize edilmiş. Orijinal dosya korundu.`,
      });
    } else {
      const levelLabel = currentLevel === 'low' ? 'Düşük' : currentLevel === 'medium' ? 'Orta' : 'Yüksek';
      const modeInfo = result.imageHeavyPages > 0 
        ? `${result.textHeavyPages} sayfa korundu, ${result.imageHeavyPages} sayfa sıkıştırıldı`
        : 'Metin sayfaları optimize edildi';
      
      toast({
        title: t.messages.success,
        description: `${fileStatus.file.name} - %${Math.round(result.compressionRatio)} küçültme (${levelLabel} - ${modeInfo})`,
      });
    }
  } catch (error) {
    console.error('Compression error:', error);
    
    let errorMessage = t.pdfCompress.unknownError;
    
    if (error instanceof APIError) {
      if (error.status === 413) {
        errorMessage = 'Dosya çok büyük (max 50MB)';
      } else if (error.status === 408) {
        errorMessage = 'İstek zaman aşımına uğradı';
      } else {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, isProcessing: false, error: errorMessage, progress: 0 }
        : f
    ));

    toast({
      title: t.messages.error,
      description: `${fileStatus.file.name} ${t.pdfCompress.couldNotCompress}. ${errorMessage}`,
      variant: 'destructive',
    });
  }
};
```

### Health check ekle (component içine, hooks bölümüne):

```typescript
// Component'in içinde, diğer useState'lerin altına ekle:
useEffect(() => {
  const checkBackendHealth = async () => {
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      console.warn('Backend service is not available');
      // İsterseniz kullanıcıya göstermeyebilirsiniz
    }
  };
  
  checkBackendHealth();
}, []);
```

### Kullanılmayan import'ları sil:

Artık bu import'lar kullanılmıyor, silebilirsin:
```typescript
// SİL:
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// SİL (eğer sadece compress için kullanılıyorsa):
// pdfjsLib.GlobalWorkerOptions.workerSrc = ...
```

---

## 📁 ADIM 4: Environment Variables

### .env.local (root dizinde oluştur)

```env
# Development
NEXT_PUBLIC_API_URL=http://localhost:7860
```

### .env.production (root dizinde oluştur)

```env
# Production - Hugging Face Spaces URL'nizi buraya yazın
NEXT_PUBLIC_API_URL=https://YOUR-USERNAME-pdf-compress-api.hf.space
```

### .env.example (root dizinde oluştur)

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:7860

# Production'da Hugging Face Spaces URL'nizi kullanın:
# NEXT_PUBLIC_API_URL=https://YOUR-USERNAME-pdf-compress-api.hf.space
```

---

## 📁 ADIM 5: Package.json Scripts Güncelle (opsiyonel)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "backend:dev": "cd backend && python pdfcompress.py",
    "backend:install": "cd backend && pip install -r requirements.txt"
  }
}
```

---

## 🚀 DEPLOYMENT ADIMLARI

### Backend Deploy (Hugging Face Spaces)

1. https://huggingface.co/spaces adresine git
2. "Create new Space" butonuna tıkla
3. Ayarlar:
   - **Space name**: `pdf-compress-api`
   - **SDK**: **Docker** (ÖNEMLİ!)
   - **License**: MIT
   - **Visibility**: Public

4. `backend/` klasöründeki dosyaları yükle:
   - `Dockerfile`
   - `pdfcompress.py`
   - `requirements.txt`
   - `README.md`
   - `.gitignore`

5. Build tamamlanınca URL'yi not al: `https://YOUR-USERNAME-pdf-compress-api.hf.space`

### Frontend Deploy (Vercel)

1. `.env.production` dosyasındaki URL'yi güncelle
2. Git commit & push:
   ```bash
   git add .
   git commit -m "Add backend integration"
   git push
   ```

3. Vercel Dashboard → Settings → Environment Variables
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://YOUR-USERNAME-pdf-compress-api.hf.space`
   - **Environment**: Production, Preview, Development

4. Redeploy (otomatik veya manuel)

---

## ✅ TEST ADIMLARI

### Lokal Test

```bash
# Terminal 1 - Backend
cd backend
pip install -r requirements.txt
python pdfcompress.py

# Terminal 2 - Frontend
npm run dev

# Tarayıcıda: http://localhost:3000
# PDF Compress sayfasına git ve test et
```

### Health Check

```bash
# Backend'in çalıştığını kontrol et:
curl http://localhost:7860/

# Beklenen çıktı:
# {"status":"healthy","service":"PDF Compress API","version":"1.0.0"}
```

### Production Test

1. Vercel URL'ni aç
2. PDF Compress sayfasına git
3. PDF yükle
4. Sıkıştır
5. Browser Console'da network tab'ı kontrol et

---

## 🐛 SORUN GİDERME

### CORS Hatası

`backend/pdfcompress.py` dosyasında CORS ayarlarına Vercel URL'nizi ekleyin:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",  # EKLE
        "https://*.vercel.app",
    ],
    # ...
)
```

### Backend Build Hatası

- Hugging Face Spaces → Logs sekmesini kontrol et
- Dockerfile syntax doğru mu?
- requirements.txt var mı?

### API Bağlantı Hatası

- Environment variable doğru mu?
- Backend build tamamlandı mı?
- CORS ayarları doğru mu?

---

## 📝 ÖNEMLİ NOTLAR

1. **Client-side kod tamamen kaldırıldı** - Artık tüm işlem backend'de
2. **Progress tracking** - Simüle edilmiş (gerçek progress için SSE gerekir)
3. **File size limit** - 50 MB (backend'de değiştirilebilir)
4. **CORS** - Vercel URL'nizi mutlaka ekleyin
5. **Environment variables** - `NEXT_PUBLIC_` prefix zorunlu

---

## ✨ YAPILDI!

Tüm dosyaları oluştur, deploy et, test et. Başarılar! 🚀
