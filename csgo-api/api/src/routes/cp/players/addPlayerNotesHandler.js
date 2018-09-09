import r        from "lib/database";
import logger   from "lib/logger";

function insertNote(note){
  return r.table("PlayerNotes")
    .insert(note)
    .run();
}

function fetchNotes(playerId){
  return r.table("PlayerNotes")
    .between([playerId, r.minval],[playerId, r.maxval],{index: "playerId__createdAt"})
    .orderBy({index: r.desc("playerId__createdAt")})
    .limit(40)
    .run();
}

function validateRequest(req){
  let validationResult = {
    valid       : true,
    skip        : 0,
    limit       : 50,
    topic       : null,
    message     : null
  };
  if(!req.params || !req.params.playerId ){
    return {valid: false, playerId: 0, message: "missing parameter playerId"};
  }
  validationResult.playerId = req.params.playerId;
  if(!req.user){
    return {valid: false,  message: "missing parameter req.user.admin"};
  }
  validationResult.user = {
    playerId      : req.user.id,
    admin         : req.user.admin,
    avatar        : req.user.avatar,
    displayName   : req.user.displayName
  };
  if(!req.body.content || typeof req.body.content !== "string" || req.body.content.length  < 2){
    return {valid: false,  message: "missing or faulty parameter req.body.content"};
  }
  validationResult.content  = req.body.content.trim();

  if(req.body.topic){
    validationResult.topic  = req.body.topic;
  }

  if(req.query.skip){
    validationResult.skip   = req.query.skip;
  }
  if(req.query.limit){
    validationResult.limit  = req.query.limit;
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
      const note = {
        playerId    : validationResult.playerId,
        createdAt   : r.now(),
        topic       : validationResult.topic,
        content     : validationResult.content,
        createdById : validationResult.user.playerId,
        createdBy   : validationResult.user
      };
      console.log(note);
      const result = await insertNote(note);
      console.log(result);
      if(result.inserted !== 1){
        return reject({message: "unknown - possibly db related - error, failed to insert"});
      }
      let notes = await fetchNotes(note.playerId);

      return resolve({notes });
    }catch(error){
      const message = "error adding user notes";
      return reject({message, error});
    }
  });
}

export default (req, res) =>{

  processRequest(req)
    .then(result=>{
      res.json(result);
    })
    .catch(error =>{
      logger.error('POST /cp/players/notes', error.playerId, error.error);
      console.log(error)
      res.status(400).send(error.message);
    });
};
