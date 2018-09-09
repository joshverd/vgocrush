
import React from 'react'
import anime from 'animejs'

import BetBlock from './BetBlock'
import EntrySpinner from './EntrySpinner'
import Players from './Players'
import PlayerChance from './PlayerChance'
import style from './style.scss'

export default class Jackpot extends React.Component {

  constructor(props) {
    super(props)

    this.state = {}
  }

  render() {
    const { currentGame } = this.props
    const { entries } = currentGame

    const blocksHeight = ((entries.length + 1) * 105) + 25

    return (
      <div className={style.container}>
        { (currentGame.stage === 'InProgress' || currentGame.stage === 'Over') ? <EntrySpinner active={currentGame} onShow={this.props.onShowSecret} /> : null }

        <Players chances={currentGame._playerChances} />

        { !!currentGame._playerChance ? <PlayerChance chance={(currentGame._playerChance.chance * 100).toFixed(2)} /> : null }
        <div className={style.betBlocksWrapper}>
          <div className={style.betBlocks} style={{ height: blocksHeight }}>

            {entries.map((entry, idx) =>
              <BetBlock key={entry.id} entry={entry} index={idx} dim={!!currentGame._focusedEntries && currentGame._focusedEntries.indexOf(idx) < 0} />
            )}

            <BetBlock
              initialBlock
              primaryColor={currentGame.primaryColor}
              hash={currentGame.hash}
              index={entries.length}
              dim={!!currentGame._focusedEntries} />
          </div>
        </div>
      </div>
    )
  }
}
