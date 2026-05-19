# Stage 1: Build Vite app
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json yarn.lock ./
COPY . .
RUN yarn install --frozen-lockfile
RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# static files from builder stage
COPY --from=builder /app/web-app/dist /usr/share/nginx/html
# nginx template for dynamic environment variables
COPY web-app/nginx.conf.template /etc/nginx/templates/default.conf.template

ENTRYPOINT ["sh", "-c", "/usr/share/nginx/html/vite-envs.sh && /docker-entrypoint.sh nginx -g 'daemon off;'"]
