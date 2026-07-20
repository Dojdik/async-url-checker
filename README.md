# Async URL Checker

Асинхронная проверка URL через HTTP HEAD: master/worker-кластер на NestJS, UI на React + Redux (FSD). Хранение заданий — in-memory (без БД).

```
async-url-checker/
├── backend/          # NestJS API + cluster workers
├── frontend/         # React + Redux Toolkit (FSD)
└── docker-compose.yml
```

| Сервис   | URL (по умолчанию)        |
|----------|---------------------------|
| UI       | http://localhost:8080     |
| API      | http://localhost:3001/api |
| Swagger  | http://localhost:3001/docs |

---

## Возможности API

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/jobs` | Создать задание (`{ "urls": ["https://..."] }`) |
| `GET` | `/api/jobs` | Список: id, status, urlsCount, stats |
| `GET` | `/api/jobs/:id` | Детали URL: status, httpStatus, error, startedAt/endedAt, durationMs |
| `DELETE` | `/api/jobs/:id` | Отмена: `cancelled`, неначатые URL не обрабатываются |

### Логика проверки URL

- На каждый URL — **HTTP HEAD**
- После ответа — случайная задержка **0…`URL_DELAY_MAX_SECONDS`** секунд
- Не более **`MAX_CONCURRENT_URLS`** одновременных HEAD на одно задание
- Несколько заданий параллельно (до `WORKERS_COUNT` воркеров)

---

## Быстрый старт (Docker)

### Установка Docker (одна команда)

Если Docker ещё не установлен (Linux, официальный скрипт):

```bash
curl -fsSL https://get.docker.com | sh
```

После установки добавьте пользователя в группу `docker` (чтобы не вызывать `sudo` каждый раз) и перелогиньтесь:

```bash
sudo usermod -aG docker "$USER"
# затем: newgrp docker   или выход/вход в сессию
```

Проверка:

```bash
docker --version
docker compose version
```

> На macOS/Windows удобнее [Docker Desktop](https://docs.docker.com/get-docker/).  
> Скрипт `get.docker.com` ставит Docker Engine + Compose plugin; для не-root доступа нужна группа `docker` (см. выше).

### Запуск приложения

Из корня репозитория:

```bash
docker compose up --build -d
```

- UI: http://localhost:8080  
- API: http://localhost:3001/api  
- Swagger: http://localhost:3001/docs  

Остановка:

```bash
docker compose down
```

Пересборка после изменений кода:

```bash
docker compose up --build -d
```

### Порты Docker

| Переменная compose | По умолчанию | Назначение |
|--------------------|--------------|------------|
| `FRONTEND_PORT` | `8080` | Хост → nginx (frontend) |
| `BACKEND_PORT` | `3001` | Хост → Nest API |

Пример:

```bash
FRONTEND_PORT=80 BACKEND_PORT=3001 docker compose up --build
```

Внутри compose frontend проксирует `/api` на сервис `backend:3001` (см. `frontend/nginx.conf`).

---

## Локальная разработка (без Docker)

Нужны **Node.js 20+** (рекомендуется 22) и npm.

### 1. Backend

```bash
cd backend
cp .env.example .env   # при необходимости
npm install
npm run start:dev
```

API: http://localhost:3001/api  
Swagger: http://localhost:3001/docs  

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173  

Vite проксирует `/api` → `http://127.0.0.1:3001` (см. `frontend/vite.config.ts`).

### Production-сборка локально

```bash
# backend
cd backend && npm run build && npm run start:prod

# frontend
cd frontend && npm run build && npm run preview
```

---

## Переменные окружения (памятка)

Источник правды на backend: `backend/src/config/configuration.ts`  
Шаблон: `backend/.env.example`  
Загрузка: Nest `ConfigModule` (файлы `.env.local`, `.env` в каталоге backend).

### Backend

| Env | Default | Диапазон | Описание |
|-----|---------|----------|----------|
| `PORT` | `3001` | 1–65535 | HTTP-порт master-процесса |
| `WORKERS_COUNT` | `2` | 1–64 | Число **cluster**-воркеров (параллельные задания) |
| `HTTP_TIMEOUT_MS` | `10000` | 100–300000 | Таймаут HEAD-запроса (мс) |
| `MAX_CONCURRENT_URLS` | `5` | 1–100 | Макс. одновременных HEAD **внутри одного job** |
| `URL_DELAY_MAX_SECONDS` | `10` | 0–120 | Верхняя граница искусственной задержки после HEAD (с), случайно `0…N` |
| `JOB_TIMEOUT_BASE_MS` | `60000` | 1000–3600000 | Мин. wall-clock таймаут задания на worker (мс) |
| `JOB_TIMEOUT_PER_URL_MS` | `12000` | 100–600000 | Добавка к таймауту на каждый URL: `max(BASE, urls × PER_URL)` |

