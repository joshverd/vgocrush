export API_URL=http://127.0.0.1:5081

npm run build
docker build -t vgocrush/sknexchange:adminui .
