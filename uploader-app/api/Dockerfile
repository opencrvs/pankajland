# Use a lightweight Node.js image
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies (including devDependencies)
COPY package.json yarn.lock ./
# Copy the rest of the app
COPY . .
RUN yarn install --frozen-lockfile

RUN yarn global add tsx

EXPOSE 3068
# Start the server using tsx
CMD ["yarn", "start:backend"]
