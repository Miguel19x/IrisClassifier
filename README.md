# 🌈 IrisClassifier

AI-Powered Product Classification System with Mobile Support

## 📋 Features

- 📤 **Upload Catalogs**: PDF, Excel, or Camera capture
- 🤖 **AI Classification**: Ollama-powered product categorization
- 💰 **Price Ranges**: Customizable price categories
- 📱 **Mobile Ready**: Android & iOS support via Capacitor
- 📊 **Monitoring**: Prometheus + Grafana observability
- 🐳 **Docker**: Full containerization support

## 🚀 Quick Start

### Prerequisites

- **Backend**: Python 3.11+, pnpm
- **Frontend**: Node.js 20+
- **Mobile** (optional): Android Studio / Xcode
- **Docker** (optional): Docker & Docker Compose

### Development Setup

#### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload
```

Backend runs on: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Metrics: http://localhost:8000/metrics

#### 2. Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Run dev server
pnpm dev
```

Frontend runs on: http://localhost:5173

### Docker Deployment

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your values

# Start all services
docker-compose up -d

# With monitoring
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Services:
- Frontend: http://localhost
- Backend: http://localhost:8000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

## 📱 Mobile Development

### Android

```bash
cd frontend

# Build web app
pnpm build

# Sync with Android
pnpm exec cap sync android

# Open in Android Studio
pnpm exec cap open android
```

### iOS (Mac only)

```bash
cd frontend

# Build web app
pnpm build

# Add iOS platform
pnpm exec cap add ios

# Sync with iOS
pnpm exec cap sync ios

# Open in Xcode
pnpm exec cap open ios
```

## 🔧 Configuration

### Backend (.env)

```env
DATABASE_URL=sqlite:///./iris.db
OLLAMA_BASE_URL=http://localhost:11434
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:5173
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

## 📊 API Endpoints

### Catalogs
- `GET /api/v1/catalogs` - List catalogs
- `POST /api/v1/catalogs/upload` - Upload file
- `GET /api/v1/catalogs/{id}/export` - Export (CSV/Excel/JSON)

### Products
- `GET /api/v1/products` - List products
- `PATCH /api/v1/products/{id}` - Update product
- `DELETE /api/v1/products/{id}` - Delete product

### Price Ranges
- `GET /api/v1/price-ranges` - List ranges
- `POST /api/v1/price-ranges` - Create range
- `PUT /api/v1/price-ranges/{id}` - Update range
- `DELETE /api/v1/price-ranges/{id}` - Delete range

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest tests/ -v
```

### Frontend Tests

```bash
cd frontend
pnpm test
```

## 📦 Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: ORM for database
- **Ollama**: AI classification
- **Prometheus**: Metrics collection
- **pdfplumber**: PDF extraction
- **pandas**: Data processing

### Frontend
- **Vite**: Fast build tool
- **React 18**: UI library
- **TypeScript**: Type safety
- **TanStack Query**: Server state
- **Capacitor**: Mobile wrapper
- **Axios**: HTTP client

## 📝 License

MIT License

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 📧 Support

For issues and questions, please open a GitHub issue.
