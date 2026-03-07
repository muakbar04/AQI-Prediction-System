# ==========================================
# STAGE 1: The Builder
# ==========================================
FROM python:3.12-slim AS builder

# 1. Install heavy system build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 2. Create a virtual environment
RUN python -m venv /opt/venv
# Make sure we use the venv's pip
ENV PATH="/opt/venv/bin:$PATH"

# 3. Install Python dependencies into the venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# ==========================================
# STAGE 2: The Runner (Production Image)
# ==========================================
FROM python:3.12-slim

WORKDIR /app

# 1. Install ONLY the runtime libraries needed for PostgreSQL (no compilers!)
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 2. Copy the pre-built virtual environment from the builder stage
COPY --from=builder /opt/venv /opt/venv

# 3. Ensure the container uses the virtual environment's Python
ENV PATH="/opt/venv/bin:$PATH"

# 4. Copy your actual backend code
COPY . .

EXPOSE 8000

# 5. Start the server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]