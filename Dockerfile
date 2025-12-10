FROM node:24-alpine

COPY . /app

WORKDIR /app

RUN apk add --no-cache curl

RUN npm install

CMD node main.js
