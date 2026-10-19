# Multi-stage production Dockerfile for FreshDispatch

# Stage 1: Build the React client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install production dependencies for server
COPY server/package*.json ./server/
RUN npm ci --prefix server --omit=dev

# Copy server code and client production build
COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 3001

CMD ["node", "server/src/index.js"]
