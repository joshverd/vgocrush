import r from './database'
import moment from 'moment'

var t = {};

//insert:
//id: timestamp-uid-ip
//userid: req.user.id
//ip: ip
//source: "postback/accountGet/withdrawal/accountCreate"

export const ipLogger = function(req,res,next){
	var ip = req.headers["cf-connecting-ip"] || "1";
	if(ip == "1") return next();
	var uid = (req.user ? req.user.id : false);
	var source = req.route.path || false;
	var timestamp = moment().toISOString() || false;
	if(!ip || !uid || !source || !timestamp) return next();

	r.table("PlayerIp").insert({
		timestamp: r.now(),
		playerId: uid,
		ip: ip,
		source: source,
		query: req.query,
		body: req.body
	}).run();

	next();
}