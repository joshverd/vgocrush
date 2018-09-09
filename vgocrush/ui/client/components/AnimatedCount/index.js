
import React, { Component } from 'react'
import { Tween, easing } from 'mo-js'
import numeral from 'numeral'

export default class AnimatedCount extends Component {
  static defaultProps = {
    style: {}
  }

  constructor(props) {
    super(props)

    this._lastValue = (typeof props.initial === 'undefined' || props.initial) ? props.value : 0
    this.state = {
      value: numeral(this._lastValue).format(props.format || '0,0')
    }
  }

  componentDidMount() {
    this._animate(this.props.value)
  }

  componentDidUpdate(prevProps) {
    if(this.props.value !== prevProps.value) {
      this._animate(this.props.value)
    }
  }

  componentWillUnmount() {
    if(this._animation) {
      this._animation.stop()
    }
  }

  render() {
    const spanStyle = {
      fontFamily: "proxima-nova, sans-serif",

      ...this.props.style
    }

    return (
      <span style={spanStyle}>{this.state.value}</span>
    )
  }

  _animate(value) {
    if(value === this._lastValue) {
      return
    }

    if(this._animation) {
      this._animation.stop()
    }

    const startValue = this._lastValue
    const diff = value - this._lastValue

    this._animation = jQuery({
      value: startValue
    }).animate({
      value
    }, {
      duration: this.props.duration,
      step: value => {
        this._lastValue = value
        this.setState({ value: numeral(value).format(this.props.format || '0,0') })
      },
      complete: () => this.setState({ value: numeral(value).format(this.props.format || '0,0') })
    })

    setTimeout(() => {
      this.setState({ value: numeral(value).format(this.props.format || '0,0') })
    }, this.props.duration)

    this._lastValue = value
  }
}
