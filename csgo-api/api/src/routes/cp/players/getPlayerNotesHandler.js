import r        from "lib/database";
import logger   from "lib/logger";

function fetchNotes(playerId, limitCount = 0, skipCount = 0){
  return r.table("PlayerNotes")
    .between([playerId, r.minval],  [playerId, r.maxval], {index: "playerId__createdAt"})
    .orderBy({index: r.desc("playerId__createdAt")})
    .skip(skipCount)
    .limit(limitCount)
    .run();
}


function validateRequest(req){
  let validationResult = {valid: true, skip: 0, limit: 50};
  if(!req.params || !req.params.playerId ){
    return {success: false, playerId: 0, message: "missing parameter player_id"};
  }
  validationResult.playerId = req.params.playerId;
  if(req.query.skip && isNaN(parseInt(req.query.skip))){
    validationResult.skip = parseInt(req.query.skip, 10);
  }
  if(req.query.limit && isNaN(parseInt(req.query.limit, 10))){
    validationResult.limit = parseInt(req.query.limit, 10);
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
      console.log(validationResult.playerId, validationResult.limit, validationResult.skip)
      const notes = await fetchNotes(validationResult.playerId, validationResult.limit, validationResult.skip);
      console.log(notes);
      return resolve({notes });
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
      logger.error('GET /__cp/players/notes', error.playerId, error.error);
      res.status(400).send(error.message);
    });
};