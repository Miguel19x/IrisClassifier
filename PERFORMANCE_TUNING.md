# IrisClassifier - Performance Tuning Guide

Guía de optimización de rendimiento para el sistema IrisClassifier.

---

## 1. Parámetros de Configuración

### Backend (FastAPI)

| Parámetro | Default | Recomendado | Impacto |
|-----------|---------|-------------|---------|
| `UVICORN_WORKERS` | 1 | CPU cores * 2 | 4x throughput |
| `DB_POOL_SIZE` | 5 | 20 | 3x consultas concurrentes |
| `DB_MAX_OVERFLOW` | 10 | 30 | Manejo de picos |
| `MAX_FILE_SIZE_MB` | 50 | 100 | Archivos más grandes |

### Gemini AI

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `GEMINI_REQUESTS_PER_MINUTE` | 10 | Rate limit (15 RPM free tier) |
| `GEMINI_RETRY_MAX_ATTEMPTS` | 3 | Reintentos en 429 |
| `GEMINI_RETRY_BASE_DELAY` | 2.0s | Base para backoff exponencial |

---

## 2. Rate Limiting de Gemini

### Estrategia de Backoff Exponencial

```
Intento 1: 2 segundos
Intento 2: 4 segundos  
Intento 3: 8 segundos
```

### Configuración en código

```python
class GeminiRateLimiter:
    def __init__(self):
        self.requests_per_minute = 10
        self.retry_max_attempts = 3
        self.retry_base_delay = 2.0
        
    async def execute_with_retry(self, func, *args):
        for attempt in range(self.retry_max_attempts):
            try:
                return await func(*args)
            except RateLimitError:
                delay = self.retry_base_delay * (2 ** attempt)
                await asyncio.sleep(delay)
        raise MaxRetriesExceeded()
```

---

## 3. Optimización de Base de Datos

### Índices Críticos

```sql
-- Master Products
CREATE INDEX idx_master_products_code ON master_products(clean_code);
CREATE INDEX idx_master_products_brand ON master_products(brand);
CREATE INDEX idx_master_products_review ON master_products(review_status);
CREATE INDEX idx_master_products_source ON master_products(source_list_id);

-- Code Registry
CREATE INDEX idx_code_registry_code ON code_registry(clean_code);

-- Products
CREATE INDEX idx_products_catalog ON products(list_id);
CREATE INDEX idx_products_price ON products(price);
```

### Pool de Conexiones

```python
engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
    pool_recycle=3600
)
```

---

## 4. Caché y Memoria

### TanStack Query (Frontend)

```typescript
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,    // 5 min
            cacheTime: 30 * 60 * 1000,   // 30 min
            refetchOnWindowFocus: false,
        },
    },
});
```

### Backend LRU Cache

```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_code_registry_entry(clean_code: str):
    return db.query(CodeRegistry).filter_by(clean_code=clean_code).first()
```

---

## 5. Procesamiento de Archivos

### PDF Optimizado (Gemini)

| Método | API Calls | Velocidad |
|--------|-----------|-----------|
| Tradicional (por página) | N | Lento |
| **Gemini Nativo** | **1** | **Rápido** |

```python
# 1 API call para todo el PDF
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[prompt, pdf_bytes],
    config=GenerateContentConfig(
        max_output_tokens=65536
    )
)
```

### Excel Parser

```python
# Usar openpyxl en modo read_only para archivos grandes
wb = openpyxl.load_workbook(file, read_only=True)
```

---

## 6. ETL Pipeline

### Optimización de 3 Capas

```python
# Procesar en lotes
BATCH_SIZE = 100

for batch in chunks(products, BATCH_SIZE):
    # Capa 1: Análisis estructural (paralelo)
    analyzed = await asyncio.gather(*[
        layer1_analyze(p) for p in batch
    ])
    
    # Capa 2: Validación histórica (batch query)
    codes = [p.clean_code for p in analyzed]
    registry = db.query(CodeRegistry).filter(
        CodeRegistry.clean_code.in_(codes)
    ).all()
    
    # Capa 3: Sanitización (en memoria)
    sanitized = [layer3_sanitize(p) for p in analyzed]
    
    # Bulk insert
    db.bulk_save_objects(sanitized)
```

---

## 7. Frontend Performance

### Lazy Loading

```tsx
const ListingsManagement = lazy(() => 
    import('./pages/ListingsManagement')
);
```

### Paginación Virtual

```tsx
// Para tablas grandes (>1000 rows)
import { useVirtual } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtual({
    size: products.length,
    parentRef: tableRef,
    estimateSize: () => 40,
});
```

---

## 8. Monitoreo

### Prometheus Métricas

```python
# Tiempos de respuesta
http_request_duration = Histogram(
    'iris_http_request_duration_seconds',
    'HTTP request duration',
    ['method', 'endpoint', 'status']
)

# Rate limits Gemini
gemini_rate_limited = Counter(
    'iris_gemini_rate_limited_total',
    'Gemini 429 errors'
)

# Productos procesados
products_processed = Counter(
    'iris_products_processed_total',
    'Products processed through ETL'
)
```

### Alertas Recomendadas

| Métrica | Umbral | Acción |
|---------|--------|--------|
| Response time P95 | > 2s | Escalar workers |
| Error rate | > 5% | Investigar logs |
| Gemini 429s | > 10/min | Reducir rate |
| DB connections | > 80% pool | Aumentar pool |

---

## 9. Despliegue Producción

### Docker Resources

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Gunicorn Config

```python
# gunicorn.conf.py
workers = 4
worker_class = 'uvicorn.workers.UvicornWorker'
timeout = 120
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
```

---

## 10. Checklist de Optimización

- [ ] Índices de BD creados
- [ ] Pool de conexiones configurado
- [ ] Rate limiting de Gemini habilitado
- [ ] Caché de queries configurado
- [ ] Gzip middleware activo
- [ ] Lazy loading en frontend
- [ ] Prometheus métricas activas
- [ ] Alertas configuradas
