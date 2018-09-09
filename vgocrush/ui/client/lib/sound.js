
export default class Sound {
  constructor(url) {
    this.url = url
    this.audio = new Audio(url)
    this.audio.volume = 0.01

  }

  play() {
    this.audio.currentTime = 0
    // this.audio.play()
  }

  clone() {
    return new Sound(this.url)
  }
}

export const snipeSounds = [
  new Sound(require('assets/sound/snipe/1.mp3')),
  new Sound(require('assets/sound/snipe/2.mp3')),
  new Sound(require('assets/sound/snipe/3.mp3')),
  new Sound(require('assets/sound/snipe/4.mp3'))
]

export const tickSound = new Sound(require('assets/sound/tick.mp3'))
export const wooshSound = new Sound(require('assets/sound/woosh.mp3'))
export const reloadSound = new Sound(require('assets/sound/reload.mp3'))
export const coinSound = new Sound(require('assets/sound/coin.mp3'))
