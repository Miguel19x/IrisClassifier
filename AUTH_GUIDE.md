# Guía de Uso - Autenticación IrisClassifier

## 🔐 Endpoints de Autenticación Disponibles

### 1. Registrar Usuario
```bash
POST http://localhost:8000/api/v1/auth/register
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "id": 1,
  "email": "usuario@ejemplo.com",
  "is_active": true
}
```

### 2. Login (Obtener Token)
```bash
POST http://localhost:8000/api/v1/auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 3. Obtener Info del Usuario
```bash
GET http://localhost:8000/api/v1/auth/me
Authorization: Bearer <tu_token_aqui>
```

---

## 🚀 Flujo Completo de Uso

### Paso 1: Registrar Usuario
1. Ir a http://localhost:8000/docs
2. Expandir `POST /api/v1/auth/register`
3. Click en "Try it out"
4. Ingresar:
   ```json
   {
     "email": "test@test.com",
     "password": "test12345"
   }
   ```
5. Click "Execute"

### Paso 2: Hacer Login
1. Expandir `POST /api/v1/auth/login`
2. Click en "Try it out"
3. Ingresar las mismas credenciales
4. Click "Execute"
5. **Copiar el `access_token`** de la respuesta

### Paso 3: Autorizar en Swagger
1. Click en el botón **"Authorize"** (candado) arriba a la derecha
2. Ingresar: `Bearer <tu_token_copiado>`
3. Click "Authorize"
4. Click "Close"

### Paso 4: Probar Endpoints Protegidos
Ahora puedes usar todos los endpoints:
- `GET /api/v1/catalogs` - Listar catálogos
- `POST /api/v1/catalogs/upload` - Subir archivo
- `GET /api/v1/products` - Ver productos
- `GET /api/v1/price-ranges` - Rangos de precio

---

## 📱 Usando desde el Frontend

El frontend ya está configurado para usar tokens JWT automáticamente.

### Crear función de login en el frontend:
```typescript
// En frontend/src/services/auth.ts
import { api } from './api';
import { storage } from './storage';

export async function login(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  const { access_token } = response.data;
  
  // Guardar token
  await storage.setToken(access_token);
  
  return access_token;
}

export async function register(email: string, password: string) {
  const response = await api.post('/auth/register', { email, password });
  return response.data;
}
```

---

## 🧪 Probar con cURL

### Registrar:
```powershell
curl -X POST http://localhost:8000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@test.com\",\"password\":\"test12345\"}'
```

### Login:
```powershell
curl -X POST http://localhost:8000/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@test.com\",\"password\":\"test12345\"}'
```

### Usar Token:
```powershell
$token = "tu_token_aqui"
curl http://localhost:8000/api/v1/catalogs `
  -H "Authorization: Bearer $token"
```

---

## ✅ Verificar que Funciona

1. **Registrar usuario** → Debe retornar status 201
2. **Login** → Debe retornar token JWT
3. **Usar token** → Endpoints protegidos deben funcionar
4. **Sin token** → Debe retornar 401 Unauthorized

---

**¡Listo!** Ahora puedes probar todo el flujo de la aplicación con autenticación completa.
