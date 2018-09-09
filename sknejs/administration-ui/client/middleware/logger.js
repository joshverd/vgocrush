
export default store => next => action  => {
  console.log('store', action)
  return next(action)
}
