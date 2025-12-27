# IrisClassifier - Plan de Implementación Completo

Aplicación multiplataforma para escanear catálogos/listas de precios, extraer productos automáticamente y clasificarlos por rangos de precio dinámicos. Funciona en **Web, iOS y Android** desde una sola codebase usando Capacitor.

## User Review Required

> [!IMPORTANT]
> **Requisito: Ollama instalado** - Para la IA local gratuita, necesitas tener [Ollama](https://ollama.ai) instalado en tu servidor/PC. El teléfono se conecta al backend remoto.

> [!NOTE]
> **Modelo recomendado**: `llama3.2` o `mistral` - Buenos para clasificación. Descargar con: `ollama pull llama3.2`

> [!WARNING]
> **Stack actualizado**: Este plan usa **Vite + React + Capacitor** para apps nativas en iOS/Android. El procesamiento (IA, PDF, OCR) ocurre en el backend, no en el dispositivo.

### 📚 Documentación Complementaria

| Documento | Contenido |
|-----------|-----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Patrones de diseño, SOLID, Unit Tests |
| [PERFORMANCE_TUNING.md](./PERFORMANCE_TUNING.md) | Tuning de rendimiento, índices, caché, **Monitoreo con Prometheus/Grafana** |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | Endpoints, request/response, SDK, **Estrategia de Versionamiento** |

---

## Arquitectura del Sistema

```mermaid
graph TB
    subgraph Clients["📱 Clientes (Una Codebase)"]
        Web["🌐 Web Browser"]
        iOS["📱 iOS App"]
        Android["🤖 Android App"]
    end
    
    subgraph Frontend["Vite + React + Capacitor"]
        UI[Interfaz de Usuario]
        Camera[Capacitor Camera]
        FileSystem[Capacitor Filesystem]
        Preferences[Capacitor Preferences]
        ReactQuery[TanStack Query Cache]
    end
    
    subgraph Backend["⚙️ Backend (Python + FastAPI)"]
        API[API REST]
        Auth[Autenticación JWT]
        Validation[Validación/Sanitización]
        RateLimit[Rate Limiting]
        Cache[Caché Redis/Memoria]
        
        subgraph Services["Servicios de Procesamiento"]
            GeminiVision["🤖 Gemini Vision (Primary)"]
            GeminiPDF[GeminiPDFExtractor]
            PDF[pdfplumber + tabula-py]
            Excel[pandas + openpyxl]
            Tesseract[Tesseract OCR]
            Ollama[Ollama LLM]
            Fallback[Clasificador Fallback]
            GeminiRateLimiter[Rate Limiter]
        end
        
        DB[(PostgreSQL/SQLite)]
        Logger[Logging Estructurado]
    end
    
    Web --> Frontend
    iOS --> Frontend
    Android --> Frontend
    
    Frontend -->|HTTPS| API
    API --> Auth
    Auth --> Validation
    Validation --> RateLimit
    RateLimit --> Cache
    Cache --> Services
    Services --> DB
    API --> Logger
    GeminiVision --> GeminiRateLimiter
    GeminiPDF --> GeminiVision
    GeminiPDF -.->|Fallback| PDF
```

---

## ¿Por Qué Vite + React + Capacitor?

| Aspecto | Beneficio |
|---------|-----------|
| **Una sola codebase** | Web + iOS + Android desde el mismo código React |
| **Acceso nativo** | Cámara, sistema de archivos, notificaciones via Capacitor plugins |
| **Publicable en tiendas** | App Store y Google Play Store |
| **Desarrollo rápido** | Hot reload en web, live reload en dispositivos |
| **Sin Expo/React Native** | Más simple, usa tecnologías web estándar |
| **Backend separado** | El procesamiento pesado (IA, PDF) queda en servidor |

### Comparación de Stacks

| Stack | Web | iOS | Android | Cámara Nativa | Complejidad |
|-------|-----|-----|---------|---------------|-------------|
| Astro + React PWA | ✅ | ⚠️ PWA | ⚠️ PWA | ❌ | Baja |
| **Vite + React + Capacitor** | ✅ | ✅ Nativa | ✅ Nativa | ✅ | Media |
| React Native | ❌ | ✅ | ✅ | ✅ | Alta |
| Flutter | ❌ | ✅ | ✅ | ✅ | Alta |

---

## Estructura del Proyecto

```
iridescent-gravity/
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Configuración centralizada
│   ├── requirements.txt        # Dependencias con versiones fijas
│   ├── .env.example            # Template de variables de entorno
│   ├── database/
│   │   ├── __init__.py
│   │   ├── connection.py       # Pool de conexiones
│   │   ├── models.py           # SQLAlchemy models
│   │   └── migrations/         # Alembic migrations
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py     # Inyección de dependencias
│   │   └── v1/
│   │       ├── routers/
│   │       │   ├── upload.py
│   │       │   ├── products.py
│   │       │   ├── catalogs.py
│   │       │   ├── price_ranges.py
│   │       │   ├── classify.py
│   │       │   └── export.py
│   │       └── schemas/
│   │           ├── product.py
│   │           ├── catalog.py
│   │           └── price_range.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── pdf_extractor.py
│   │   ├── excel_parser.py
│   │   ├── ocr_service.py
│   │   ├── ai_classifier.py
│   │   ├── fallback_classifier.py
│   │   ├── cache_service.py
│   │   └── exporter.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py
│   │   ├── exceptions.py
│   │   └── logging.py
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_pdf_extractor.py
│       ├── test_ai_classifier.py
│       └── test_api/
│           └── test_products.py
│
├── frontend/                    # 📱 Vite + React + Capacitor
│   ├── vite.config.ts
│   ├── capacitor.config.ts      # Configuración Capacitor
│   ├── package.json
│   ├── tsconfig.json
│   ├── index.html
│   │
│   ├── android/                 # 🤖 Generado por Capacitor
│   │   ├── app/
│   │   └── build.gradle
│   │
│   ├── ios/                     # 📱 Generado por Capacitor
│   │   └── App/
│   │
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   └── icons/
│   │
│   └── src/
│       ├── main.tsx             # Entry point
│       ├── App.tsx              # Router principal
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx    # Página principal
│       │   ├── Upload.tsx       # Subir archivos
│       │   ├── Products.tsx     # Lista de productos
│       │   ├── CameraCapture.tsx # Escanear con cámara
│       │   └── Settings.tsx     # Configuración de rangos
│       │
│       ├── components/
│       │   ├── ui/              # Componentes base
│       │   │   ├── Button.tsx
│       │   │   ├── Card.tsx
│       │   │   ├── Input.tsx
│       │   │   └── Modal.tsx
│       │   ├── FileUpload.tsx   # Drag & drop + file picker
│       │   ├── ProductTable.tsx # Tabla con filtros
│       │   ├── PriceRangeEditor.tsx
│       │   ├── ClassificationBadge.tsx
│       │   └── ExportButtons.tsx
│       │
│       ├── hooks/
│       │   ├── useApi.ts        # Cliente API con React Query
│       │   ├── useProducts.ts
│       │   ├── useCatalogs.ts
│       │   ├── useCamera.ts     # Hook para Capacitor Camera
│       │   └── useOfflineSync.ts
│       │
│       ├── services/
│       │   ├── api.ts           # Axios instance configurada
│       │   ├── camera.ts        # Wrapper Capacitor Camera
│       │   ├── filesystem.ts    # Wrapper Capacitor Filesystem
│       │   └── storage.ts       # Capacitor Preferences
│       │
│       ├── utils/
│       │   ├── validation.ts
│       │   └── formatters.ts
│       │
│       └── styles/
│           ├── globals.css
│           └── variables.css
│
├── docker-compose.yml           # Backend + DB para desarrollo
└── README.md
```

---

## Configuración de Capacitor

### capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.irisclassifier.app',
  appName: 'IrisClassifier',
  webDir: 'dist',
  server: {
    // En desarrollo, apuntar al backend local
    // En producción, esto se configura dinámicamente
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      // Permisos de cámara
    },
    Filesystem: {
      // Acceso a archivos
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1f2937',
    }
  }
};

