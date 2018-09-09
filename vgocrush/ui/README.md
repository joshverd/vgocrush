# VgoCrush UI

##Dependencies
VgoCrush UI depends on csgoapi, csgo-crash and csgo-chat. Make sure you follow the steps on the readme file for the csgoapi project to get all this running.

## Build the docker image for the VgoCrush UI
Go to ```/ui```

run ```npm install```

execute ```./build.sh``` to execute the script that will build the docker image

## Run the project
execute ```docker-compose up -d``` . This will run the docker image.
Go to ```http://localhost:7012``` to see the app running.