"""
PDF Compression API Service
FastAPI backend for intelligent PDF compression with object-level optimization
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
    version="2.0.0"
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

# Compression settings
COMPRESSION_SETTINGS = {
    'low': {'quality': 92, 'max_dimension': 3000, 'dpi_threshold': 150},
    'medium': {'quality': 80, 'max_dimension': 2500, 'dpi_threshold': 120},
    'extreme': {'quality': 60, 'max_dimension': 2000, 'dpi_threshold': 100}
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
            if len(block) >= 7:  # x0, y0, x1, y1, text, block_no, block_type
                x0, y0, x1, y1 = block[0], block[1], block[2], block[3]
                w, h = max(0, x1 - x0), max(0, y1 - y0)
                text_area += w * h
                if isinstance(block[4], str):
                    text_chars += len(block[4])
        
        # Görsel analizi
        images = page.get_images(full=True)
        image_area = 0
        
        # Her görselin sayfadaki pozisyonunu ve boyutunu bul
        image_list = []
        for img_index, img in enumerate(images, start=1):
            xref = img[0]
            try:
                # Görselin sayfadaki kullanımını bul (bbox)
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
        
        # Tablo tespiti (basit sezgisel: çok sayıda küçük metin bloğu + düzenli yapı)
        is_table_heavy = False
        if len(text_blocks) > 5:
            # Blokların düzenli aralıklarla olup olmadığını kontrol et
            y_positions = [b[1] for b in text_blocks[:10]]  # İlk 10 bloğun Y pozisyonu
            if len(y_positions) > 3:
                # Y pozisyonlarındaki düzenlilik
                diffs = [y_positions[i+1] - y_positions[i] for i in range(len(y_positions)-1)]
                avg_diff = sum(diffs) / len(diffs) if diffs else 0
                variance = sum((d - avg_diff) ** 2 for d in diffs) / len(diffs) if diffs else 0
                # Düşük varyans = düzenli satırlar (tablo olabilir)
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
    Görseli gelişmiş şekilde sıkıştır
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        original_format = img.format
        
        # RGB/RGBA kontrolü
        if img.mode in ('RGBA', 'LA', 'P'):
            # Beyaz arka planla birleştir
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Boyut kontrolü - çok büyük görselleri ölçeklendir
        max_dim = settings['max_dimension']
        if max(img.width, img.height) > max_dim:
            ratio = max_dim / max(img.width, img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # JPEG sıkıştırma
        output = io.BytesIO()
        
        # Kalite ayarı
        quality = settings['quality']
        
        # Görsel içeriğine göre kaliteyi ayarla (basit sezgisel)
        # Çok detaylı görsellerde biraz daha yüksek kalite
        img_array = list(img.getdata())
        # Basit varyans hesabı (detay göstergesi)
        if len(img_array) > 1000:
            sample = img_array[::len(img_array)//1000]  # 1000 örnek
            avg_color = (
                sum(p[0] for p in sample) / len(sample),
                sum(p[1] for p in sample) / len(sample),
                sum(p[2] for p in sample) / len(sample)
            )
            variance = sum(
                ((p[0]-avg_color[0])**2 + (p[1]-avg_color[1])**2 + (p[2]-avg_color[2])**2) 
                for p in sample
            ) / len(sample)
            
            # Yüksek varyans = detaylı görsel, kaliteyi %5 artır
            if variance > 1000:
                quality = min(95, quality + 5)
        
        img.save(output, format='JPEG', quality=quality, optimize=True, progressive=True)
        compressed = output.getvalue()
        
        # Eğer sıkıştırma sonrası daha büyük olduysa orijinali döndür
        if len(compressed) >= len(image_bytes) and original_format in ['JPEG', 'JPG']:
            return image_bytes
            
        return compressed
        
    except Exception as e:
        logger.error(f"Advanced image compression error: {e}")
        return image_bytes


def optimize_page_content(page, new_page, settings: Dict) -> Dict:
    """
    Sayfa içeriğini optimize et: Metni koru, görselleri sıkıştır
    """
    stats = {'images_processed': 0, 'images_compressed': 0, 'bytes_saved': 0}
    
    try:
        # 1. Metin katmanını kopyala (seçilebilir metin korunur)
        # PyMuPDF'de metin katmanı otomatik korunur when using show_pdf_page veya insert_pdf
        # Ancak biz görsel nesneleri ayrı işleyeceğiz
        
        # 2. Görsel nesneleri bul ve işle
        images = page.get_images(full=True)
        
        if not images:
            # Görsel yoksa sayfayı olduğu gibi kopyala
            return stats
        
        # Sayfadaki görsel kullanımlarını bul
        image_info_list = []
        for img_index, img in enumerate(images, start=1):
            xref = img[0]
            try:
                # Orijinal görseli çıkar
                base_image = page.parent.extract_image(xref)
                if not base_image:
                    continue
                    
                image_bytes = base_image["image"]
                ext = base_image["ext"]
                
                # Görselin sayfadaki tüm kullanımlarını bul
                for img_info in page.get_image_info():
                    if img_info['xref'] == xref:
                        bbox = fitz.Rect(img_info['bbox'])
                        
                        # Görseli sıkıştır
                        compressed_bytes = compress_image_advanced(image_bytes, settings)
                        
                        if len(compressed_bytes) < len(image_bytes):
                            stats['images_compressed'] += 1
                            stats['bytes_saved'] += (len(image_bytes) - len(compressed_bytes))
                        
                        # Yeni görseli ekle ve yerleştir
                        # Not: Bu yaklaşım yerine, daha temiz bir yöntem kullanacağız
                        # Tüm sayfayı yeniden oluşturmak yerine, görselleri değiştireceğiz
                        
            except Exception as e:
                logger.warning(f"Image processing error: {e}")
                continue
        
        stats['images_processed'] = len(images)
        return stats
        
    except Exception as e:
        logger.error(f"Page optimization error: {e}")
        return stats


def create_optimized_pdf(input_path: str, output_path: str, settings: Dict) -> Dict:
    """
    PDF'i optimize et: Metin vektör kalır, görseller sıkıştırılır
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
            
            # Yeni sayfa oluştur (aynı boyutlar)
            new_page = doc.new_page(width=page.rect.width, height=page.rect.height)
            
            # Sayfa tipine göre strateji
            text_ratio = analysis['text_ratio']
            image_ratio = analysis['image_ratio']
            
            if image_ratio < 0.05:
                # Saf metin sayfası - direkt kopyala
                new_page.show_pdf_page(new_page.rect, src, page_num)
                total_stats['text_pages'] += 1
                
            elif text_ratio < 0.05 and image_ratio > 0.3:
                # Saf görsel sayfası - tam rasterize (eski davranış)
                mat = fitz.Matrix(1.0, 1.0)
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img_bytes = pix.tobytes("jpeg", jpg_quality=settings['quality'])
                new_page.insert_image(new_page.rect, stream=img_bytes)
                total_stats['image_pages'] += 1
                
            else:
                # Hibrit sayfa - metni koru, görselleri optimize et
                # 1. Önce sayfanın arka planını/ana içeriğini kopyala
                new_page.show_pdf_page(new_page.rect, src, page_num)
                
                # 2. Görsel nesneleri bul ve optimize et
                # Bu karmaşık bir işlem - görselleri yeniden sıkıştırıp yerleştir
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
                            
                            # Eğer sıkıştırma başarılı olduysa, görseli değiştir
                            if len(compressed) < len(original_bytes):
                                # Mevcut görseli yeni sıkıştırılmışıyla değiştir
                                # Not: PyMuPDF'de mevcut görseli değiştirmek yerine 
                                # üzerine yeni bir görsel yerleştiriyoruz
                                
                                # Görsel alanını beyaz arka planla temizle (opsiyonel)
                                # new_page.draw_rect(bbox, color=(1, 1, 1), fill=(1, 1, 1))
                                
                                # Yeni sıkıştırılmış görseli yerleştir
                                new_page.insert_image(bbox, stream=compressed)
                                
                                total_stats['images_compressed'] += 1
                                total_stats['total_bytes_saved'] += (len(original_bytes) - len(compressed))
                            
                            total_stats['images_processed'] += 1
                            
                    except Exception as e:
                        logger.warning(f"Hybrid page image optimization error: {e}")
                        continue
                
                total_stats['hybrid_pages'] += 1
            
            total_stats['pages_processed'] += 1
        
        # PDF'i kaydet (agresif optimizasyon)
        doc.save(
            output_path, 
            garbage=4, 
            deflate=True, 
            clean=True,
            linear=True,  # Web görüntüleme için optimize et
            pretty=False
        )
        
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
        "version": "2.0.0",
        "min_file_size": MIN_FILE_SIZE
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
        
        # Eğer dosya büyüdüyse veya çok az küçüldüyse orijinali döndür
        min_expected_ratio = 2 if level == 'low' else 5 if level == 'medium' else 8
        actual_ratio = ((original_size - compressed_size) / original_size) * 100
        
        if actual_ratio < min_expected_ratio:
            # Temizlik
            os.unlink(tmp_input_path)
            os.unlink(output_path)
            
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