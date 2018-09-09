import r from '../lib/database'

let request		= require("request");
let q 			= require("q");

const Prices	= r.db("sknexchange_vgocrush").table("Items");
const Items     = r.db("vgocrush").table("AvailableItems");

var key 		= "";//
var api 		= "https://api.opskins.com/ISales/Search/v1/";

const INTERVAL  = process.env.INTERVAL || 15000;

// function determineMaxPrice(price){
// 	var modifier = 0.70;
// 	if(price > 1) modifier = 0.75;
// 	if(price > 500) modifier = 0.80;
// 	return price*modifier;
// }
function determineMaxPrice(price){
	var maxPrice = price*0.70;

	if(price > 1) {
		maxPrice = price*0.75
	}
	if(price > 2) {
		maxPrice = price*0.78
	}
	if(price > 10) {
		maxPrice = price*0.80
	}
	if(price > 100) {
		maxPrice = price*0.85
	}
	return maxPrice;
}

function getAmountOnSale(name,price){
	var deferred = q.defer();

	var props = {
		app: `1912_1`,
		search_item: `"${name}"`,
		key: key,
		max: determineMaxPrice(price)
	}
	request({url:api, qs:props, timeout: 10000}, function(err, response, body) {
		if(err) return deferred.reject();
		try {
			body = JSON.parse(body);
		} catch(err){
			deferred.reject();
		}
		if(!body || !body.response || body.status != "1") {
			console.log(body);
			return deferred.reject();
		}
		deferred.resolve(body.response.sales.length);
	});

	return deferred.promise;
}


function getPriceOfItem(name){
	var deferred = q.defer();

	Prices.getAll(name,{index:'name'}).then(function(d){
		if(d.length == 1) {
			var price = d[0].basePrice;
			price = parseFloat(price.toFixed(2));
			deferred.resolve(price);
		}
		else deferred.reject();
	})

	return deferred.promise;
}

function inStock(name){
	var deferred = q.defer();

	getPriceOfItem(name).then(function(price){
		getAmountOnSale(name,price).then(function(count){
			if(price > 100 && count >= 3) deferred.resolve(count);
			else if(count > 5) deferred.resolve(count);
			else deferred.reject(count);
		}, function(){
			deferred.reject(null);
		})
	}, function(){
		deferred.reject(null);
	})

	return deferred.promise;
}

function getAllItems(){
	var deferred = q.defer();
	Items.pluck("name").then(function(allItems){
		deferred.resolve(allItems);
	})
	return deferred.promise;
}

var inStockCount = 0;
var notInStockCount = 0;
var retryCount = 0;
var done = false;
function start(items,currentIndex){
	if(currentIndex == items.length-1) {
		done = true;
		return console.log(`Seeked through ${items.length} items!`);
	}
	currentIndex++;
	var currentItemName = items[currentIndex].name;
	console.log(`inStockCount: ${inStockCount} - notInStockCount: ${notInStockCount}`);
	console.log(`Checking: ${currentItemName}`);
	setTimeout(function(){
		inStock(currentItemName).then(function(count){
			console.log("In Stock.");
			start(items,currentIndex);
			inStockCount++;
			Items.filter({name: currentItemName}).update({
				inStock: true,
				count: count
			}).run()
		}, function(count){
			if(count != 0 && !count && retryCount < 3) {
				console.log("Retrying..");
				retryCount++;
				return start(items,--currentIndex);
			}
			retryCount = 0;
			console.log("Not In Stock.");
			start(items,currentIndex);
			notInStockCount++;
			Items.filter({name: currentItemName}).update({
				inStock: false,
				count: count
			}).run()
		});
	},INTERVAL)
}

getAllItems().then(function(items){
	inStockCount = 0;
	notInStockCount = 0;
	retryCount = 0;
	start(items,-1);
})

setInterval(function(){
	if(done) {
		getAllItems().then(function(items){
			inStockCount = 0;
			notInStockCount = 0;
			retryCount = 0;
			start(items,-1);
		})
	}
},60000*60)