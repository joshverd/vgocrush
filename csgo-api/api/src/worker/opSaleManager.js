import r from '../lib/database'
import logger from 'lib/logger'
import redis from 'lib/redis'

let request			= require("request");
let q 				= require("q");
let moment			= require("moment");

var authKey 		= process.env.KEY || "";
var minToWithdraw	= (parseInt(process.env.MIN_WITHDRAW)*100) || 300000;

var OPSkinsAPI = require('@opskins/api');
var opskins = new OPSkinsAPI(authKey);

var lowest_prices = null;
var current_sales = null;
var cacheItems = {};

function init(){
	logger.info("init()");
	opskins.getLowestPrices("730", function(err,prices){
		lowest_prices = prices;
		opskins.getSales({
			type: 2
		}, function(err,pages,sales){
			current_sales = sales;
			seek();
		})
	})
}

function filterList(list){
	var deferred = q.defer();
	var index = 0;
	var removed = 0;

	function go() {
		var listItem = list[index];
		if(!listItem) {
			console.log("Total Skipped Since Updated Earlier: "+removed)
			return deferred.resolve(list);
		}
		redis.get('priceChangeOP-'+listItem.id, function(err,data){
			if(data) {
				// console.log("removed item id "+listItem.id+" with filter");
				removed++;
				list.splice(index,1);
				go();
			} else {
				index++;
				go();
			}
		})

		// index++;
		// go();
	}
	go()

	return deferred.promise;
}

function determinePriceUpdates(list) {
	var newPrices = {};
	var count = 0;
	var totalListedForSale = 0;
	var smallItems = 0;
	for(var i = 0; i < list.length; i++){
		if(list[i].price < 3) smallItems++;
		totalListedForSale += list[i].price;


		var twelveSinceList = moment().subtract(12,"hours").toISOString() > moment.unix(list[i].list_time).toISOString();
		var threeSinceUpdate = moment().subtract(3,"hours").toISOString() > moment.unix(list[i].last_updated).toISOString();
		var sinceUpdate24 = moment().subtract(24,"hours").toISOString() > moment.unix(list[i].last_updated).toISOString();


		if(threeSinceUpdate && list[i].price != 2) { //if its been 3 hours since we last updated this item
			var counted = false
			if(lowest_prices[list[i].name].price < list[i].price && count < 450) { //check if the current list price is greater than the lowest item price
				//up to lowest
				newPrices[list[i].id] = Math.max(2,lowest_prices[list[i].name].price);
				// logger.info(`Changing item ${list[i].id} from ${list[i].price} to ${lowest_prices[list[i].name].price}`);
				redis.set('priceChangeOP-'+list[i].id, "true", 'EX', 60*60);

				if(!counted)  {counted=true;count++}
			}
			if(twelveSinceList && sinceUpdate24 && count < 450) { //if been 12 hours since listed && 12 hours since updated
				//update to 95% of lowest
				// logger.info(`Changing item ${list[i].id} from ${list[i].price} to ${parseInt(lowest_prices[list[i].name].price * 0.98)}`);
				newPrices[list[i].id] = Math.max(2, parseInt(lowest_prices[list[i].name].price * 0.98));
				redis.set('priceChangeOP-'+list[i].id, "true", 'EX', 60*60);

				if(!counted)  {counted=true;count++}
			}
		}
	}
	logger.info(`Total listed for sale: $${totalListedForSale/100}`)
	logger.info(`Total small items for sale: ${smallItems}`)
	return {prices: newPrices, count: count};
}

function seek(){
	logger.info(`Checking through ${current_sales.length} listed sales..`);
	filterList(current_sales).then(function(filtered_sales){
		var updates = determinePriceUpdates(filtered_sales)
		console.log(updates.prices)
		return
		logger.info(`There are ${updates.count} we need to edit prices for.`);
		if(updates.count > 0) {
			opskins.editPrices(updates.prices, function(err){
				if(err) {
					logger.info(err);
					restart()
				}
				else {
					logger.info("Successfully updated!");
					restart()
				}
			})
		} else {
			restart()
		}
	})
}

function restart() {
	logger.info("Checking again in 10 seconds..")
	setTimeout(function(){
		lowest_prices = null;
		current_sales = null;
		init()
	},10000);
}

init()
