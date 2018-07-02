FROM node:9

LABEL maintainer="Atomist <docker@atomist.com>"

ENV DUMB_INIT_VERSION=1.2.1

RUN curl -s -L -O https://github.com/Yelp/dumb-init/releases/download/v$DUMB_INIT_VERSION/dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && dpkg -i dumb-init_${DUMB_INIT_VERSION}_amd64.deb \
    && rm -f dumb-init_${DUMB_INIT_VERSION}_amd64.deb

RUN mkdir -p /opt/app

WORKDIR /opt/app

EXPOSE 2866

ENV NPM_CONFIG_LOGLEVEL warn

ENV SUPPRESS_NO_CONFIG_WARNING true

ENTRYPOINT ["dumb-init", "node", "--trace-warnings", "--expose_gc", "--optimize_for_size", "--always_compact", "--max_old_space_size=256"]

CMD ["node_modules/@atomist/automation-client/start.client.js"]

RUN npm install -g npm@6.0.0

COPY package.json package-lock.json ./

RUN npm ci --only=production

COPY . .
