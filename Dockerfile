# Exact maintained Node 24 patch verified against the official-images manifest.
FROM node:24.22.2-bookworm-slim

# Linux runtime locks use flock; install explicitly instead of assuming a slim image includes it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && command -v flock \
    && install -d -m 0700 -o 1000 -g 1000 \
       /var/lib/storychat/stories /var/lib/storychat/provider /var/lib/storychat/keys /var/lib/storychat/media

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --include=optional

# Exact runtime sources only. Private files must never enter the build context.
COPY speech-spike/ ./speech-spike/
RUN node speech-spike/prepare-assets.mjs /app/speech-assets

COPY app/server.mjs app/store.mjs app/provider.mjs app/transfer.mjs app/item-transfer.mjs app/backup.mjs app/media.mjs app/media-transfer.mjs ./app/
COPY prototype/auth.mjs prototype/cli.mjs prototype/connection.mjs prototype/errors.mjs prototype/handoff.mjs prototype/output.mjs prototype/provider.mjs prototype/runtime-lock.mjs prototype/stream.mjs prototype/vault.mjs ./prototype/
COPY public/index.html public/style.css public/app.js public/narration.js public/explorer.js public/personas.js public/i18n.js public/icon.svg public/icon-192.png public/icon-512.png public/icon-maskable-512.png public/manifest.webmanifest ./public/
COPY deploy/healthcheck.mjs deploy/connect-chatgpt.sh ./deploy/

ENV STORYCHAT_SPEECH_ASSETS=/app/speech-assets \
    NODE_ENV=production \
    STORYCHAT_HOST=0.0.0.0 \
    PORT=8787 \
    STORYCHAT_DB=/var/lib/storychat/stories/storychat.sqlite \
    STORYCHAT_DATA_DIR=/var/lib/storychat/provider \
    STORYCHAT_KEY_DIR=/var/lib/storychat/keys \
    STORYCHAT_MEDIA_DIR=/var/lib/storychat/media

USER 1000:1000
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=7s --start-period=20s --retries=3 \
    CMD ["node", "/app/deploy/healthcheck.mjs"]
CMD ["node", "app/server.mjs"]
