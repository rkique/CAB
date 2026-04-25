FROM node:20-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy source code
COPY distribution.js distribution.js
COPY distribution/ distribution/
COPY scripts/ scripts/
COPY frontend/search-server.js frontend/search-server.js
COPY frontend/filters.js frontend/filters.js
COPY frontend/prompts/ frontend/prompts/

# Copy frontend assets
COPY frontend/search.html frontend/search.html
COPY frontend/images/ frontend/images/

# Copy data files (~900MB total)
COPY data/openai.key data/openai.key
COPY data/courses_overview.json data/courses_overview.json
COPY data/embeddings.jsonl data/embeddings.jsonl
COPY data/current_courses.json data/current_courses.json

EXPOSE 3000

CMD ["node", "frontend/search-server.js", "--local"]
