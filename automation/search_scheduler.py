from __future__ import annotations

import argparse
import hashlib
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path

import httpx
from apscheduler.schedulers.blocking import BlockingScheduler


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "data" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)


def load_local_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()
logger = logging.getLogger("carreira.discovery")
logger.setLevel(logging.INFO)
handler = RotatingFileHandler(LOG_DIR / "python-discovery.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(handler)


def acquire_process_lock():
    lock_path = LOG_DIR / "python-discovery.lock"
    lock_handle = lock_path.open("a+b")
    lock_handle.seek(0, os.SEEK_END)
    if lock_handle.tell() == 0:
        lock_handle.write(b"1")
        lock_handle.flush()
    lock_handle.seek(0)
    try:
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(lock_handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        lock_handle.close()
        return None
    return lock_handle


def run_discovery() -> dict[str, object] | None:
    token = os.getenv("LOCAL_AUTOMATION_TOKEN", "")
    if not token and os.getenv("APP_ENCRYPTION_KEY"):
        token = hashlib.sha256(f"{os.environ['APP_ENCRYPTION_KEY']}:job-discovery".encode("utf-8")).hexdigest()
    base_url = os.getenv("APP_URL", "http://127.0.0.1:3000").rstrip("/")
    if not token:
        logger.error("LOCAL_AUTOMATION_TOKEN não configurado; execução ignorada.")
        return None
    try:
        with httpx.Client(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            response = client.post(f"{base_url}/api/discovery/run", headers={"Authorization": f"Bearer {token}"})
            response.raise_for_status()
            result = response.json()
            logger.info("Descoberta concluída: %s", json.dumps(result, ensure_ascii=False, sort_keys=True))
            return result
    except (httpx.HTTPError, ValueError) as error:
        logger.error("Falha ao acionar descoberta local: %s", error)
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Agenda a descoberta segura de vagas por alertas oficiais.")
    parser.add_argument("--once", action="store_true", help="Executa uma vez e encerra.")
    args = parser.parse_args()
    if args.once:
        result = run_discovery()
        raise SystemExit(0 if result is not None else 1)

    process_lock = acquire_process_lock()
    if process_lock is None:
        logger.info("Outra instância do agendador já está ativa; encerrando esta cópia.")
        return

    interval_minutes = max(30, int(os.getenv("DISCOVERY_INTERVAL_MINUTES", "120")))
    scheduler = BlockingScheduler(timezone="America/Sao_Paulo")
    scheduler.add_job(run_discovery, "interval", minutes=interval_minutes, id="official-job-alerts", max_instances=1, coalesce=True, jitter=120)
    logger.info("Agendador iniciado; intervalo de %s minutos.", interval_minutes)
    run_discovery()
    scheduler.start()


if __name__ == "__main__":
    main()
