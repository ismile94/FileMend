# Hugging Face Spaces Deployment Rehberi

## 1. Hugging Face'de Space Oluştur

1. https://huggingface.co/spaces adresine git
2. **"Create new Space"** tıkla
3. Şunları ayarla:
   - **Space name:** `pdf-converter-api` (veya istediğin isim)
   - **SDK:** **Docker**
   - **Visibility:** Public veya Private
   - **Space hardware:** CPU basic (veya ücretli GPU/CPU seç)

## 2. Dosyaları Space'e Yükle

`hf-space/` klasöründeki dosyaları Space repo root'una kopyala:

| Dosya | Açıklama |
|-------|----------|
| `app.py` | Ana FastAPI uygulaması |
| `requirements.txt` | Python bağımlılıkları |
| `Dockerfile` | HF Spaces için Docker imajı |
| `README.md` | YAML header + açıklama |

**Yöntem 1 – Web üzerinden:** Space sayfasında "Files" → "Add file" → her dosyayı tek tek ekle.

**Yöntem 2 – Git ile:**
```bash
# HF Space repo'yu klonla (URL'i Space oluşturduktan sonra alırsın)
git clone https://huggingface.co/spaces/KULLANICI_ADI/pdf-converter-api
cd pdf-converter-api

# hf-space dosyalarını kopyala
cp ../hf-space/app.py .
cp ../hf-space/requirements.txt .
cp ../hf-space/Dockerfile .
cp ../hf-space/README.md .

git add .
git commit -m "Add PDF to Word API"
git push
```

## 3. Secrets (Adobe credentials) Ekle

1. Space sayfasında **Settings** → **Repository secrets**
2. Şu secret'ları ekle:
   - **PDF_SERVICES_CLIENT_ID** → Adobe Client ID
   - **PDF_SERVICES_CLIENT_SECRET** → Adobe Client Secret

Bu değerler environment variable olarak otomatik geçer.

## 4. Space URL'ini Frontend'de Kullan

Space URL formatı: `https://KULLANICI_ADI-SPACE_ADI.hf.space`

Proje kökünde `.env.local` oluştur veya düzenle:

```
VITE_API_URL=https://KULLANICI_ADI-SPACE_ADI.hf.space
```

Örnek:
```
VITE_API_URL=https://johndoe-pdf-converter-api.hf.space
```

**Not:** URL sonunda `/` koyma. Frontend otomatik olarak `/convert/start`, `/convert/status/{id}`, `/convert/download/{id}` ekleyecek.

## 5. Build ve Deploy

Frontend'i build et:

```bash
npm run build
```

`VITE_API_URL` build sırasında gömülür. Production ortamında doğru URL'in set edildiğinden emin ol (Vercel/Netlify vb. için Environment Variables).

## 6. Test

Space açıldıktan sonra:

- `https://KULLANICI-SPACE.hf.space/health` → `{"status":"healthy",...}`
- PDFToWord sayfasında bir PDF yükle → dönüştürme başlamalı
