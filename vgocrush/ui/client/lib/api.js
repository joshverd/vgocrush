
import { toast } from 'react-toastify'

export default (url, options = {}) => {
  url = `${API_URL}/api/${url}`
  options.credentials = 'include'
  if(!!options.body) {
    options.method = 'POST'
    options.headers = {
      ...(options.headers || {}),
      'Content-Type': 'application/json'
    }

    options.body = JSON.stringify(options.body)
  }

  return fetch(url, options)
    .then(response => {
      if(response.status !== 200) {
        return response.text().then(txt => {

          toast(txt)
          // ui.notification({
          //   message: txt,
          //   status: 'danger'
          // })

          return Promise.reject(response)
        })
      }

      return response.json()
    })
    .then(response => {
      if(!!response.error) {
        return Promise.reject(response.error)
      }

      return response.result || response
    })

    .catch(err => {
      // ui.notification({
      //   status: 'error',
      //   message: !!err ? err.message || err : 'Please try again later'
      // })

      return Promise.reject(err)
    })
}
