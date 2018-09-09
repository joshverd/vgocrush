import r        from "lib/database";
import logger   from "lib/logger";
import config   from "config";

function fetchLargestInventories(limitCount = 20, skipCount = 0){
  return r.table("PlayerItems")
    .filter(r.and(r.row.hasFields("type"), r.row("type").eq("gift")).not())
    .merge({price: r.db(config.sknexchange.database)
        .table("Items")
        .getAll(r.row("name"), {index: "name"})
        .nth(0)("depositPrice") })
    .group("playerId")
    .sum("price")
    .ungroup()
    .orderBy(r.desc("reduction"))
    .skip(skipCount)
    .limit(limitCount)
    .map(invent => {
      return {
        value: r.round(invent("reduction").mul(100)).div(100),
        user: r.table("Player")
          .get(invent("group"))
          .pluck("displayName", "id", "totalDeposit", "tradeUrl", "avatar", "lockWithdraws")
      };
    })
    .run();
}


function validateRequest(req){
  let validationResult = {valid: true, skip: 0, limit: 20};
  if(req.query.skip){
    validationResult.skip = req.query.skip;
  }
  if(req.query.limit){
    validationResult.limit = req.query.limit;
  }
  return validationResult; 
}

function processRequest(req){
  return new Promise(async(resolve, reject)=>{
    const validationResult = validateRequest(req);
    if(!validationResult.valid){
      return reject({message: `invalid request, ${validationResult.message}`});
    }
    try{
      const inventories = await fetchLargestInventories(validationResult.limit, validationResult.skip);
      return resolve({inventories});
    }catch(error){
      const message = "error fetching user inventories";
      reject({message, error});
    }
  });
}

export default (req, res) =>{
  console.log(req.user);
  processRequest(req)
    .then(result=>{
      res.json(result);
    })
    .catch(error =>{
      logger.error('GET /cp/stats/largest_inventories', error.playerId, error.error);
      res.status(400).send(error.message);
    });
};