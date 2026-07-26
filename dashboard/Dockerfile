FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=/api
ARG VITE_PUBLIC_DOMAIN=manupos.webprintmedia.swiss
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PUBLIC_DOMAIN=$VITE_PUBLIC_DOMAIN
RUN npm run build

FROM caddy:2.9-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile.static /etc/caddy/Caddyfile
EXPOSE 80
