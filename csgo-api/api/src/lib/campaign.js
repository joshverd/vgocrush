
export const levelRewards = {
  1: {
    commission: 0.5,
    unlock: 0
  },

  2: {
    commission: 0.6,
    unlock: 200
  },

  3: {
    commission: 0.7,
    unlock: 400
  },

  4: {
    commission: 1,
    unlock: 800
  },

  5: {
    commission: 1.25,
    unlock: 1600
  },

  6: {
    commission: 1.50,
    unlock: 3200
  },

  7: {
    commission: 1.75,
    unlock: 6400
  },

  8: {
    commission: 2,
    unlock: 25600
  },

  9: {
    commission: 2.25,
    unlock: 51200
  },

  10: {
    commission: 2.5,
    unlock: 102400
  }
}

export function getLevelReward(level, referrals) {
  return levelRewards[level > 10 ? level : level]
}

export function getLevel(referrals) {
  let level = 1
  referrals = referrals || 0

  for(let i in levelRewards) {
    if(referrals >= levelRewards[i].unlock) {
      level = parseInt(i)
      continue
    }

    break
  }

  return level
}
