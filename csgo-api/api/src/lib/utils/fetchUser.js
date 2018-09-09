import r        from "lib/database";

export default function(playerId, short = false){
  let query =  r.table("Player").get(playerId);
  if(short){
    query = query.do( user => {
     return {
        playerId      : user("id"),
        displayName   : user("displayName"),
        avatar        : user("avatar"),
        admin         : user("admin").default(false)
      };
    });
  }
  return query.run();
}