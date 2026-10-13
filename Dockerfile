FROM oven/bun:latest

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy the rest of the source
COPY . .

# Railway injects PORT at runtime — do NOT hardcode it here
EXPOSE 3000

# Start the backend server
CMD ["bun", "run", "server/index.ts"]
