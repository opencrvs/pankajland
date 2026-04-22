# Stage 1: Build Vite app
FROM node:22-alpine AS builder

ARG VITE_EXTERNAL_CLIENT_URL
ENV VITE_EXTERNAL_CLIENT_URL=$VITE_EXTERNAL_CLIENT_URL

ARG VITE_GATEWAY_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL

ARG VITE_COUNTRY_CONFIG_URL
ENV VITE_COUNTRY_CONFIG_URL=$VITE_COUNTRY_CONFIG_URL

WORKDIR /app
COPY package.json yarn.lock ./
COPY . .
RUN yarn install --frozen-lockfile
RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/web-app/dist /usr/share/nginx/html
COPY web-app/nginx.conf /etc/nginx/conf.d/default.conf

ENTRYPOINT sh -c "/usr/share/nginx/html/vite-envs.sh && nginx -g 'daemon off;'"
