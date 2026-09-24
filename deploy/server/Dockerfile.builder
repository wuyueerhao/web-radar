FROM python:3.12-slim-bookworm
RUN pip install --no-cache-dir uv==0.8.22
WORKDIR /app/services/site-builder
COPY services/site-builder/pyproject.toml services/site-builder/uv.lock ./
RUN uv sync --frozen --no-dev && uv run --no-sync playwright install --with-deps chromium
COPY services/site-builder/ ./
COPY screenshot-to-code-main/backend/ /app/screenshot-to-code-main/backend/
RUN useradd --uid 1000 --create-home builder && mkdir -p /data && chown builder:builder /data && chmod -R a+rX /root/.cache/ms-playwright && mv /root/.cache/ms-playwright /opt/browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers PYTHONUNBUFFERED=1
USER builder
CMD [".venv/bin/uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7002", "--workers", "1"]
