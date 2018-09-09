
import React, { Component } from 'react'
import moment from 'moment'
import pad from 'pad'

export default class FromNow extends Component {
  constructor(props) {
    super(props)

    this.state = {
      to: null,
      running: false,
      text: ''
    }
  }

  componentDidMount() {
    this._startCountDown()
  }

  componentWillUnmount() {
    if(this.interval) {
      clearInterval(this.interval)
    }
  }

  componentWillReceiveProps(nextProps) {
    if(this.props.date !== nextProps.date) {
      this.updated = true
    }
  }

  componentDidUpdate() {
    if(this.updated) {
      this.updated = false
      this._startCountDown()
    }
  }

  render() {
    const { running, text } = this.state

    return (
      <span>{text}</span>
    )
  }

  _startCountDown() {
    if(!this.props.date) {
      return
    }

    if(this.interval) {
      clearInterval(this.interval)
    }

    const to = moment(this.props.date)
    this.last = this.props.date

    const tick = () => {
      this.setState({
        running: true,
        text: this._format(to)
      })
    }

    tick()
    this.interval = setInterval(tick, 25)
  }

  _format(date) {
    return to.fromNow()
  }
}
