# Build stage: install full deps (needed to run tsc) and compile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage: install only production deps to keep image small
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ARG PORT=5000
ENV PORT=$PORT
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --omit=dev
EXPOSE ${PORT}
CMD ["node", "dist/index.js"]
