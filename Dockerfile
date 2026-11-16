# Multi-stage Dockerfile for Operations Frontend
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG PUBLIC_BACKEND_API_URL
ARG PUBLIC_SALES_PORTAL_API_URL
ENV PUBLIC_BACKEND_API_URL=${PUBLIC_BACKEND_API_URL}
ENV PUBLIC_SALES_PORTAL_API_URL=${PUBLIC_SALES_PORTAL_API_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
