skne_container = vgocrush/sknexchange-admin-ui

build:
	npm run build:docker

docker-build: build
	docker build -t $(skne_container) .

run-admin-ui:
	npm start