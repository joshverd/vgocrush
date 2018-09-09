import r        from "lib/database";
import logger   from "lib/logger";

/**
 *
 * @type {{targetPlayerIdType: function(*), targetPlayerId: function(), sourcePlayerId: function(), sourcePlayerIdType: function(*)}}
 */
export const logFetcher = {
  targetPlayerIdType: (type)=>{
    return (playerId, skipCount = 0, limitCount = 40)=>{
      return r.table("AuditLogs")
        .between([playerId, type, r.minval],
          [playerId, type, r.maxval],
          {index: "target_playerId__type__createdAt"})
        .orderBy({index: r.desc("target_playerId__type__createdAt")})
        .skip(skipCount)
        .limit(limitCount)
        .run()
      }
  },
  targetPlayerId: ()=> {
    return (playerId, skipCount = 0, limitCount = 40) => {
      return r.table("AuditLogs")
        .between([playerId, r.minval],
          [playerId, r.maxval],
          {index: "target_playerId__createdAt"})
        .orderBy({index: r.desc("target_playerId__createdAt")})
        .skip(skipCount)
        .limit(limitCount)
        .run();
    };
  },
  sourcePlayerId: ()=>{
    return (sourcePlayerId, skipCount = 0, limitCount = 0)=>{
      return r.table("AuditLogs")
        .between([sourcePlayerId, r.minval],
          [sourcePlayerId, r.maxval],
          {index: "source_playerId__createdAt"})
        .orderBy({index: r.desc("source_playerId__createdAt")})
        .skip(skipCount)
        .limit(limitCount)
        .run();
    };
  },
  sourcePlayerIdType: (type)=>{
    return (sourcePlayerId, skipCount = 0, limitCount = 0)=>{
      return r.table("AuditLogs")
        .between([sourcePlayerId, type, r.minval],
          [sourcePlayerId, type, r.maxval],
          {index: "source_playerId__type__createdAt"})
        .orderBy({index: r.desc("source_playerId__type__createdAt")})
        .skip(skipCount)
        .limit(limitCount)
        .run();
    };
  }
};


/**
 * helper function to get a correct fetcher function
 * @param type string
 * @param source string
 * @param action string
 * @returns {function|boolean}
 */
export default function getFetcher(type, source) {
  switch(source) {
    case "any":
      switch(type){
        case "all":
          return logFetcher.targetPlayerId();
        default:
          return logFetcher.targetPlayerIdType(type);
      }

     case "source":
      switch(type){
        case "all":
          return logFetcher.sourcePlayerId();
        default:
          return logFetcher.sourcePlayerIdType(type);
      }

  }
  return false;
}
