FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY server server
COPY client client
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ARG TEX_EXTRA=""
ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data \
    DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      latexmk biber util-linux ca-certificates \
      texlive-latex-base texlive-latex-recommended texlive-latex-extra \
      texlive-fonts-recommended \
      texlive-science texlive-pictures texlive-publishers \
      texlive-bibtex-extra texlive-xetex texlive-luatex ${TEX_EXTRA} \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10001 --create-home texflow \
 && mkdir -p /data && chown texflow:texflow /data
WORKDIR /app
COPY --from=build --chown=texflow:texflow /app/node_modules node_modules
COPY --chown=texflow:texflow package.json ./
COPY --from=build --chown=texflow:texflow /app/server server
COPY --from=build --chown=texflow:texflow /app/client/dist client/dist
USER texflow
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.js"]
