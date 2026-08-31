# [FIX H7] التاج كان node:22-bookworm-slim — تاج متحرك.
# المشروع بيعتمد على node:sqlite وهي لسه experimental، يعني أي إصدار 22.x جديد
# ممكن يغير سلوك DatabaseSync من غير ما نغيّر سطر واحد في الكود — ويقع الإنتاج
# في ديبلوي عادي محدش غيّر فيه حاجة. تثبيت الإصدار = ديبلوي قابل للتكرار.
FROM node:22.11.0-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV EF_ENV=production
ENV PORT=8000
# Must match the mounted disk in render.yaml. Pointing this at a path
# inside the image would silently throw away every user on redeploy.
ENV EF_DATA_DIR=/var/data/elforma

COPY package.json ./
COPY package-lock.json ./
# [FIX جذري] كان مفيش npm install خالص، فمكتبة libsql (اللي بتوصّل بـTurso)
# ماكانتش بتتثبّت أبداً. النتيجة: أول ما تتظبط متغيّرات Turso،
# require('libsql') بيفشل والسيرفر بيقع، فTurso يفضل صفر كتابة.
# libsql في optionalDependencies فبيتثبّت تلقائيًا مع npm install.
# [FIX v2] libsql نُقلت لـ dependencies (مش optional) — npm install هيثبتها دايماً
RUN npm install --omit=dev --include=optional --no-audit --no-fund
COPY server.js ./
COPY api ./api
COPY lib ./lib
COPY app ./app
COPY public ./public
COPY scripts ./scripts

RUN mkdir -p /var/data/elforma && chown -R node:node /app /var/data/elforma

USER node
EXPOSE 8000

# [FIX جذري] node:sqlite لسّه experimental على Node 22 المثبّت، وبيحتاج فلاج
# صريح عشان يشتغل من غير ما require('node:sqlite') يرمي. ده مسار الاحتياط
# (لو Turso مش متظبط)، فبنضمن إنه مايقعش أبدًا.
CMD ["node", "--experimental-sqlite", "server.js"]
