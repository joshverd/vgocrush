cd api
npm install
npm run build

cd ../
docker build -t vgocrush/csgo:api-base -f Dockerfile-base .
docker build --no-cache -t vgocrush/csgo:api .