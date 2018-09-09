
import { toast } from 'react-toastify'
import store from 'store'

export default (url, fetchOpts = {}, opts = {}) => {
  const { server } = store.getState()

  fetchOpts.credentials = 'include'

  if(typeof fetchOpts.body === 'object') {
    fetchOpts.method = 'POST'
    fetchOpts.headers = {
      ...(fetchOpts.headers || {}),
      'Content-Type': 'application/json'
    }

    fetchOpts.body = JSON.stringify(fetchOpts.body)
  }

  if(url.indexOf('api/') < 0) {
    url = '/api/' + url
  }

  const qs = fetchOpts.qs || {}

  if(!!fetchOpts.qs) {
    delete fetchOpts['qs']
  }

  if(!!server.token) {
    qs.token = server.token
  }

  const queryString = Object
    .keys(qs)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(qs[k]))
    .join('&')

  return fetch(`${API_URL}${url}?${queryString}`, fetchOpts)
    .then(response => {
      if(response.status !== 200) {
        return response.text().then(txt => {

          if(!opts.disableToast) {
            toast.error(txt)
          }

          return Promise.reject(response)
        })
      }

      return response.json()
    })
}
