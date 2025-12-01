FROM node:24-alpine

COPY . /app

WORKDIR /app

RUN npm install

CMD node main.js