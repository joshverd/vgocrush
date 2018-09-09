import r from 'lib/database'
import logger from 'lib/logger'

const time = 1000*60*25;

logger.info("Running cleanup.js");

function start(){
	r.table("ItemListings").delete().then(function(changes){
		logger.info("Item Listings .delete()", changes);
	})
}

start();
setInterval(start,time);