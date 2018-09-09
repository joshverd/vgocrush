FROM mhart/alpine-node:8.4

RUN apk add --no-cache --virtual .build-deps  build-base g++ bash python
ENV TZ=America/Los_Angeles

# use changes to package.json to force Docker not to use the cache
# when we change our application's nodejs dependencies:
ADD package.json /tmp/package.json
RUN cd /tmp && npm install && npm rebuild bcrypt --build-from-source
RUN mkdir -p /opt/skne && cp -a /tmp/node_modules /opt/skne/

# From here we load our application's code in, therefore the previous docker
# "layer" thats been cached will be used if possible
WORKDIR /opt/skne
ADD . .