export default config;
```

### Plugins de Capacitor Necesarios

```bash
# Instalación de plugins
npm install @capacitor/camera @capacitor/filesystem @capacitor/preferences
npm install @capacitor/splash-screen @capacitor/status-bar
npm install @capacitor/app @capacitor/haptics

# Sincronizar con proyectos nativos
npx cap sync
```

---

## Flujo de la Aplicación Móvil

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Cap as Capacitor
    participant API as FastAPI Backend
    participant AI as Ollama
    
    User->>App: Abre la app
    App->>Cap: Cargar preferencias guardadas
    Cap-->>App: Configuración offline
    
    alt Escanear con Cámara
        User->>App: Toca "Escanear"
        App->>Cap: Camera.getPhoto()
        Cap-->>App: Imagen capturada (Base64)
        App->>API: POST /upload (imagen)
        API->>AI: OCR + Clasificación
        AI-->>API: Productos extraídos
        API-->>App: Lista de productos
        App->>Cap: Guardar en cache local
    end
    
    alt Subir Archivo
        User->>App: Selecciona PDF/Excel
        App->>Cap: FilePicker.pickFiles()
        Cap-->>App: Archivo seleccionado
        App->>API: POST /upload (archivo)
        API-->>App: Productos procesados
    end
    
    alt Modo Offline
        User->>App: Sin conexión
        App->>Cap: Leer de Preferences
        Cap-->>App: Datos cacheados
        App-->>User: Mostrar última sincronización
    end
```

---

## Hooks de Capacitor

### useCamera.ts

```typescript
// frontend/src/hooks/useCamera.ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useState } from 'react';

export function useCamera() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takePhoto = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      
      return photo.base64String;
    } catch (err) {
      setError('No se pudo acceder a la cámara');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const pickFromGallery = async () => {
    setIsLoading(true);
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
      });
      return photo.base64String;
    } catch (err) {
      setError('No se pudo seleccionar imagen');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { takePhoto, pickFromGallery, isLoading, error };
}
```

### useOfflineSync.ts

```typescript
// frontend/src/hooks/useOfflineSync.ts
import { Preferences } from '@capacitor/preferences';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const CACHE_KEY = 'iris_offline_data';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveToOffline = async (key: string, data: any) => {
    const cache = await getOfflineData();
    cache[key] = { data, timestamp: Date.now() };
    await Preferences.set({
      key: CACHE_KEY,
      value: JSON.stringify(cache),
    });
  };

  const getOfflineData = async () => {
    const { value } = await Preferences.get({ key: CACHE_KEY });
    return value ? JSON.parse(value) : {};
  };

  const loadFromOffline = async (key: string) => {
    const cache = await getOfflineData();
    return cache[key]?.data || null;
  };

  return { isOnline, saveToOffline, loadFromOffline };
}
```

---

## Cliente API con Manejo Offline

```typescript
// frontend/src/services/api.ts
import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token JWT
api.interceptors.request.use(async (config) => {
  const { value: token } = await Preferences.get({ key: 'auth_token' });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de red
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      // Sin conexión - intentar cargar de cache
      console.warn('Offline mode: loading from cache');
      throw new Error('OFFLINE');
    }
    throw error;
  }
);
```

---

## Comandos de Desarrollo

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor de desarrollo
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Web)

> [!TIP]
> Usamos **pnpm** en vez de npm por ser más rápido (~2x) y eficiente en disco (usa enlaces simbólicos).

```bash
cd frontend

# Instalar pnpm globalmente (si no está instalado)
npm install -g pnpm

# Instalar dependencias
pnpm install

# Desarrollo web (hot reload)
pnpm dev

# Build para producción
pnpm build
```

### Frontend (Android)

```bash
cd frontend

# Build web primero
pnpm build

# Sincronizar con Android
pnpm exec cap sync android

# Abrir en Android Studio
pnpm exec cap open android

# O ejecutar directamente en dispositivo conectado
pnpm exec cap run android
```

### Frontend (iOS)

```bash
cd frontend

# Build web primero
pnpm build

# Sincronizar con iOS
pnpm exec cap sync ios

# Abrir en Xcode
pnpm exec cap open ios

# Requiere Mac con Xcode instalado
```

---

## Calidad de Código y Mejores Prácticas

### Principios de Código

| Principio | Implementación |
|-----------|----------------|
| **SOLID** | Separación de servicios, inyección de dependencias |
| **DRY** | Funciones utilitarias reutilizables, schemas compartidos |
| **Type Safety** | Pydantic en backend, TypeScript estricto en frontend |
| **Error Handling** | Excepciones personalizadas con códigos específicos |
| **Logging** | Logging estructurado con contexto (correlation IDs) |
| **Testing** | Cobertura mínima 80%, tests unitarios + integración |

### Linting y Formateo

```json
// frontend/package.json (scripts)
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "format": "prettier --write src/**/*.{ts,tsx}",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

### Patrones de Diseño Aplicados

> [!NOTE]
> Ver **[ARCHITECTURE.md](./ARCHITECTURE.md)** para código de referencia completo con comentarios, logging estructurado, y unit tests.

| Patrón | Uso | Principio SOLID |
|--------|-----|-----------------|
| **Repository** | Abstracción de BD | Dependency Inversion |
| **Strategy** | Extractores (PDF, Excel, OCR) | Open/Closed |
| **Chain of Responsibility** | AI → Fallback → Manual | Single Responsibility |
| **Factory** | Crear extractor por MIME | Open/Closed |
| **Dependency Injection** | FastAPI `Depends()` | Dependency Inversion |

### Reglas de Código

```python
# ❌ MAL: Print para debugging
print(f"Processing {filename}")

# ✅ BIEN: Logging estructurado
logger.info("processing_started", extra={"filename": filename})
```

```python
# ❌ MAL: Silenciar errores
try:
    result = process_file(file)
except:
    pass

# ✅ BIEN: Log y propagar o manejar
try:
    result = process_file(file)
except FileProcessingError as e:
    logger.error("file_processing_failed", extra={"error": str(e)})
    raise
```

---

## Manejo de Errores y Casos Extremos

### Estrategia de Fallback para IA

```mermaid
flowchart TD
    A[Solicitud de Clasificación] --> B{¿Ollama disponible?}
    B -->|Sí| C[Clasificar con IA]
    B -->|No| D[Fallback: Clasificación por Rangos]
    C --> E{¿Respuesta válida?}
    E -->|Sí| F[Retornar clasificación]
    E -->|No/Timeout| G[Reintentar 2 veces]
    G --> H{¿Éxito?}
    H -->|No| D
    H -->|Sí| F
    D --> I[Clasificar por rangos numéricos]
    I --> F
