import r        from "lib/database";
import logger   from "lib/logger";
import getFetcher from "../../../lib/auditLogs/logFetcher.js";

function validateRequest(req){
  let validationResult = {valid: true, skip: 0, limit: 50};

  if(!req.params || !req.params.playerId ){
    return {
      valid       : false,
      playerId    : 0,
      message     : "missing parameter player_id"};
  }
  validationResult.playerId = req.params.playerId;

  if(!req.params.type){
    validationResult.type = null;
  }


  const validSources = ["any", "source"];
  if(!req.params.source){
    validationResult.source = "any";
  }else{
    if(validSources.filter(source => (source === req.params.source)).length === 0){
      return {
        valid       : false,
        playerId    : validationResult.playerId,
        message     : "invalid parameter source"
      };
    }
    validationResult.source = req.params.source;
  }

  validationResult.fetcher = getFetcher(validationResult.type, validationResult.source);

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
      const logs = await validationResult.fetcher(validationResult.playerId,
        validationResult.limit,
        validationResult.skip);

      return resolve({logs});
    }catch(error){
      const message = "error fetching user notes";
      reject({message, error});
    }
  });
}

export default (req, res) =>{
  processRequest(req)
    .then(result=>{
      res.json(result);
    })
    .catch(error =>{
      logger.error('GET /__cp/players/audit_logs', error.playerId, error.error);
      res.status(400).send(error.message);
    });
};