#### Как задать

**Локально (backend):**

```bash
cd backend
cp .env.example .env
# отредактировать .env
```

Или в shell:

```bash
WORKERS_COUNT=4 PORT=3001 npm run start:dev
```

**Docker Compose** — через env на хосте или файл `.env` рядом с `docker-compose.yml`:

```env
BACKEND_PORT=3001
FRONTEND_PORT=8080
WORKERS_COUNT=4
HTTP_TIMEOUT_MS=10000
MAX_CONCURRENT_URLS=5
URL_DELAY_MAX_SECONDS=10
```

```bash
docker compose up --build
```

Значения из таблицы backend пробрасываются в контейнер `auc-backend` (см. `docker-compose.yml`).

#### Подсказки по тюнингу

| Цель | Что крутить |
|------|-------------|
| Больше заданий одновременно | ↑ `WORKERS_COUNT` (и CPU/RAM контейнера) |
| Быстрее проверка URL внутри job | ↓ `URL_DELAY_MAX_SECONDS`, ↑ `MAX_CONCURRENT_URLS` |
| Меньше нагрузки на целевые сайты | ↓ `MAX_CONCURRENT_URLS`, ↑ `URL_DELAY_MAX_SECONDS` |
| Медленные/далёкие хосты | ↑ `HTTP_TIMEOUT_MS`, ↑ `JOB_TIMEOUT_*` |
| Dev «быстрый» режим | `URL_DELAY_MAX_SECONDS=0`, `WORKERS_COUNT=2` |
| Крупные jobs (много URL) | ↑ `JOB_TIMEOUT_PER_URL_MS` или `JOB_TIMEOUT_BASE_MS` |

> **In-memory:** при рестарте backend все jobs теряются.  
> **Cluster:** воркеры — отдельные процессы Node; в Docker не ставьте `WORKERS_COUNT` больше разумного числа CPU.

### Frontend

| Env | Default | Описание |
|-----|---------|----------|
| `VITE_API_BASE_URL` | `/api` (dev proxy / Docker nginx) | Базовый URL API для браузера |

Шаблон: `frontend/.env.example`.

| Сценарий | Значение |
|----------|----------|
| `npm run dev` (Vite) | не задавать — proxy `/api` → backend:3001 |
| Docker / nginx | build-arg `VITE_API_BASE_URL=/api` (same-origin) |
| API на другом хосте | `VITE_API_BASE_URL=https://api.example.com/api` (нужен CORS) |

Backend CORS включён (`origin: true`) для dev и cross-origin клиентов.

### Compose-only (порты публикации)

| Env | Default | Описание |
|-----|---------|----------|
| `BACKEND_PORT` | `3001` | Порт API на хосте |
| `FRONTEND_PORT` | `8080` | Порт UI на хосте |

---

## Архитектура (кратко)

### Backend

- **Master** — HTTP API, очередь, пул воркеров, in-memory repository  
- **Workers** — IPC `process_job` / `cancel_job`, HEAD + delay, прогресс URL  
- Конфиг: `ConfigModule` + `src/config/configuration.ts`

### Frontend (FSD)

```
frontend/src/
  app/        # store, providers, styles
  pages/      # JobsPage
  widgets/    # список, детали
  features/   # create / cancel
  entities/   # job types, API, Redux slice
  shared/     # HTTP client, UI-kit
```

Глобальный Redux-state: список jobs, active job, details, loading/errors; polling деталей для running jobs.

---

## Полезные команды

```bash
# Docker
docker compose up --build
docker compose logs -f backend
docker compose down

# Backend
cd backend && npm run start:dev
cd backend && npm run build && npm run start:prod

# Frontend
cd frontend && npm run dev
cd frontend && npm run build
```

---

## Требования

| | |
|--|--|
| Node.js | 20+ (рекомендуется 22) |
| npm | 10+ |
| Docker | 24+ / Compose v2 (для container-деплоя) |

Нет внешней БД и брокеров — только in-memory и Node `cluster`.
