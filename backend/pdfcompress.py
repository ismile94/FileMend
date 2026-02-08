"""
PDF Compression API Service - FIXED VERSION
FastAPI backend for intelligent PDF compression with proper level differentiation
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import io
import logging
from typing import Optional, Dict, List, Tuple
from PIL import Image
import fitz  # PyMuPDF
import tempfile
import os
import math

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI App
app = FastAPI(
    title="PDF Compress API",
    description="Intelligent PDF compression with object-level text/image/table preservation",
    version="2.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",
        "https://*.hf.space",
        "https://filemend.com",
        "https://www.filemend.com",
        "http://filemend.com",
        "http://www.filemend.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Original-Size",
        "X-Compressed-Size",
        "X-Compression-Ratio",
        "X-Already-Optimized",
        "X-Pages-Processed",
        "X-Images-Compressed",
        "X-Compression-Level",
    ],
)

# Minimum dosya boyutu (bytes) - 500KB
MIN_FILE_SIZE = 500 * 1024

# ✅ FIXED: Compression settings with clearer differentiation
COMPRESSION_SETTINGS = {
    'low': {
        'quality': 90,           # Yüksek kalite
        'max_dimension': 4000,   # Büyük boyut
        'raster_dpi': 200,       # Yüksek DPI
        'auto_quality_boost': 5  # Otomatik artırma miktarı
    },
    'medium': {
        'quality': 75,           # Orta kalite
        'max_dimension': 2400,   # Orta boyut
        'raster_dpi': 150,       # Orta DPI
        'auto_quality_boost': 3  # Daha az artırma
    },
    'extreme': {
        'quality': 55,           # Düşük kalite
        'max_dimension': 1600,   # Küçük boyut
        'raster_dpi': 100,       # Düşük DPI
        'auto_quality_boost': 0  # Artırma yok
    }
}


def analyze_page_detailed(page) -> Dict:
    """
    Sayfayı detaylı analiz et: metin, görsel, tablo oranlarını hesapla
    """
    try:
        rect = page.rect
        page_area = rect.width * rect.height
        
        # Metin analizi
        text_blocks = page.get_text("blocks")
        text_area = 0
        text_chars = 0
        
        for block in text_blocks:
            if len(block) >= 7:
                x0, y0, x1, y1 = block[0], block[1], block[2], block[3]
                w, h = max(0, x1 - x0), max(0, y1 - y0)
                text_area += w * h
                if isinstance(block[4], str):
                    text_chars += len(block[4])
        
        # Görsel analizi
        images = page.get_images(full=True)
        image_area = 0
        
        image_list = []
        for img_index, img in enumerate(images, start=1):
            xref = img[0]
            try:
                for img_info in page.get_image_info():
                    if img_info['xref'] == xref:
                        bbox = img_info['bbox']
                        w = max(0, bbox[2] - bbox[0])
                        h = max(0, bbox[3] - bbox[1])
                        area = w * h
                        image_area += area
                        image_list.append({
                            'xref': xref,
                            'bbox': bbox,
                            'area': area,
                            'width': img_info.get('width', 0),
                            'height': img_info.get('height', 0),
                            'cs_name': img_info.get('cs_name', 'RGB')
                        })
                        break
            except Exception as e:
                logger.warning(f"Image analysis error for xref {xref}: {e}")
        
        # Tablo tespiti
        is_table_heavy = False
        if len(text_blocks) > 5:
            y_positions = [b[1] for b in text_blocks[:10]]
            if len(y_positions) > 3:
                diffs = [y_positions[i+1] - y_positions[i] for i in range(len(y_positions)-1)]
                avg_diff = sum(diffs) / len(diffs) if diffs else 0
                variance = sum((d - avg_diff) ** 2 for d in diffs) / len(diffs) if diffs else 0
                if variance < 5 and text_chars > 200:
                    is_table_heavy = True
        
        return {
            'text_ratio': text_area / page_area if page_area > 0 else 0,
            'image_ratio': image_area / page_area if page_area > 0 else 0,
            'text_chars': text_chars,
            'image_count': len(images),
            'images': image_list,
            'is_table_heavy': is_table_heavy,
            'page_area': page_area
        }
    except Exception as e:
        logger.error(f"Detailed page analysis error: {e}")
        return {
            'text_ratio': 0,
            'image_ratio': 0,
            'text_chars': 0,
            'image_count': 0,
            'images': [],
            'is_table_heavy': False,
            'page_area': 0
        }


def compress_image_advanced(image_bytes: bytes, settings: Dict) -> bytes:
    """
    ✅ FIXED: Görseli gelişmiş şekilde sıkıştır (quality boost kontrolü eklendi)
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        original_format = img.format
        
        # RGB/RGBA kontrolü
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # ✅ FIXED: Boyut kontrolü - max_dimension kullan
        max_dim = settings['max_dimension']
        if max(img.width, img.height) > max_dim:
            ratio = max_dim / max(img.width, img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {img.width}x{img.height} to {new_size[0]}x{new_size[1]}")
        
        # JPEG sıkıştırma
        output = io.BytesIO()
        
        # Kalite ayarı
        quality = settings['quality']
        
        # ✅ FIXED: Otomatik kalite artırma - sadece izin verilirse
        auto_boost = settings.get('auto_quality_boost', 0)
        if auto_boost > 0:
            img_array = list(img.getdata())
            if len(img_array) > 1000:
                sample = img_array[::len(img_array)//1000]
                avg_color = (
                    sum(p[0] for p in sample) / len(sample),
                    sum(p[1] for p in sample) / len(sample),
                    sum(p[2] for p in sample) / len(sample)
                )
                variance = sum(
                    ((p[0]-avg_color[0])**2 + (p[1]-avg_color[1])**2 + (p[2]-avg_color[2])**2) 
                    for p in sample
                ) / len(sample)
                
                # Yüksek varyans = detaylı görsel
                if variance > 1000:
                    quality = min(95, quality + auto_boost)
                    logger.info(f"Quality boosted from {settings['quality']} to {quality} (variance: {variance:.0f})")
        
        img.save(output, format='JPEG', quality=quality, optimize=True, progressive=True)
        compressed = output.getvalue()
        
        # Eğer sıkıştırma sonrası daha büyük olduysa orijinali döndür
        if len(compressed) >= len(image_bytes) and original_format in ['JPEG', 'JPG']:
            return image_bytes
            
        logger.info(f"Compressed image: {len(image_bytes)} → {len(compressed)} bytes ({100*(len(image_bytes)-len(compressed))/len(image_bytes):.1f}% reduction)")
        return compressed
        
    except Exception as e:
        logger.error(f"Advanced image compression error: {e}")
        return image_bytes


def create_optimized_pdf(input_path: str, output_path: str, settings: Dict) -> Dict:
    """
    ✅ FIXED: PDF'i optimize et - tüm sayfa tiplerinde ayarları kullan
    """
    src = fitz.open(input_path)
    doc = fitz.open()
    
    total_stats = {
        'pages_processed': 0,
        'images_processed': 0,
        'images_compressed': 0,
        'total_bytes_saved': 0,
        'text_pages': 0,
        'image_pages': 0,
        'hybrid_pages': 0
    }
    
    try:
        for page_num in range(len(src)):
            page = src[page_num]
            analysis = analyze_page_detailed(page)
            
            # Yeni sayfa oluştur
            new_page = doc.new_page(width=page.rect.width, height=page.rect.height)
            
            # Sayfa tipine göre strateji
            text_ratio = analysis['text_ratio']
            image_ratio = analysis['image_ratio']
            
            if image_ratio < 0.05:
                # ✅ FIXED: Saf metin sayfası - direkt kopyala (metin için sıkıştırma gerekmez)
                new_page.show_pdf_page(new_page.rect, src, page_num)
                total_stats['text_pages'] += 1
                logger.info(f"Page {page_num+1}: Text-only, copied directly")
                
            elif text_ratio < 0.05 and image_ratio > 0.3:
                # ✅ FIXED: Saf görsel sayfası - raster_dpi ve max_dimension kullan
                dpi_scale = settings['raster_dpi'] / 72.0  # 72 DPI = varsayılan
                mat = fitz.Matrix(dpi_scale, dpi_scale)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                
                # PIL'e dönüştür ve boyut kontrolü yap
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                
                # Boyut sınırlaması
                max_dim = settings['max_dimension']
                if max(img.width, img.height) > max_dim:
                    ratio = max_dim / max(img.width, img.height)
                    new_size = (int(img.width * ratio), int(img.height * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    logger.info(f"Page {page_num+1}: Resized from {pix.width}x{pix.height} to {new_size[0]}x{new_size[1]}")
                
                # JPEG sıkıştırma
                output = io.BytesIO()
                img.save(output, format='JPEG', quality=settings['quality'], optimize=True, progressive=True)
                img_bytes = output.getvalue()
                
                new_page.insert_image(new_page.rect, stream=img_bytes)
                total_stats['image_pages'] += 1
                logger.info(f"Page {page_num+1}: Image-only, rasterized at {settings['raster_dpi']} DPI, quality {settings['quality']}")
                
            else:
                # ✅ IMPROVED: Hibrit sayfa - daha akıllı yaklaşım
                # Önce sayfayı vektör olarak kopyala
                new_page.show_pdf_page(new_page.rect, src, page_num)
                
                # Sonra her görseli ayrı sıkıştır
                images = page.get_images(full=True)
                
                for img_idx, img in enumerate(images):
                    try:
                        xref = img[0]
                        img_info_list = [i for i in page.get_image_info() if i['xref'] == xref]
                        
                        for img_info in img_info_list:
                            bbox = fitz.Rect(img_info['bbox'])
                            
                            # Orijinal görseli al
                            base_image = src.extract_image(xref)
                            if not base_image:
                                continue
                                
                            original_bytes = base_image["image"]
                            
                            # Görseli sıkıştır
                            compressed = compress_image_advanced(original_bytes, settings)
                            
                            # Eğer sıkıştırma başarılı olduysa
                            if len(compressed) < len(original_bytes):
                                # Yeni sıkıştırılmış görseli yerleştir
                                new_page.insert_image(bbox, stream=compressed)
                                
                                total_stats['images_compressed'] += 1
                                total_stats['total_bytes_saved'] += (len(original_bytes) - len(compressed))
                            
                            total_stats['images_processed'] += 1
                            
                    except Exception as e:
                        logger.warning(f"Hybrid page image optimization error: {e}")
                        continue
                
                total_stats['hybrid_pages'] += 1
                logger.info(f"Page {page_num+1}: Hybrid, {total_stats['images_compressed']} images compressed")
            
            total_stats['pages_processed'] += 1
        
        # PDF'i kaydet
        doc.save(
            output_path, 
            garbage=4, 
            deflate=True, 
            clean=True,
            linear=True,
            pretty=False
        )
        
        logger.info(f"PDF optimization complete: {total_stats}")
        
    finally:
        doc.close()
        src.close()
    
    return total_stats


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "PDF Compress API",
        "version": "2.1.0 (Fixed)",
        "min_file_size": MIN_FILE_SIZE,
        "compression_levels": list(COMPRESSION_SETTINGS.keys())
    }


@app.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    level: str = Form("medium")
):
    """
    Compress PDF file with object-level optimization
    
    - Preserves selectable text
    - Compresses images individually
    - Maintains table structures
    - 500KB minimum file size check
    """
    
    # Seviye kontrolü
    if level not in COMPRESSION_SETTINGS:
        level = 'medium'
    
    settings = COMPRESSION_SETTINGS[level]
    logger.info(f"Starting compression with level '{level}': {settings}")
    
    try:
        # PDF'i oku
        pdf_bytes = await file.read()
        original_size = len(pdf_bytes)
        
        # 500KB kontrolü
        if original_size < MIN_FILE_SIZE:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "File too small",
                    "message": f"Dosya boyutu çok küçük. Sıkıştırma için minimum gereksinim: 500KB. Yüklenen dosya: {original_size / 1024:.1f}KB",
                    "original_size": original_size,
                    "min_required": MIN_FILE_SIZE,
                    "code": "FILE_TOO_SMALL"
                }
            )
        
        # Temporary dosyalar
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_input:
            tmp_input.write(pdf_bytes)
            tmp_input_path = tmp_input.name
        
        output_path = tempfile.mktemp(suffix='.pdf')
        
        # Optimize et
        stats = create_optimized_pdf(tmp_input_path, output_path, settings)
        
        # Sonucu oku
        with open(output_path, 'rb') as f:
            optimized_bytes = f.read()
        
        compressed_size = len(optimized_bytes)
        
        # ✅ FIXED: Daha esnek eşik değerleri
        min_expected_ratio_map = {'low': 5, 'medium': 10, 'extreme': 15}
        min_expected_ratio = min_expected_ratio_map.get(level, 10)
        actual_ratio = ((original_size - compressed_size) / original_size) * 100
        
        logger.info(f"Compression result: {original_size} → {compressed_size} bytes ({actual_ratio:.2f}% reduction)")
        
        if actual_ratio < min_expected_ratio:
            # Temizlik
            os.unlink(tmp_input_path)
            os.unlink(output_path)
            
            logger.warning(f"Insufficient compression ({actual_ratio:.2f}% < {min_expected_ratio}%), returning original")
            
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="{file.filename}"',
                    "X-Original-Size": str(original_size),
                    "X-Compressed-Size": str(original_size),
                    "X-Compression-Ratio": "0",
                    "X-Already-Optimized": "true",
                    "X-Pages-Processed": str(stats['pages_processed']),
                    "X-Images-Compressed": "0",
                    "X-Compression-Level": level,
                    "X-Reason": "Insufficient compression gain"
                }
            )
        
        # Başarılı yanıt
        headers = {
            "Content-Disposition": f'attachment; filename="compressed_{file.filename}"',
            "X-Original-Size": str(original_size),
            "X-Compressed-Size": str(compressed_size),
            "X-Compression-Ratio": f"{actual_ratio:.2f}",
            "X-Already-Optimized": "false",
            "X-Pages-Processed": str(stats['pages_processed']),
            "X-Images-Compressed": str(stats['images_compressed']),
            "X-Compression-Level": level,
            "X-Text-Pages": str(stats['text_pages']),
            "X-Image-Pages": str(stats['image_pages']),
            "X-Hybrid-Pages": str(stats['hybrid_pages'])
        }
        
        # Cleanup
        os.unlink(tmp_input_path)
        os.unlink(output_path)
        
        return StreamingResponse(
            io.BytesIO(optimized_bytes),
            media_type="application/pdf",
            headers=headers
        )
        
    except Exception as e:
        logger.error(f"Compression error: {e}")
        # Cleanup on error
        try:
            if 'tmp_input_path' in locals():
                os.unlink(tmp_input_path)
            if 'output_path' in locals():
                os.unlink(output_path)
        except:
            pass
            
        raise HTTPException(status_code=500, detail=f"PDF compression failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)