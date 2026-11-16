FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 VORTEX_ROOT=/srv
WORKDIR /srv/backend
COPY backend/requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt
COPY backend/src ./src
COPY backend/artifacts ./artifacts
COPY data/serving /srv/data/serving
COPY results /srv/results
CMD ["sh", "-c", "uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
