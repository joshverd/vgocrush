rm -rf static/

API_URL=https://csgo-api:9000 npm run build
docker build -t vgocrush/api-cp:acp .
