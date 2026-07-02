FROM node:22-slim AS app
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY scripts/ scripts/
COPY backend/ backend/
COPY data/openai.key data/openai.key
COPY data/courses_overview.json data/courses_overview.json
COPY data/embeddings.jsonl data/embeddings.jsonl
COPY data/current_courses.json data/current_courses.json
COPY data/definitions/ data/definitions/

EXPOSE 3000
CMD ["node", "backend/search-server.js"]