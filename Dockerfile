FROM node:11

LABEL maintainer="Atomist <docker@atomist.com>"

RUN mkdir -p /opt/app

WORKDIR /opt/app

ENV NPM_CONFIG_LOGLEVEL warn

ENV SUPPRESS_NO_CONFIG_WARNING true

ENTRYPOINT ["node", "index.js"]

RUN npm install -g npm

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .
