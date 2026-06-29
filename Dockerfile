# React frontend
FROM node:22-slim AS frontend-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Node search API
FROM node:22-slim AS app
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY distribution.js ./
COPY distribution/ distribution/
COPY scripts/ scripts/
COPY backend/ backend/
COPY data/openai.key data/openai.key
COPY data/courses_overview.json data/courses_overview.json
COPY data/embeddings.jsonl data/embeddings.jsonl
COPY data/current_courses.json data/current_courses.json

EXPOSE 3000
CMD ["node", "backend/search-server.js", "--local"]