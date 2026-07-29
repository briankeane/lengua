FROM node:22.15.0-slim

# Create new user
WORKDIR /usr/src/app

COPY package.json package-lock.json /usr/src/app/

RUN apt-get update && apt install -y netcat-traditional

# env-cmd and sequelize at the command-line for
# easier development
RUN npm install -g env-cmd sequelize-cli

RUN npm install