```

### Casos Extremos Manejados

```python
# backend/core/exceptions.py
class IrisException(Exception):
    """Base exception for all app errors"""
    def __init__(self, message: str, code: str, status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code

class FileProcessingError(IrisException):
    """Error al procesar archivo"""
    pass

class AIServiceUnavailable(IrisException):
    """Ollama no disponible - usar fallback"""
    pass

class InvalidPriceFormat(IrisException):
    """Precio no reconocible en el texto"""
    pass

class CatalogTooLarge(IrisException):
    """Catálogo excede límite de productos"""
    pass
```

| Caso Extremo | Solución |
|--------------|----------|
| PDF corrupto/protegido | Detectar y reportar error claro al usuario |
| Excel con fórmulas complejas | Evaluar fórmulas antes de extraer |
| Imagen borrosa/ilegible | Retornar confianza baja + solicitar re-upload |
| Precios en múltiples monedas | Detectar moneda y convertir (opcional) |
| Texto sin precios detectables | Marcar como "precio no encontrado" |
| Catálogo con 10,000+ productos | Procesar en chunks con progreso |
| Ollama no responde | Fallback a clasificación por rangos numéricos |
| Múltiples formatos de precio | Regex robusto: `$1,234.56`, `1.234,56€`, etc. |
| Sin conexión a internet | Mostrar datos cacheados localmente |
| Cámara no disponible | Ofrecer alternativa de subir archivo |
---

## ⚠️ Riesgos Identificados y Mitigaciones

### Matriz de Riesgos

| Riesgo | Impacto | Probabilidad | Mitigación | Estado |
|--------|---------|--------------|------------|--------|
| Cuello de botella IA (Ollama) | 🔴 Alto | 🟡 Media | Cola asíncrona + Workers | ⬜ Por implementar |
| Rendimiento listas largas móvil | 🟡 Medio | 🔴 Alta | Virtualización de listas | ⬜ Por implementar |
| Precisión OCR/Extracción variable | 🟡 Medio | 🔴 Alta | Pipeline OCR mejorado | ⬜ Por implementar |

---

### 🔴 Riesgo 1: Cuello de Botella en la IA (Ollama)

**Problema Identificado**:
Los modelos `llama3.2` o `mistral` son eficientes pero la inferencia de LLMs es intensiva en CPU/GPU. Si 50 usuarios suben catálogos simultáneamente, la cola de inferencia podría saturarse, causando timeouts (configurados a 60s actualmente).

**Impacto**: Timeouts masivos, mala UX, posible pérdida de datos de procesamiento.

**Mitigación: Cola de Trabajadores Asíncronos**

```mermaid
flowchart LR
    subgraph API["🌐 API (FastAPI)"]
        Upload[POST /upload]
        Status[GET /status]
    end
    
    subgraph Queue["📬 Cola de Tareas"]
        Redis[(Redis/RabbitMQ)]
        ARQ[ARQ/Celery Workers]
    end
    
    subgraph Processing["⚙️ Workers"]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker N...]
        Ollama[Ollama LLM]
    end
    
    Upload -->|"202 Accepted"| Redis
    Redis --> ARQ
    ARQ --> W1 & W2 & W3
    W1 & W2 & W3 --> Ollama
    Status -->|Polling/WebSocket| Redis
```

**Implementación Recomendada con ARQ**:

```python
# backend/workers/tasks.py
"""
Async task queue for CPU-intensive operations.
Uses ARQ (async Redis queue) for non-blocking processing.
"""
import asyncio
import logging
from arq import create_pool
from arq.connections import RedisSettings

from services.extraction_service import ExtractionService
from services.classification_service import ClassificationService
from database.connection import get_db_session

logger = logging.getLogger(__name__)


async def process_catalog_task(
    ctx: dict,
    catalog_id: int,
    file_content: bytes,
    mime_type: str
) -> dict:
    """
    Background task to process uploaded catalog.
    
    This runs in a separate worker process, not blocking the API.
    
    Args:
        ctx: ARQ context with Redis connection.
        catalog_id: ID of the catalog to process.
        file_content: Raw file bytes.
        mime_type: MIME type of the file.
    
    Returns:
        Dict with processing results and statistics.
    """
    logger.info(
        "catalog_processing_started",
        extra={"catalog_id": catalog_id, "mime_type": mime_type}
    )
    
    async with get_db_session() as db:
        try:
            # Update status to processing
            await update_catalog_status(db, catalog_id, "processing")
            
            # Extract products
            extraction_service = ExtractionService()
            products = await extraction_service.extract(file_content, mime_type)
            
            # Notify progress via Redis pub/sub
            await ctx["redis"].publish(
                f"catalog:{catalog_id}:progress",
                {"stage": "extraction", "count": len(products)}
            )
            
            # Classify products
            classification_service = ClassificationService()
            results = await classification_service.classify_products(products)
            
            # Save to database
            await save_products(db, catalog_id, results)
            await update_catalog_status(db, catalog_id, "completed")
            
            return {
                "catalog_id": catalog_id,
                "products_extracted": len(products),
                "products_classified": len(results),
                "status": "completed"
            }
            
        except Exception as e:
            logger.error(
                "catalog_processing_failed",
                extra={"catalog_id": catalog_id, "error": str(e)},
                exc_info=True
            )
            await update_catalog_status(db, catalog_id, "failed", str(e))
            raise


class WorkerSettings:
    """ARQ worker configuration."""
    
    redis_settings = RedisSettings(
        host='localhost',
        port=6379,
        database=1
    )
    
    functions = [process_catalog_task]
    
    # Number of concurrent jobs per worker
    max_jobs = 5
    
    # Job timeout (seconds)
    job_timeout = 300  # 5 minutes max per catalog
    
    # Retry failed jobs
    max_tries = 3
    retry_delay = 60  # 1 minute between retries
```

**API modificada para respuesta inmediata**:

```python
# backend/api/v1/routers/upload.py
from arq import create_pool
from fastapi import APIRouter, UploadFile, BackgroundTasks

router = APIRouter()


@router.post("/upload", status_code=202)
async def upload_catalog(
    file: UploadFile,
    name: str = None,
):
    """
    Upload a catalog for processing.
    
    Returns immediately with 202 Accepted.
    Processing happens in background workers.
    """
    # Validate file
    content = await validate_and_read_file(file)
    mime_type = magic.from_buffer(content, mime=True)
    
    # Create catalog record
    catalog = await create_catalog(
        name=name or file.filename,
        source_file=file.filename,
        file_type=mime_type,
        status="pending"
    )
    
    # Queue for background processing
    redis = await create_pool(RedisSettings())
    await redis.enqueue_job(
        "process_catalog_task",
        catalog.id,
        content,
        mime_type
    )
    
    return {
        "id": catalog.id,
        "name": catalog.name,
        "status": "pending",
        "message": "Catalog upload accepted. Processing started.",
        "status_url": f"/api/v1/catalogs/{catalog.id}/status"
    }
```

**Comunicación en tiempo real con WebSocket**:

```python
# backend/api/v1/routers/websocket.py
from fastapi import APIRouter, WebSocket
import aioredis

