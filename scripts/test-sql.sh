#!/usr/bin/env bash
# Lance les tests SQL de supabase/tests/*_test.sql sur Supabase local.
# Variables : SQL_TEST_DB_URL (défaut : Supabase local), SQL_TEST_DIR (défaut : supabase/tests).
set -u

DB_URL="${SQL_TEST_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DIR="${SQL_TEST_DIR:-$(cd "$(dirname "$0")/.." && pwd)/supabase/tests}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql est introuvable : installez le client PostgreSQL." >&2
  exit 1
fi

if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c 'select 1' >/dev/null 2>&1; then
  echo "Base injoignable ($DB_URL) : démarrez Supabase local (supabase start)." >&2
  exit 1
fi

shopt -s nullglob
files=("$DIR"/*_test.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "Aucun fichier *_test.sql dans $DIR." >&2
  exit 1
fi

failed=()
for f in "${files[@]}"; do
  echo "==> $(basename "$f")"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"; then
    echo "OK  $(basename "$f")"
  else
    echo "ÉCHEC  $(basename "$f")" >&2
    failed+=("$(basename "$f")")
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Tests SQL en échec (${#failed[@]}/${#files[@]}) : ${failed[*]}" >&2
  exit 1
fi
echo "Tests SQL : ${#files[@]}/${#files[@]} OK"
