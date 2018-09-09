
export function hideLoader(instant = false) {
  const loader = document.getElementById('loader')

  if(loader) {
    loader.classList.add('finished')

    setTimeout(() => {
      if(loader !== null) {
        loader.remove()
      }
    }, 5000)
  }
}
