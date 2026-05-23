#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_DIR="$(cd "${APP_DIR}/.." && pwd)"

ENV_FILE="${APP_DIR}/.env"
SHP="${WORKSPACE_DIR}/broadband-performance-tiles/gps_fixed_tiles.shp"
TABLE="public.broadband_performance_tiles"
EXPECTED_ROWS="6364159"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

if [[ ! -f "${SHP}" ]]; then
  echo "Missing shapefile: ${SHP}" >&2
  exit 1
fi

for command_name in psql ogr2ogr npx; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

cd "${APP_DIR}"

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set in ${ENV_FILE}" >&2
  exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis;"

npx prisma validate
npx prisma db push --skip-generate

EXISTING_ROWS="$(
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -tAc "
    SELECT CASE
      WHEN to_regclass('${TABLE}') IS NULL THEN 0
      ELSE (SELECT COUNT(*) FROM ${TABLE})
    END;
  "
)"

if [[ "${EXISTING_ROWS}" != "0" ]]; then
  echo "${TABLE} already contains ${EXISTING_ROWS} rows; refusing to append duplicate data." >&2
  exit 1
fi

ogr2ogr \
  -f PostgreSQL "PG:${DATABASE_URL}" \
  "${SHP}" \
  -append \
  -update \
  -nln "${TABLE}" \
  -nlt POLYGON \
  -a_srs EPSG:4326 \
  -unsetFid \
  -progress \
  -gt 65536 \
  --config PG_USE_COPY YES

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<SQL
CREATE INDEX IF NOT EXISTS broadband_performance_tiles_geom_idx
  ON ${TABLE}
  USING GIST (geom);

ANALYZE ${TABLE};
SQL

IMPORTED_ROWS="$(psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -tAc "SELECT COUNT(*) FROM ${TABLE};")"

echo "Imported ${IMPORTED_ROWS} rows into ${TABLE}."

if [[ "${IMPORTED_ROWS}" != "${EXPECTED_ROWS}" ]]; then
  echo "Expected ${EXPECTED_ROWS} rows, but found ${IMPORTED_ROWS}." >&2
  exit 1
fi
