#!/bin/bash
# Run on the Docker host; credentials stay in its existing provider volumes.
set -euo pipefail
app=${1:-}; port=${2:-1455}; account=${3:-}
[[ $app =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$ ]] || { echo 'Invalid container name.' >&2; exit 2; }
[[ $port =~ ^[1-9][0-9]{3,4}$ ]] && ((port >= 1024 && port <= 65535)) || { echo 'Invalid callback port.' >&2; exit 2; }
[[ -z $account || $account == new || $account =~ ^[a-f0-9]{16}$ ]] || exit 2
[[ $(docker inspect --format '{{.State.Running}}' "$app") == true ]] || { echo 'Start the application container first.' >&2; exit 2; }
image=$(docker inspect --format '{{.Image}}' "$app")
[[ $image =~ ^sha256:[a-f0-9]{64}$ ]] || exit 2
for setting in STORYCHAT_ACCOUNT_ID STORYCHAT_MODEL; do
  value=$(docker inspect --format "{{range .Config.Env}}{{if eq (index (split . \"=\") 0) \"$setting\"}}{{.}}{{end}}{{end}}" "$app")
  [[ -z $value || $value == "$setting=" ]] || { echo "Clear both account/model environment settings in Portainer before using saved connection setup." >&2; exit 2; }
done
provider=$(docker inspect --format '{{range .Mounts}}{{if and (eq .Destination "/var/lib/storychat/provider") (eq .Type "volume") .RW}}{{.Name}}{{end}}{{end}}' "$app")
keys=$(docker inspect --format '{{range .Mounts}}{{if and (eq .Destination "/var/lib/storychat/keys") (eq .Type "volume") .RW}}{{.Name}}{{end}}{{end}}' "$app")
for volume in "$provider" "$keys"; do [[ $volume =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]+$ ]] || { echo 'Expected dedicated writable named provider/key volumes.' >&2; exit 2; }; done
[[ $provider != "$keys" ]] || exit 2
run=$(cat /proc/sys/kernel/random/uuid)
helper="storychat-connect-$run"
stopped=false
cleanup() {
  result=$?
  trap - EXIT HUP INT TERM
  if [[ $(docker inspect --format '{{index .Config.Labels "storychat.connection.run"}}' "$helper" 2>/dev/null || true) == "$run" ]]; then docker rm -f "$helper" >/dev/null 2>&1 || true; fi
  if $stopped; then
    if ! docker start "$app" >/dev/null; then echo 'Application restart failed; start it in Portainer.' >&2; result=1; fi
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
echo 'Stopping Storychat temporarily to release its provider connection.'
stopped=true
docker stop --time 150 "$app" >/dev/null
args=(connect-ssh); [[ -z $account ]] || args+=("$account")
docker run --rm -i --name "$helper" --label "storychat.connection.run=$run" --network host --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 128 --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --mount "type=volume,source=$provider,target=/var/lib/storychat/provider" \
  --mount "type=volume,source=$keys,target=/var/lib/storychat/keys" \
  -e "STORYCHAT_CALLBACK_PORT=$port" "$image" node prototype/cli.mjs "${args[@]}"
echo 'Connection saved. Restarting Storychat; no inference request was made.'
