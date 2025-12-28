# 🌈 IrisClassifier

Sistema de Clasificación de Productos con IA y Gestión de Listas de Precios

## 📋 Características Principales

- 📤 **Subir Listas de Precios**: PDF, Excel, o captura con cámara
- 🤖 **ETL Inteligente**: Normalización de códigos con Gemini 2.5 Flash
- 💰 **Gestión Listados**: Vista dual Empresarial/Cliente con heatmap
- 📊 **Comparación de Precios**: Análisis Barato/Mediano/Caro
- 📱 **Soporte Móvil**: Android & iOS via Capacitor
- 📈 **Monitoreo**: Prometheus + Grafana

## 🚀 Inicio Rápido

### Requisitos

- **Backend**: Python 3.11+
- **Frontend**: Node.js 20+, pnpm
- **IA**: Gemini API Key (gratuita: https://ai.google.dev)

### Desarrollo

#### 1. Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
.\venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables
cp .env.example .env
# Editar .env con GEMINI_API_KEY

# Ejecutar servidor
uvicorn main:app --reload
```

Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Metrics: http://localhost:8000/metrics

#### 2. Frontend

```bash
cd frontend

# Instalar dependencias
pnpm install

# Ejecutar servidor de desarrollo
pnpm dev
```

Frontend: http://localhost:5173

### Credenciales por Defecto

```
Email: admin@iris.com
Password: admin123
```

## 📊 API Endpoints

### Listas de Precios

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/lists` | Listar listas |
| GET | `/api/v1/lists/{id}` | Obtener lista |
| DELETE | `/api/v1/lists/{id}` | Eliminar lista |
| POST | `/api/v1/lists/upload` | Subir lista (con ETL) |

### Productos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/products` | Listar productos |
| PATCH | `/api/v1/products/{id}` | Actualizar producto |
| DELETE | `/api/v1/products/{id}` | Eliminar producto |

### Master Table (Gestión Listados)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/master-products` | Listar Master Table |
| GET | `/api/v1/master-products/stats` | Estadísticas (heatmap) |
| GET | `/api/v1/master-products/export` | Exportar PDF/Excel |
| PATCH | `/api/v1/master-products/{id}/margin` | Actualizar margen |
| PATCH | `/api/v1/master-products/{id}/final-price` | Actualizar precio final |
| PATCH | `/api/v1/master-products/{id}/review-status` | Confirmar/Rechazar |

### Rangos de Precio

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/price-ranges` | Listar rangos |
| POST | `/api/v1/price-ranges` | Crear rango |
| PUT | `/api/v1/price-ranges/{id}` | Actualizar rango |
| DELETE | `/api/v1/price-ranges/{id}` | Eliminar rango |

## 🔧 Configuración

### Backend (.env)

```env
DATABASE_URL=sqlite:///./iris.db
GEMINI_API_KEY=tu-api-key-de-gemini
SECRET_KEY=tu-secret-key-seguro
CORS_ORIGINS=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000/api/v1
```

## 📱 Desarrollo Móvil

### Android

```bash
cd frontend
pnpm build
pnpm exec cap sync android
pnpm exec cap open android
```

### iOS (Solo Mac)

```bash
cd frontend
pnpm build
pnpm exec cap add ios
pnpm exec cap sync ios
pnpm exec cap open ios
```

## 📦 Stack Tecnológico

### Backend
- **FastAPI**: Framework web Python
- **SQLAlchemy**: ORM
- **Gemini 2.5 Flash**: Extracción y normalización IA
- **Alembic**: Migraciones de base de datos
- **Prometheus**: Métricas

### Frontend
- **Vite + React 18**: UI moderna
- **TypeScript**: Tipado estático
- **TanStack Query**: Estado del servidor
- **Capacitor**: Wrapper móvil

## 🧪 Testing

```bash
# Backend
cd backend
pytest tests/ -v

# Frontend
cd frontend
pnpm test
```

## 📄 Licencia

MIT License

## 🤝 Contribuir

¡Contribuciones bienvenidas! Por favor abre un issue o PR.
