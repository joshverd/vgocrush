# sknejs

## Dependencies
### RethinkDB
needs the "sknexchange" DB to migrate the needed tables

###RabbitMQ
Uses rabbitMQ to trigger different functionalities of the system, e.g. Notify trade offers changes, deposit, withdraw

###Redis
Uses to Redis to cache items inventory, toggles...

## Set Up development environment with docker
You can use docker and docker-compose to provide the needed dependencies or install them manually

####Networking
Crate a docker network to allow different containers to communicate between them.
Run the following command to create the network

```docker network create --driver=bridge vgocrush-network```

####Dependencies
Create a file called docker-compose.yml with this content outside the `sknejs` project folder

```
version: '3.5'
services:
  redis:
    image: redis
    ports: 
      - 6379:6379
  rethinkdb:
    image: rethinkdb
    ports:
      - 28015:28015
      - 8080:8080
    volumes:
      - $PWD:/data
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - 5672:5672
      - 15672:15672
networks:
  default:
      external:
        name: vgocrush-network
```

Run this file with ```docker-compose up```

####Initial state and Database
Go to localhost:8080 and create database named "sknexchange" in RethinkDB

####Install dependencies
Run ```npm install```

####Encryption
Passwords and keys will be saved encrypted in the Database. For that we will need to generate encryption keys.
Run
 ```npm run generateCertificate```
to generate a new pair of keys.

####Build the docker image for skne
Then run ```npm run build``` to build the project.

Then run ```docker build -t vgocrush/sknexchange .``` to create the docker image

Create a docker-compose.yml file and put the followin content

```
version: '3.5'
services:
  skne-api:
    image: vgocrush/sknexchange
    ports:
      - 5080:5080
    command: node_modules/.bin/babel-watch dist/index.js
    environment:
      - NODE_ENV=docker
networks:
  default:
      external:
        name: vgocrush-network
```

Run ```docker-compose up -d``` to start the skne api, this will create all the tables in the database.

####ApiKeys
You need to create an API Key for other apps to be able to make requests to this application. You can create a new one (needed for the docker set up) running ``` npm run apikeys -- --apiKey=a```

###Bots
Skne will need bots configured in the Database to perform actions. You can create a bot with the script `create-bot` with the following command

```npm run createBot -- --identifier=vgocrush-bot --apiKey=${aValidOpskinsApiKey}```

You will need the TOTP secret of the bot that owns the apiKey provided to get a functional bot.
Set the secret on the docker-compose.yml file under ```environment``` for ```skne-opskins-worker```

##Workers
###Opskins Worker
This worker is in charge of managing Opskins functionality like deposit items, send trade offers, purchase items, withdraw items, etc.
Add the following content to run the opskins worker

Make sure you replace ```aValidSecretOfTheBotCreatedEarlier``` with the TOTP secret of the bot created before.

```
version: '3.5'
services:
  skne-api:
    image: vgocrush/sknexchange
    ports:
      - 5080:5080
    command: node_modules/.bin/babel-watch dist/index.js
    environment:
      - NODE_ENV=docker
  skne-opskins-worker:
      image: vgocrush/sknexchange
      command: node_modules/.bin/babel-node dist/worker/opskins.js --bot=vgocrush-bot
      environment:
        - NODE_ENV=docker
        - OP_TOTP=aValidSecretOfTheBotCreatedEarlier
networks:
  default:
      external:
        name: vgocrush-network
```

Start the worker running ```docker-compose up -d```

## Prices
### src/prices.js
You need a bot with Opskins functionality in the Database to update the prices and the items in the Database

Use this file to update the prices(block items too) in the database.

1. Get VGO items from Opskins
2. Get VGO Prices from OPSkins
3. Update ```sknexchange.Items``` table with VGO items

Configuration needed:
 - skne database
 - A valid Opskins API key in ```config/default.json```, value of ```prices.opskinsApiKey```
 
 run this script with ``` npm run prices```
 
 ####Continue with csgoapi project