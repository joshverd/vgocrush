
import React, { Component } from 'react'

import Modal from '../Modal'
import style from './style.scss'

export default class ProvablyFairModal extends Component {
  constructor(props) {
    super(props)
  }

  render() {
    return (
      <Modal visible={this.props.visible} onClose={this.props.onClose} title="Provably Fair">

        <h2>Crash</h2>
        <h3>How it Works</h3>
        <p>We have generated a chain of 10 million SHA256 hashes for each game, starting with a server secret that has been repeatedly fed the output of SHA256 back into itself 10 million times.</p>

        <h3>Verification</h3>
        <p>Anyone can easily verify the integrity of the chain. We're publishing a game's hash immediately after the game ends. By checking that the SHA256 hash of that game's hash is the game's hash of the previous game you can make sure that we were not able to modify the result.</p>
        <p>The sample code to generate games hashes and calculate "Crash" results-based can be found <a href="https://jsfiddle.net/y83x89h2/embedded/result/" target="_blank">here</a>.</p>

        <h2>Jackpot</h2>
        <p>Provably Fair implies that the randoms/outcomes are generated before the betting phase. The outcome cannot be altered/changed in any way.
Therefore, it is proven that the website/admins cannot change the outcome of the wheel after bets have been placed.</p>

        <p className="uk-margin-small-bottom">
        To prove a round is fair, make sure the following equation holds:<br />
        SHA256(RoundSecret) = Hash</p>

        <p>Both Hash and Output are the same, therefore the round is Provably Fair.</p>
        <p>You can test it using any SHA256 hash calculator, such as <a target="_blank" href="http://www.xorbin.com/tools/sha256-hash-calculator">this one</a>.</p>
      </Modal>
    )
  }
}
