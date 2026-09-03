FROM python:3.11-slim

WORKDIR /app

# System deps for soundfile / espeak-ng phonemizer (optional at runtime; keep slim)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    espeak-ng \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./services/voice
# Work from repo root layout expected by `services.voice.app:create_production_app`
WORKDIR /

EXPOSE 8000

# Factory app that loads Kokoro/faster-whisper from environment on start.
# Keep bound to 0.0.0.0 inside compose; compose maps 8000:8000.
CMD ["uvicorn", "services.voice.app:create_production_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
