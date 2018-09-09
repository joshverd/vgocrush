
export const ClassicGameMode = 'Classic'
export const SmallGameMode = 'Small'

export default {
  [ClassicGameMode]: {
    name: 'Classic',
    minimumBet: 1,
    roundLength: 35000
  },

  [SmallGameMode]: {
    name: 'Low Baller',
    minimumBet: 0.03,
    maximumBet: 5,
    maximumBets: 3,
    roundLength: 35000
  }
}
