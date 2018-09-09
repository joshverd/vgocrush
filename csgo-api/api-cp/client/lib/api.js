
import { toast } from 'react-toastify'

export default (url, opts = {}) => {
  console.log('testing')
  opts.credentials = 'include'

  if(typeof opts.body === 'object') {
    opts.method = 'POST'
    opts.headers = {
      ...(opts.headers || {}),
      'Content-Type': 'application/json'
    }

    opts.body = JSON.stringify(opts.body)
  }

  if(url.indexOf('api') < 0) {
    url = '/__cp/' + url
  }

  console.log('fetch')
  return fetch(`${API_URL}${url}`, opts)
    .then(response => {
      if(response.status !== 200) {
        return response.text().then(txt => {

          toast.error(txt)

          return Promise.reject(response)
        })
      }

      return response.json()
    })
}
