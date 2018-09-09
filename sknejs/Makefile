skne_container = vgocrush/sknexchange

build:
	npm run build

docker-build: build
	docker build -t $(skne_container) .

run-api:
	npm start

run-admin-api:
	npm run start:admin