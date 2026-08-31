#!/usr/bin/env bash
set -Eeuo pipefail

release_sha="${1:?Release SHA is required}"
app_root='/www/projects/MobileBee-Backend'
release_dir="$app_root/releases/$release_sha"
current_link="$app_root/current"
previous_release=''
switched='false'

rollback() {
  exit_code=$?
  if [[ "$switched" == 'true' && -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$app_root/current.rollback"
    mv -Tf "$app_root/current.rollback" "$current_link"
    pm2 startOrReload "$current_link/ecosystem.config.cjs" --env production
    pm2 save
  fi
  exit "$exit_code"
}
trap rollback ERR

test -d "$release_dir"
test -f "$app_root/.env"

cd "$release_dir"
npm ci --omit=dev
ln -sfn "$app_root/.env" .env

if [[ -L "$current_link" ]]; then
  previous_release="$(readlink -f "$current_link")"
fi

ln -sfn "$release_dir" "$app_root/current.next"
mv -Tf "$app_root/current.next" "$current_link"
switched='true'

pm2 startOrReload "$current_link/ecosystem.config.cjs" --env production
pm2 save

curl --fail --silent --show-error --retry 5 --retry-delay 2 \
  http://127.0.0.1:3000/api/v1/health >/dev/null

switched='false'
find "$app_root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | tail -n +6 \
  | cut -d' ' -f2- \
  | xargs -r rm -rf --
