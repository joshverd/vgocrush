
export default store => next => action  => {
  if(action.type == "@@router/LOCATION_CHANGE") {
  	// if(ga) {
  	// 	ga('send','page', "/"+action.payload.pathname);
  	// 	console.log("SENT GA")
  	// }
  }
  return next(action)
}
