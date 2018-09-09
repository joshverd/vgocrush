# csgoapi

##Dependencies

### Sknexchange 
To perform operations related to Opskins and WAX Express Trade you will need the sknexchange API running. Make sure you follow the steps from the sknexchange README file

### RethinkDB
Needs the "csgoapi" DB to migrate the needed tables and sknexchange database from skne repository

###Redis
Uses to Redis to store the user session, chat history, etc.

## Set Up development environment
Follow the sknexchange README.md and then continue with this one.
You can use docker and docker-compose to provide the needed dependencies or install them manually. The dockerfile is the same one required for running the sknexchange app

### Database
Create a database called 'csgoapi' in RethinkDB

##Configurations
####Sknexchange ApiKey
In order to make requests to the sknexchange API you will need a valid ApiKey.
This ApiKey should be present in the table ApiKeys on the sknexchange Database. Follow the steps in the sknexchange README file to create a new ApiKey.
Add this ApiKey to sknexchange.apiKey one the config/default.json file 

####Sknexchange RpcKey
In order to make requests to the sknexchange RCP server you will need a valid RpcKey.
This ApiKey should match the one on the app.rpcKey key on the config/default.json in sknexchange.
Add this ApiKey to sknexchange.rpcKey one the api/config/default.json file.

####Steam apikey
To be able to get users Profile info from steam, you will need to add a valid steam apikey to ```api/config/default.json``` (steam.apiKey)

##### Build docker images
Run ```./build.sh```

Create a docker-compose.yml file and put the following content

```
version: '3.5'
services:
  csgo-api:
    image: vgocrush/csgo:api
    ports:
      - 9000:9000
    command: node_modules/.bin/babel-watch dist/index.js
    environment:
      - NODE_ENV=docker
networks:
  default:
      external:
        name: vgocrush-network
```

Run ```docker-compose up -d``` to start the csgo api, this will create all the tables in the database. You can check it on ```http://localhost:8080``` under tables tab

##Plugins

###Chat
Add the following content to add the chat server, then run ```docker-compose up -d``` to start it
```
version: '3.5'
services:
  csgo-api:
    image: vgocrush/csgo:api
    ports:
      - 9000:9000
    command: node_modules/.bin/babel-watch dist/index.js
    environment:
      - NODE_ENV=docker
  csgo-chat:
    image: vgocrush/csgo:api
    ports:
      - 9001:9001
    command: node_modules/.bin/babel-watch dist/plugins/chat/server.js
    environment:
      - NODE_ENV=docker
networks:
  default:
      external:
        name: vgocrush-network
```
Make sure to include ```"chat"``` in the configuration, under ```plugins.enabled``` array.

###Crash
This plugin runs the bet game, it will use sockets to communicate to the clients all the events related to the bet, starting new game, endgame, updates, cashout, etc.

####Populate
Before running the crash plugin we will need to populate the hashes.
The script under ```src/plugins/crash/populate.js``` will generate the hashes needed to run the bets.

Make sure you do the following before running the crash plugin (this needs to be done only once)

Go to ```api/``` and run
```
npm run populate
```

To run the crash plugin add the following content to the docker-compose.yml file, then run ```docker-compose up -d```
```
version: '3.5'
services:
  csgo-api:
    image: vgocrush/csgo:api
    ports:
      - 9000:9000
    command: node_modules/.bin/babel-watch dist/index.js
    environment:
      - NODE_ENV=docker
  csgo-crash:
    image: vgocrush/csgo:api
    ports:
      - 8889:8889
    command: node_modules/.bin/babel-watch dist/plugins/crash/run.js
    environment:
      - NODE_ENV=docker
  csgo-chat:
    image: vgocrush/csgo:api
    ports:
      - 9001:9001
    command: node_modules/.bin/babel-watch dist/plugins/chat/server.js
    environment:
      - NODE_ENV=docker
networks:
  default:
      external:
        name: vgocrush-network
```
Make sure to include ```"crash"``` in the configuration, under ```plugins.enabled``` array.

####Generate FAQs
Generate faqs for the ui.

Go to ```api/```

Run ```npm run generateFAQs```

 ####Continue with vgocrush ui project