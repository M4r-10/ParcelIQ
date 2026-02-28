FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# TODO: Use nginx to serve built assets in production
CMD ["npm", "run", "dev"]
