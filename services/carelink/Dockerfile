FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    POLICY_DB_PATH=/data/policies.sqlite3

WORKDIR /app
COPY . /app
RUN mkdir -p /data

EXPOSE 8765
CMD ["python", "policy_service.py", "serve", "--host", "0.0.0.0", "--refresh-hours", "0"]