router = APIRouter()


@router.websocket("/ws/catalog/{catalog_id}")
async def catalog_progress(websocket: WebSocket, catalog_id: int):
    """
    WebSocket endpoint for real-time processing updates.
    
    Client connects and receives progress events:
    - {"stage": "extraction", "count": 150}
    - {"stage": "classification", "progress": 50, "total": 150}
    - {"stage": "completed", "products": 150}
    """
    await websocket.accept()
    
    redis = await aioredis.from_url("redis://localhost")
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"catalog:{catalog_id}:progress")
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_json(message["data"])
    except Exception:
        pass
    finally:
        await pubsub.unsubscribe()
        await redis.close()
```

---

### 🟡 Riesgo 2: Rendimiento de Listas Largas en Móvil

**Problema Identificado**:
Renderizar miles de productos en una vista web (WebView de Capacitor) puede ser lento comparado con nativo. Aunque se implementa paginación, el scroll y renderizado de listas grandes causa:
- Lag en el scroll
- Alto uso de memoria
- Jank visual (frames perdidos)

**Impacto**: UX pobre en dispositivos móviles de gama baja/media.

**Mitigación: Virtualización de Listas**

La virtualización renderiza SOLO los elementos visibles en pantalla, reduciendo el DOM de miles de nodos a ~20-30.

```mermaid
flowchart TB
    subgraph Traditional["❌ Sin Virtualización"]
        DOM1[DOM: 5000 elementos]
        Memory1[RAM: 200MB+]
        FPS1[FPS: 15-30]
    end
    
    subgraph Virtualized["✅ Con Virtualización"]
        DOM2[DOM: 20-30 elementos]
        Memory2[RAM: 30MB]
        FPS2[FPS: 60]
    end
    
    Traditional -.->|"react-window"| Virtualized
```

**Implementación con @tanstack/react-virtual**:

```typescript
// frontend/src/components/VirtualizedProductList.tsx
/**
 * Virtualized product list for smooth scrolling on mobile.
 * 
 * Only renders visible items, dramatically improving performance
 * with thousands of products.
 */
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, memo } from 'react';
import { ProductCard } from './ProductCard';
import type { Product } from '../types';

interface VirtualizedProductListProps {
  products: Product[];
  onProductClick: (product: Product) => void;
}

