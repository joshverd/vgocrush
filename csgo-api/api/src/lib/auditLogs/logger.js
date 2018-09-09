import r                from "lib/database";
import logger           from "lib/logger";
import fetchUser        from "../utils/fetchUser.js";
import uuid             from "uuid/v4";

function getType(req) {
  return req.path.replace(/[^a-zA-Z]/gi, '');
}

function getPlayerId(req) {
  if (req.body.playerId) {
    return req.body.playerId;
  }
  if (req.params.playerId) {
    return req.params.playerId;
  }

  return null;
}

function auditLog(req, id = uuid()){
  return new Promise(async(resolve, reject)=>{
    const sourceUser = {
      playerId      : req.user.id,
      admin         : req.user.admin,
      avatar        : req.user.avatar,
      displayName   : req.user.displayName
    };
    const playerId    = getPlayerId(req);
    if (!playerId) { return reject('no player Id specified in the request') }
    const targetUser  = await fetchUser(playerId, true);

    return resolve({
      id,
      createdAt     : r.now(),
      type          : getType(req),
      source: sourceUser,
      target: targetUser,
      data: req.body
    });
  });

}

export default function(req){
  return new Promise(async(resolve, reject)=>{
    try {
      r.table("AuditLogs")
        .insert(await auditLog(req))
        .run()
        .then(result => {
          if(result.inserted !==1){
            return resolve(false);
          }
          resolve(true);
        }).catch((e) => {
          resolve(true)
        })
    } catch(e) {
      resolve(true)
    }
  })

  .catch(console.log)
}
