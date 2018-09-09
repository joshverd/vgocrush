import r from '../lib/database'

let request		= require("request");
let q 			= require("q");
let moment 		= require("moment");

const OurItems	= r.db("sknexchange").table("Items");

var authKey 		= process.env.KEY || "";
var OPSkinsAPI = require('@opskins/api');
var opskins = new OPSkinsAPI(authKey);

var ourItemsList;
var opPricesMap;

function getOurItems(){
	var deferred = q.defer();

	OurItems.then(function(data){
		console.log("Fetched Our Items..")
		deferred.resolve(data);
	})

	return deferred.promise;
}

function getOPPrices(){
	var deferred = q.defer();

	opskins.getPriceList(1912, function(err,res){
		console.log("Fetched OP Prices..")
		deferred.resolve(res);
	})

	return deferred.promise;
}

function getMeanPrice(row){
	if(!row) return 0;
	var d1 = row[moment().subtract(1,"days").format('YYYY-MM-DD')];
	if(!d1) return 0;
	var d2 = row[moment().subtract(2,"days").format('YYYY-MM-DD')];
	if(!d2) return 0;
	var d3 = row[moment().subtract(3,"days").format('YYYY-MM-DD')];
	if(!d3) return 0;
	var d4 = row[moment().subtract(4,"days").format('YYYY-MM-DD')];
	if(!d4) return 0;
	var d5 = row[moment().subtract(5,"days").format('YYYY-MM-DD')];
	if(!d5) return 0;
	
	var total = d1.normalized_mean+d2.normalized_mean+d3.normalized_mean+d4.normalized_mean+d5.normalized_mean;
	var mean = total / 5;

	return mean;
}

function roundNumber(n){
	return Math.round(n * 100) / 100;
}

function init(){
	getOurItems().then(function(d){
		ourItemsList = d;
		getOPPrices().then(function(s){
			opPricesMap = s;
			start();
		})
	})
}

var itemIndex = 0;
var blockedCount = 0;
var updatedCount = 0;
function start(){
	function loop(){
		console.log("Current Index: "+itemIndex);
		var currentItem 	= ourItemsList[itemIndex];
		var currentPricing 	= opPricesMap[ourItemsList[itemIndex].name];
		var meanSoldAt 		= getMeanPrice(currentPricing);

		var soldAtUSD = roundNumber(meanSoldAt/100);
		var userPriceUSD = roundNumber((meanSoldAt*1.27)/100)

		if(meanSoldAt == 0) {
			OurItems.get(currentItem.id).update({
				blocked:true
			}).run().then(function(res){
				console.log(res)
			})
			// console.log(`Blocked index ${itemIndex}`)
			blockedCount++
		} else {
			OurItems.get(currentItem.id).update({
				blocked:false,
				soldAt: soldAtUSD,
				price: userPriceUSD
			}).run();
			updatedCount++;
			// console.log(`Updated Index ${itemIndex} from price ${currentItem.price} to ${userPriceUSD}, sell price of ${soldAtUSD}`);
		}
		console.log(`Blocked Count: ${blockedCount} -- Updated Count: ${updatedCount}`)
		
		setTimeout(function () {    
			itemIndex++;    
			if (itemIndex != ourItemsList.length -1) {            
				loop();
			} else {
				console.log("Finished!");
			}       
		}, 20)
	}
	loop()
}

init();
