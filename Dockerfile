FROM node:20-alpine

WORKDIR /app

# ── Backend ──────────────────────────────────────
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --omit=dev

# ── Frontend ─────────────────────────────────────
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Confirm build succeeded
RUN ls -la /app/frontend/dist/

# ── Copy backend source ───────────────────────────
COPY backend/ ./backend/

# ── Cleanup frontend node_modules ─────────────────
RUN rm -rf /app/frontend/node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/src/index.js"]
