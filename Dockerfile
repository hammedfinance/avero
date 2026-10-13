FROM oven/bun:latest

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy the rest of the source
COPY . .

# Expose the port Railway assigns
ENV PORT=3001
EXPOSE $PORT

# Start the backend server
CMD ["bun", "run", "server/index.ts"]
