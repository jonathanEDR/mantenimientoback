Proyecto backend Node.js + TypeScript

Requisitos:
- Node >= 18
- MongoDB (local o en la nube)

Pasos rápidos:
1) Copiar `.env.example` a `.env` y configurar `MONGODB_URI` y `JWT_SECRET`.
2) npm install
3) npm run dev (desarrollo)

Modo producción (build + start):

1) npm ci
2) npm run build
3) npm start

O usando Docker (recomendado para despliegues):

	docker build -t registro-backend:latest .
	docker run -e MONGODB_URI="mongodb://..." -e JWT_SECRET="..." -p 4000:4000 registro-backend:latest

Endpoint de ejemplo:
POST /api/auth/register
Body: { "name": "Juan", "email": "juan@example.com", "password": "secreto" }
