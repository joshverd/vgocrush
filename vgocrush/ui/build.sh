export API_URL=http://127.0.0.1:9000
export CHAT_URL=http://127.0.0.1:9001

npm run build
docker build -t vgocrush/vgocrush:ui .
