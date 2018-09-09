
import _ from 'underscore'

export function chunk(array,chunkSize) {
	return _.reduce(array, (reducer, item, index) => {
		reducer.current.push(item)

		if(reducer.current.length === chunkSize || index + 1 === array.length) {
			reducer.chunks.push(reducer.current)
			reducer.current = []
		}

		return reducer
	}, {
    current:[],
    chunks: []
  }).chunks
}

export function merge(obj, obj2) {
	obj = Object.assign({}, obj)

	for(let p in obj2) {
		if(typeof obj2[p] === 'object' && !Array.isArray(obj2[p])) {
			obj[p] = !!obj[p] ? merge(obj[p], obj2[p]) : obj2[p]
			continue
		}

		obj[p] = obj2[p]
	}

	return obj
}