export const VirtualizedProductList = memo(function VirtualizedProductList({
  products,
  onProductClick,
}: VirtualizedProductListProps) {
  // Reference to scrollable container
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Setup virtualizer
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });
  
  const virtualItems = virtualizer.getVirtualItems();
  
  return (
    <div
      ref={parentRef}
      className="product-list-container"
      style={{
        height: '100%',
        overflow: 'auto',
        // Enable momentum scrolling on iOS
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Spacer to maintain scroll height */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Only render visible items */}
        {virtualItems.map((virtualItem) => {
          const product = products[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ProductCard
                product={product}
                onClick={() => onProductClick(product)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
```

**Configuración de Performance Config actualizada**:

```typescript
// frontend/src/config/performance.ts
export const PERFORMANCE_CONFIG = {
  // ... existing config
  
  /** Enable list virtualization for mobile optimization */
  VIRTUALIZATION_ENABLED: true,
  
  /** Minimum items before enabling virtualization */
  VIRTUALIZATION_THRESHOLD: 50,
  
  /** Items to render beyond visible viewport */
  VIRTUALIZATION_OVERSCAN: 5,
  
  /** Estimated row height for virtualization */
  ESTIMATED_ROW_HEIGHT: 80,
} as const;
```

**Hook para detección automática**:

```typescript
// frontend/src/hooks/useShouldVirtualize.ts
import { useMemo } from 'react';
import { PERFORMANCE_CONFIG } from '../config/performance';

/**
 * Determines if list virtualization should be enabled.
 * 
 * Considers item count, device capabilities, and configuration.
 */
export function useShouldVirtualize(itemCount: number): boolean {
  return useMemo(() => {
    if (!PERFORMANCE_CONFIG.VIRTUALIZATION_ENABLED) {
      return false;
    }
    
    // Always virtualize on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      return itemCount > 20;
    }
    
    // On desktop, virtualize for larger lists
    return itemCount > PERFORMANCE_CONFIG.VIRTUALIZATION_THRESHOLD;
  }, [itemCount]);
}
```

---

### 🟡 Riesgo 3: Precisión del OCR/Extracción Variable

**Problema Identificado**:
El `PDFExtractor` usa heurísticas (regex para precios, detección de columnas). Los catálogos varían enormemente en formato:
- PDFs que son "imágenes pegadas" (escaneados) fallan con pdfplumber
- Tablas complejas con celdas fusionadas
- Múltiples idiomas y formatos de moneda
- Layout no estructurado (sin tablas claras)

**Impacto**: Extracción fallida o imprecisa → clasificación incorrecta → frustración del usuario.

**Mitigación: Pipeline de Extracción Robusto con Fallback Múltiple**

```mermaid
flowchart TD
    A[Archivo Recibido] --> B{¿Tipo de archivo?}
    
    B -->|PDF| C[pdfplumber: Extraer texto/tablas]
    B -->|Excel| D[pandas: Parse directo]
    B -->|Imagen| E[OCR Pipeline]
    
    C --> F{¿Texto extraído?}
    F -->|Sí, con tablas| G[Parser de Tablas]
    F -->|Sí, solo texto| H[Regex Extractor]
    F -->|No/Mínimo| I[PDF es imagen escaneada]
    
    I --> J[Convertir PDF a imágenes]
    J --> E
    
    E --> K[Tesseract OCR]
    K --> L{¿Calidad suficiente?}
    L -->|Sí| H
    L -->|No| M[Preprocesamiento de imagen]
    M --> N[OCR con configuración especial]
    N --> O{¿Mejor resultado?}
    O -->|Sí| H
    O -->|No| P[Marcar para revisión manual]
    
    G --> Q[Productos Extraídos]
    H --> Q
    D --> Q
    P --> R[Notificar usuario: calidad baja]
```

**Implementación del Pipeline Mejorado**:

```python
# backend/services/extractors/extraction_pipeline.py
"""
Robust extraction pipeline with multiple fallback strategies.

Handles various document types and quality levels automatically.
"""
import io
import logging
from typing import List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

import pdfplumber
import pdf2image
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

from .base import BaseExtractor, RawProduct

logger = logging.getLogger(__name__)


class ExtractionMethod(Enum):
    """Extraction method used for tracking and confidence scoring."""
    PDF_TABLES = "pdf_tables"
    PDF_TEXT = "pdf_text"
    OCR_DIRECT = "ocr_direct"
    OCR_ENHANCED = "ocr_enhanced"
    FAILED = "failed"


@dataclass
class ExtractionResult:
    """Result of extraction with metadata."""
    products: List[RawProduct]
    method: ExtractionMethod
    confidence: float
    warnings: List[str]


class RobustPDFExtractor(BaseExtractor):
    """
    Multi-strategy PDF extractor with automatic fallback.
    
    Tries extraction in order of preference:
    1. Native text/table extraction (fastest, most accurate)
    2. OCR on full document
    3. OCR with image enhancement
    4. Manual review flag
    """
    
    # Minimum text characters to consider PDF as having extractable text
    MIN_TEXT_THRESHOLD = 100
    
    # Minimum confidence for OCR results
    MIN_OCR_CONFIDENCE = 60.0
    
    def supports(self, mime_type: str) -> bool:
        return mime_type == 'application/pdf'
    
    async def extract(self, content: bytes) -> List[RawProduct]:
        """Extract products using the most appropriate method."""
        result = await self._extract_with_fallback(content)
        
        if result.warnings:
            for warning in result.warnings:
                logger.warning(
                    "extraction_warning",
                    extra={"warning": warning, "method": result.method.value}
                )
        
        logger.info(
            "extraction_completed",
            extra={
                "method": result.method.value,
                "product_count": len(result.products),
                "confidence": result.confidence,
            }
        )
        
        return result.products
    
    async def _extract_with_fallback(self, content: bytes) -> ExtractionResult:
        """
        Try extraction methods in order of preference.
        
        Falls back automatically if primary method fails.
        """
        warnings = []
        
        # Strategy 1: Native PDF text extraction
        native_result = await self._try_native_extraction(content)
        if native_result and len(native_result) > 0:
            return ExtractionResult(
                products=native_result,
                method=ExtractionMethod.PDF_TABLES,
                confidence=0.95,
                warnings=[]
            )
        
        warnings.append("Native PDF extraction yielded no results, trying OCR")
        
        # Strategy 2: Convert to images and OCR
        images = self._pdf_to_images(content)
        if not images:
            return ExtractionResult(
                products=[],
                method=ExtractionMethod.FAILED,
                confidence=0.0,
                warnings=["Could not convert PDF to images"]
            )
        
        # Strategy 3: Direct OCR
        ocr_result, ocr_conf = await self._try_ocr(images)
        if ocr_conf >= self.MIN_OCR_CONFIDENCE:
            return ExtractionResult(
                products=ocr_result,
                method=ExtractionMethod.OCR_DIRECT,
                confidence=ocr_conf / 100,
                warnings=warnings
            )
        
        warnings.append(f"OCR confidence low ({ocr_conf:.1f}%), trying enhancement")
        
        # Strategy 4: Enhanced OCR (preprocessing)
        enhanced_images = [self._enhance_image(img) for img in images]
        enhanced_result, enhanced_conf = await self._try_ocr(enhanced_images)
        
        if enhanced_conf > ocr_conf:
            return ExtractionResult(
                products=enhanced_result,
                method=ExtractionMethod.OCR_ENHANCED,
                confidence=enhanced_conf / 100,
                warnings=warnings
            )
        
        # Use best available result
        best_result = enhanced_result if enhanced_conf > ocr_conf else ocr_result
        best_conf = max(enhanced_conf, ocr_conf)
        
        if best_conf < 40:
            warnings.append("Low confidence extraction - manual review recommended")
        
        return ExtractionResult(
            products=best_result,
            method=ExtractionMethod.OCR_ENHANCED,
            confidence=best_conf / 100,
            warnings=warnings
        )
    
    async def _try_native_extraction(
        self, 
        content: bytes
    ) -> Optional[List[RawProduct]]:
        """Attempt native PDF text/table extraction."""
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                all_text = ""
                products = []
                
                for page in pdf.pages:
                    # Try tables first
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            products.extend(self._parse_table(table))
                    
                    # Also extract text
                    text = page.extract_text() or ""
                    all_text += text
                
                # If we got products from tables, return them
                if products:
                    return products
                
                # If enough text exists, parse it
                if len(all_text) > self.MIN_TEXT_THRESHOLD:
                    return self._parse_text(all_text)
                
                return None
                
        except Exception as e:
            logger.debug(f"Native extraction failed: {e}")
            return None
    
    def _pdf_to_images(self, content: bytes) -> List[Image.Image]:
        """Convert PDF pages to images for OCR."""
        try:
            return pdf2image.convert_from_bytes(
                content,
                dpi=300,  # Higher DPI for better OCR
                fmt='png'
            )
        except Exception as e:
            logger.error(f"PDF to image conversion failed: {e}")
            return []
    
    async def _try_ocr(
        self, 
        images: List[Image.Image]
    ) -> Tuple[List[RawProduct], float]:
        """
        Perform OCR on images with confidence scoring.
        
        Returns products and average confidence score.
        """
        all_text = ""
        total_confidence = 0.0
        
        for img in images:
            # Get OCR data with confidence
            data = pytesseract.image_to_data(
                img, 
                output_type=pytesseract.Output.DICT,
                lang='spa+eng',  # Spanish + English
                config='--psm 6'  # Assume uniform text block
            )
            
            # Calculate page confidence
            confidences = [
                int(c) for c in data['conf'] 
                if str(c).isdigit() and int(c) > 0
            ]
            if confidences:
                page_conf = sum(confidences) / len(confidences)
                total_confidence += page_conf
            
            # Get text
            all_text += pytesseract.image_to_string(
                img, 
                lang='spa+eng',
                config='--psm 6'
            )
        
        avg_confidence = total_confidence / len(images) if images else 0
        products = self._parse_text(all_text) if all_text else []
        
        return products, avg_confidence
    
    def _enhance_image(self, image: Image.Image) -> Image.Image:
        """
        Apply image preprocessing to improve OCR accuracy.
        
        Techniques:
        - Convert to grayscale
        - Increase contrast
        - Apply sharpening
        - Denoise
        - Binarization
        """
        # Convert to grayscale
        img = image.convert('L')
        
        # Increase contrast
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        
        # Sharpen
        img = img.filter(ImageFilter.SHARPEN)
        
        # Denoise with median filter
        img = img.filter(ImageFilter.MedianFilter(size=3))
        
        # Binarization (Otsu-like threshold)
        img_array = np.array(img)
        threshold = np.mean(img_array)
        binary = ((img_array > threshold) * 255).astype(np.uint8)
        
        return Image.fromarray(binary)
    
    def _parse_table(self, table: List[List[str]]) -> List[RawProduct]:
        """Parse extracted table into products."""
        # Implementation from existing PDFExtractor
        # ...
        pass
    
    def _parse_text(self, text: str) -> List[RawProduct]:
        """Parse raw text into products using regex."""
        # Implementation from existing PDFExtractor
        # ...
        pass
```

**Dependencias adicionales**:

```txt
# backend/requirements.txt (additions)
pdf2image>=1.16.3
pytesseract>=0.3.10
Pillow>=10.0.0
numpy>=1.24.0
```

**Métricas de calidad de extracción**:

```python
# backend/api/v1/schemas/catalog.py
from pydantic import BaseModel
from typing import Optional, List


class ExtractionQuality(BaseModel):
    """Quality metrics for extraction result."""
    method: str  # 'pdf_tables', 'pdf_text', 'ocr_direct', 'ocr_enhanced'
    confidence: float  # 0.0 - 1.0
    products_extracted: int
    warnings: List[str]
    needs_review: bool  # True if confidence < 0.6


class CatalogProcessingResult(BaseModel):
    """Complete processing result with quality info."""
    catalog_id: int
    status: str
    extraction_quality: ExtractionQuality
    products_classified: int
    processing_time_seconds: float
```

---

### Próximos Pasos para Mitigación

| Riesgo | Prioridad | Esfuerzo | Dependencias |
|--------|-----------|----------|--------------|
| Cola asíncrona (ARQ/Celery) | 🔴 Alta | 2-3 días | Redis |
| Virtualización de listas | 🟡 Media | 1 día | @tanstack/react-virtual |
| Pipeline OCR mejorado | 🟡 Media | 2 días | pdf2image, Tesseract |

---

## Optimizaciones de Rendimiento

### 1. Memoización y Caché

```python
# backend/services/cache_service.py
from functools import lru_cache
from typing import Optional
import hashlib
import json

class CacheService:
    """Caché en memoria con LRU para resultados de IA"""
    
    def __init__(self, max_size: int = 1000):
        self._cache: dict = {}
        self._max_size = max_size
    
    def get_cache_key(self, text: str, ranges: list) -> str:
        """Genera key única basada en contenido"""
        content = f"{text}:{json.dumps(ranges, sort_keys=True)}"
        return hashlib.md5(content.encode()).hexdigest()
    
    @lru_cache(maxsize=500)
    def classify_cached(self, text_hash: str) -> Optional[str]:
        """Clasificación memoizada por hash de texto"""
        return self._cache.get(text_hash)
```

**Mejora esperada**: 
- ⚡ **90% reducción** en llamadas a Ollama para productos repetidos
- 💾 **Trade-off**: ~50MB memoria adicional para 1000 entradas cacheadas

### 2. Procesamiento en Batch

```python
# backend/services/ai_classifier.py
async def classify_batch(
    products: list[str], 
    batch_size: int = 20
) -> list[str]:
    """
    Procesa productos en batches para reducir overhead de IA.
    
    Mejora: 5x más rápido que clasificación individual
    Trade-off: Latencia inicial más alta (esperar batch completo)
    """
    results = []
    for i in range(0, len(products), batch_size):
        batch = products[i:i + batch_size]
        prompt = format_batch_prompt(batch)
        response = await ollama_client.generate(prompt)
        results.extend(parse_batch_response(response))
    return results
```

### 3. React Query para Caché Frontend

```typescript
// frontend/src/hooks/useProducts.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useProducts(catalogId: number) {
  return useInfiniteQuery({
    queryKey: ['products', catalogId],
    queryFn: ({ pageParam = 0 }) => 
      api.get(`/products`, { 
        params: { catalog_id: catalogId, offset: pageParam, limit: 50 } 
      }).then(r => r.data),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000,   // 30 minutos en cache
  });
}
```

### Resumen de Optimizaciones

| Técnica | Mejora Esperada | Trade-off |
|---------|-----------------|-----------|
| **LRU Cache IA** | 90% menos llamadas | +50MB RAM |
| **Batch Processing** | 5x más rápido | Mayor latencia inicial |
| **Connection Pooling** | 3x más requests/seg | Complejidad de config |
| **React Query Cache** | 70% menos requests | Datos potencialmente stale |
| **Índices Compuestos** | 10-100x queries rápidas | Writes 20% más lentos |
| **Compresión GZIP** | 60% menos bandwidth | CPU overhead mínimo |
| **Capacitor Preferences** | Offline instantáneo | Límite de almacenamiento |

---

## Seguridad

### Validación y Sanitización

```python
# backend/core/security.py
from fastapi import UploadFile, HTTPException
import magic  # python-magic para detección MIME real

ALLOWED_MIME_TYPES = {
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/jpeg',
    'image/png',
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

async def validate_upload(file: UploadFile) -> bytes:
    """Valida archivo antes de procesar"""
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "Archivo excede 50MB")
    
    mime_type = magic.from_buffer(content, mime=True)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(415, f"Tipo de archivo no permitido: {mime_type}")
    
    safe_filename = secure_filename(file.filename)
    return content
```

### Checklist de Seguridad

| Aspecto | Implementación |
|---------|----------------|
| **SQL Injection** | ORM (SQLAlchemy) con queries parametrizadas |
| **XSS** | Sanitización de HTML en respuestas |
| **CSRF** | Tokens JWT (no cookies de sesión) |
| **File Upload** | Validación MIME real + límite tamaño |
| **Rate Limiting** | slowapi con límites por IP |
| **CORS** | Whitelist de orígenes (incluyendo capacitor://) |
| **Secrets** | Variables de entorno, nunca en código |
| **HTTPS** | Obligatorio en producción |
| **App Transport Security** | Configurado en iOS Info.plist |

### CORS para Capacitor

```python
# backend/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",     # Vite dev
        "http://localhost:8100",     # Capacitor dev
        "capacitor://localhost",     # iOS Capacitor
        "http://localhost",          # Android Capacitor
        "https://your-domain.com",   # Producción web
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## CI/CD Pipeline

### Arquitectura del Pipeline

```mermaid
flowchart LR
    subgraph Trigger["🔔 Triggers"]
        Push[Push to main/develop]
        PR[Pull Request]
        Tag[Release Tag]
    end
    
    subgraph CI["🔍 Continuous Integration"]
        Lint[Lint & Format]
        Test[Unit Tests]
        Build[Build]
        Security[Security Scan]
    end
    
    subgraph CD["🚀 Continuous Deployment"]
        Staging[Deploy Staging]
        E2E[E2E Tests]
        Prod[Deploy Production]
    end
    
    Push --> Lint
    PR --> Lint
    Lint --> Test
    Test --> Build
    Build --> Security
    Security --> Staging
    Staging --> E2E
    Tag --> Prod
```

### GitHub Actions Workflows

#### Backend CI/CD

```yaml
# .github/workflows/backend.yml
name: Backend CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - '.github/workflows/backend.yml'
  pull_request:
    branches: [main]
    paths:
      - 'backend/**'

env:
  PYTHON_VERSION: '3.11'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/backend

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          pip install ruff black mypy
          pip install -r backend/requirements.txt
      
      - name: Run Ruff linter
        run: ruff check backend/
      
      - name: Check Black formatting
        run: black --check backend/
      
      - name: Run MyPy type checking
        run: mypy backend/ --ignore-missing-imports

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: iris_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}
          cache: 'pip'
      
      - name: Install dependencies
        run: pip install -r backend/requirements.txt
      
      - name: Run tests with coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/iris_test
        run: |
          cd backend
          pytest tests/ -v --cov=. --cov-report=xml --cov-report=html
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: backend/coverage.xml
          flags: backend

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Bandit security scan
        run: |
          pip install bandit
          bandit -r backend/ -ll -ii
      
      - name: Run Safety dependency check
        run: |
          pip install safety
          safety check -r backend/requirements.txt

  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [test, security]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    environment: staging
    
    steps:
      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/iris-classifier
            docker compose pull
            docker compose up -d --remove-orphans
            docker system prune -f
```

#### Frontend CI/CD

```yaml
# .github/workflows/frontend.yml
name: Frontend CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend.yml'
  pull_request:
    branches: [main]
    paths:
      - 'frontend/**'

env:
  NODE_VERSION: '20'

jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml
      
      - name: Install dependencies
        run: |
          cd frontend
          pnpm install --frozen-lockfile
      
      - name: Run ESLint
        run: |
          cd frontend
          pnpm lint
      
      - name: Run TypeScript check
        run: |
          cd frontend
          pnpm type-check
      
      - name: Run unit tests
        run: |
          cd frontend
          pnpm test:coverage

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: lint-and-test
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml
      
      - name: Install dependencies
        run: |
          cd frontend
          pnpm install --frozen-lockfile
      
      - name: Build for production
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
        run: |
          cd frontend
          pnpm build
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist/
          retention-days: 7

  deploy-web:
    name: Deploy Web (Vercel/Netlify)
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: frontend/dist/
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
```

#### Mobile Build Pipeline

```yaml
# .github/workflows/mobile.yml
name: Mobile Build

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      platform:
        description: 'Platform to build'
        required: true
        default: 'both'
        type: choice
        options:
          - android
          - ios
          - both

jobs:
  build-android:
    name: Build Android APK
    runs-on: ubuntu-latest
    if: >
      github.event_name == 'release' || 
      github.event.inputs.platform == 'android' || 
      github.event.inputs.platform == 'both'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml
      
      - name: Install dependencies and build
        run: |
          cd frontend
          pnpm install --frozen-lockfile
          pnpm build
          pnpm exec cap sync android
      
      - name: Build APK
        run: |
          cd frontend/android
          ./gradlew assembleRelease
      
      - name: Sign APK
        uses: r0adkll/sign-android-release@v1
        with:
          releaseDirectory: frontend/android/app/build/outputs/apk/release
          signingKeyBase64: ${{ secrets.ANDROID_SIGNING_KEY }}
          alias: ${{ secrets.ANDROID_KEY_ALIAS }}
          keyStorePassword: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          keyPassword: ${{ secrets.ANDROID_KEY_PASSWORD }}
      
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: android-release-apk
          path: frontend/android/app/build/outputs/apk/release/*.apk

  build-ios:
    name: Build iOS IPA
    runs-on: macos-latest
    if: >
      github.event_name == 'release' || 
      github.event.inputs.platform == 'ios' || 
      github.event.inputs.platform == 'both'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: frontend/pnpm-lock.yaml
      
      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      
      - name: Install dependencies and build
        run: |
          cd frontend
          pnpm install --frozen-lockfile
          pnpm build
          pnpm exec cap sync ios
      
      - name: Install CocoaPods
        run: |
          cd frontend/ios/App
          pod install
      
      - name: Build iOS App
        run: |
          cd frontend/ios/App
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath build/App.xcarchive \
            archive \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO
```

### Variables y Secretos Requeridos

| Secreto | Uso | Dónde obtener |
|---------|-----|---------------|
| `STAGING_HOST` | IP del servidor staging | Tu proveedor de hosting |
| `STAGING_USER` | Usuario SSH | Configuración del servidor |
| `STAGING_SSH_KEY` | Clave SSH privada | `ssh-keygen -t ed25519` |
| `VERCEL_TOKEN` | Deploy frontend | Vercel Dashboard → Settings |
| `ANDROID_SIGNING_KEY` | Firmar APK | `keytool`, codificado en base64 |
| `CODECOV_TOKEN` | Reporte de cobertura | codecov.io |

### Entornos de Deployment

| Entorno | URL | Trigger | Auto-deploy |
|---------|-----|---------|-------------|
| **Development** | localhost | Manual | N/A |
| **Staging** | staging.irisclassifier.com | Push to `main` | ✅ |
| **Production** | irisclassifier.com | Release tag | ✅ |

---

## Esquema de Base de Datos Completo

### Sistema de Base de Datos Recomendado

- **Desarrollo**: SQLite (simplicidad)
- **Producción**: PostgreSQL (rendimiento, concurrencia, JSON support)

### Diagrama ER Completo

```mermaid
erDiagram
    USER ||--o{ CATALOG : owns
    USER ||--o{ PRICE_RANGE : configures
    CATALOG ||--o{ PRODUCT : contains
    CATALOG ||--o{ PROCESSING_LOG : has
    PRODUCT }o--|| PRICE_RANGE : classified_as
    PRODUCT ||--o{ PRODUCT_TAG : has
    TAG ||--o{ PRODUCT_TAG : used_in
    CATEGORY ||--o{ PRODUCT : groups
    
    USER {
        int id PK
        string email UK
        string password_hash
        datetime created_at
        datetime last_login
        boolean is_active
    }
    
    CATALOG {
        int id PK
        int user_id FK
        string name
        string source_file
        string file_type
        int file_size_bytes
        string status
        datetime created_at
        datetime processed_at
        int product_count
    }
    
    PRODUCT {
        int id PK
        int catalog_id FK
        int category_id FK
        int price_range_id FK
        string name
        decimal price
        string currency
        string original_text
        float confidence_score
        string classification_method
        datetime created_at
        datetime updated_at
    }
    
    PRICE_RANGE {
        int id PK
        int user_id FK
        string name
        decimal min_price
        decimal max_price
        string color
        int display_order
        boolean is_default
        datetime created_at
    }
    
    CATEGORY {
        int id PK
        int user_id FK
        string name
        string description
        int parent_id FK
    }
    
    TAG {
        int id PK
        string name UK
    }
    
    PRODUCT_TAG {
        int product_id PK_FK
        int tag_id PK_FK
    }
    
    PROCESSING_LOG {
        int id PK
        int catalog_id FK
        string status
        string error_message
        int products_extracted
        int products_classified
        float processing_time_seconds
        datetime created_at
    }
```

### DDL - Definición de Tablas (PostgreSQL)

```sql
-- Tabla de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_users_email ON users(email);

-- Tabla de catálogos
CREATE TABLE catalogs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_file VARCHAR(500),
    file_type VARCHAR(50),
    file_size_bytes INTEGER,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    product_count INTEGER DEFAULT 0
);

CREATE INDEX idx_catalogs_user_id ON catalogs(user_id);
CREATE INDEX idx_catalogs_status ON catalogs(status);
CREATE INDEX idx_catalogs_created ON catalogs(created_at DESC);

-- Tabla de rangos de precio (ILIMITADOS por usuario)
CREATE TABLE price_ranges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    min_price DECIMAL(15, 2),
    max_price DECIMAL(15, 2),
    color VARCHAR(7) DEFAULT '#808080',
    display_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_price_range CHECK (max_price >= min_price OR max_price IS NULL),
    CONSTRAINT uq_user_range_name UNIQUE (user_id, name)
);

CREATE INDEX idx_price_ranges_user ON price_ranges(user_id, display_order);

-- Tabla de categorías (jerarquía)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- Tabla de productos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    catalog_id INTEGER NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    price_range_id INTEGER REFERENCES price_ranges(id) ON DELETE SET NULL,
    name VARCHAR(500) NOT NULL,
    price DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'USD',
    original_text TEXT,
    confidence_score REAL DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    classification_method VARCHAR(20) DEFAULT 'ai'
        CHECK (classification_method IN ('ai', 'fallback', 'manual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para productos (CRÍTICOS para rendimiento)
CREATE INDEX idx_products_catalog ON products(catalog_id);
CREATE INDEX idx_products_price_range ON products(price_range_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_name_search ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_products_catalog_price ON products(catalog_id, price);
CREATE INDEX idx_products_catalog_range ON products(catalog_id, price_range_id);

-- Tabla de tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- Tabla de unión productos-tags (N:M)
CREATE TABLE product_tags (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX idx_product_tags_tag ON product_tags(tag_id);

-- Tabla de logs de procesamiento
CREATE TABLE processing_logs (
    id SERIAL PRIMARY KEY,
    catalog_id INTEGER NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('started', 'extracting', 'classifying', 'completed', 'failed')),
    error_message TEXT,
    products_extracted INTEGER DEFAULT 0,
    products_classified INTEGER DEFAULT 0,
    processing_time_seconds REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_processing_logs_catalog ON processing_logs(catalog_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION update_catalog_product_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE catalogs SET product_count = product_count + 1 WHERE id = NEW.catalog_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE catalogs SET product_count = product_count - 1 WHERE id = OLD.catalog_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_product_count
    AFTER INSERT OR DELETE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_catalog_product_count();
```

### Análisis de Normalización

| Nivel | Estado | Comentario |
|-------|--------|------------|
| **1NF** | ✅ | Valores atómicos, sin grupos repetidos |
| **2NF** | ✅ | Sin dependencias parciales |
| **3NF** | ✅ | Sin dependencias transitivas |
| **BCNF** | ✅ | Cada determinante es clave candidata |

### Desnormalización Estratégica

| Campo | Tabla | Justificación | Trade-off |
|-------|-------|---------------|-----------|
| `product_count` | catalogs | Evita COUNT(*) en listados | Trigger mantiene sincronía |

---

## Estrategia de Indexación Óptima

### Resumen de Índices

| Índice | Tipo | Columnas | Para Consulta |
|--------|------|----------|---------------|
| `idx_products_catalog_price` | B-Tree | `(catalog_id, price)` | Filtrado + ordenamiento |
| `idx_products_price_range` | B-Tree | `(price_range_id)` | JOINs con rangos |
| `idx_products_name_search` | GIN | `(to_tsvector(name))` | Full-text search |
| `idx_products_created` | B-Tree | `(created_at DESC)` | Listados recientes |
| `idx_catalogs_user_id` | B-Tree | `(user_id)` | Filtro por usuario |
| `idx_catalogs_status` | B-Tree | `(status)` | Filtro por estado |

### Impacto en Escrituras

| Operación | Overhead con Índices | Aceptable? |
|-----------|---------------------|------------|
| INSERT producto | +20-30% | ✅ Sí, inserts menos frecuentes |
| UPDATE precio | +15% | ✅ Mínimo |
| DELETE producto | +10% | ✅ Mínimo |

---

## Soporte para Múltiples Rangos de Precio

### Flujo de Usuario

```mermaid
sequenceDiagram
    actor User
    participant UI as React App
    participant API as Backend
    participant DB as Database
    
    User->>UI: Abrir Configuración
    UI->>API: GET /api/v1/price-ranges
    API->>DB: SELECT * FROM price_ranges WHERE user_id = ?
    DB-->>API: Rangos actuales
    API-->>UI: Lista de rangos
    
    User->>UI: Crear nuevo rango "Premium"
    UI->>API: POST /api/v1/price-ranges
    Note over API: Validar: min < max, no overlap
    API->>DB: INSERT INTO price_ranges...
    DB-->>API: Nuevo rango creado
    API-->>UI: 201 Created
    
    User->>UI: Reclasificar productos
    UI->>API: POST /api/v1/catalogs/{id}/reclassify
    API->>DB: UPDATE products SET price_range_id = ...
    DB-->>API: Productos actualizados
    API-->>UI: Clasificación completada
```

### Rangos por Defecto

```sql
-- Insertar rangos por defecto para nuevos usuarios
INSERT INTO price_ranges (user_id, name, min_price, max_price, color, display_order, is_default)
VALUES 
    (NEW.id, 'Muy Barato', 0, 10, '#22c55e', 1, TRUE),
    (NEW.id, 'Barato', 10.01, 25, '#84cc16', 2, TRUE),
    (NEW.id, 'Mediano', 25.01, 50, '#eab308', 3, TRUE),
    (NEW.id, 'Caro', 50.01, 100, '#f97316', 4, TRUE),
    (NEW.id, 'Muy Caro', 100.01, NULL, '#ef4444', 5, TRUE);
```

---

## Verification Plan

### Automated Tests

```bash
# Backend tests (pytest)
cd backend
python -m pytest tests/ -v --cov=. --cov-report=html

# Tests específicos
python -m pytest tests/test_pdf_extractor.py -v
python -m pytest tests/test_ai_classifier.py -v -m "not slow"
python -m pytest tests/test_api/ -v

# Frontend tests (Vitest)
cd frontend
npm run test
npm run test:coverage
npm run build  # Verificar que compile sin errores
```

### Manual Verification

| # | Escenario | Pasos | Resultado Esperado |
|---|-----------|-------|-------------------|
| 1 | **Subida PDF (Web)** | Abrir app web, subir PDF | Productos extraídos |
| 2 | **Subida Excel (Web)** | Subir archivo .xlsx | Parseo correcto |
| 3 | **Cámara (Android)** | `npx cap run android`, escanear documento | Foto procesada |
| 4 | **Cámara (iOS)** | `npx cap run ios`, escanear documento | Foto procesada |
| 5 | **Clasificación IA** | Procesar catálogo con Ollama activo | Clasificación precisa |
| 6 | **Fallback** | Apagar Ollama, procesar catálogo | Clasificación por rangos |
| 7 | **Múltiples Rangos** | Crear 10 rangos en Settings | Todos se aplican |
| 8 | **Exportar** | Descargar Excel/PDF | Archivo válido |
| 9 | **Modo Offline** | Desconectar red, navegar app | Datos cacheados visibles |
| 10 | **Instalar como App** | Android: Generar APK, instalar | App funciona nativa |

---

## Requisitos del Sistema

| Componente | Requerimiento | Notas |
|------------|---------------|-------|
| **Python** | 3.10+ | 3.11 recomendado |
| **Node.js** | 18+ | Para frontend Vite |
| **PostgreSQL** | 14+ | Producción (SQLite para dev) |
| **Ollama** | Latest | Con modelo `llama3.2` |
| **Tesseract** | 4.0+ | Opcional, para OCR |
| **RAM** | 4GB+ | 8GB si usa Ollama local |
| **Android Studio** | Latest | Para compilar APK |
| **Xcode** | 14+ | Para compilar iOS (requiere Mac) |

---

## Próximos Pasos

1. ✅ Aprobar este plan actualizado
2. Inicializar proyecto Vite + React con TypeScript
3. Agregar Capacitor y configurar plugins
4. Crear estructura del backend FastAPI
5. Implementar base de datos con migraciones
6. Crear servicios de extracción (PDF/Excel/OCR)
7. Integrar con Ollama + fallback
8. Desarrollar componentes React (UI)
9. Implementar hooks de Capacitor (cámara, archivos)
10. Configurar sync offline
11. Generar builds nativos (Android/iOS)
12. Testing completo
13. Documentación de API

---

> [!TIP]
> **Desarrollo Recomendado**: Empieza desarrollando en web (`npm run dev`), luego prueba en Android (`npx cap run android`). iOS requiere Mac con Xcode.

> [!NOTE]
> **Backend Remoto**: Para que la app móvil funcione, el backend debe estar accesible. En desarrollo, usa tu IP local (ej: `http://192.168.1.100:8000`). En producción, despliega en un servidor con HTTPS.
