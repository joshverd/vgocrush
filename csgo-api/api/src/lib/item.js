
export const BATTLE_SCARRED = 0
export const WELL_WORN      = 1
export const FIELD_TESTED   = 2
export const MINIMAL_WEAR   = 3
export const FACTORY_NEW    = 4
export const VANILLA        = 5

export const WEAR = {
  'Factory New': FACTORY_NEW,
  'Minimal Wear': MINIMAL_WEAR,
  'Field-Tested': FIELD_TESTED,
  'Well-Worn': WELL_WORN,
  'Battle-Scarred': BATTLE_SCARRED
}

export function cleanItemName(name) {
  let idx = -1

  for(let i = 0; i < name.length; i++) {
    if(name.charAt(i) === '(') {
      idx = i
    }
  }

  if(idx > 0) {
    name = name.substring(0, idx)
  }

  return name.trim()
}

export const getWear = name => {
  let idx = -1

  for(let i = 0; i < name.length; i++) {
    if(name.charAt(i) === '(') {
      idx = i
    }
  }

  if(idx >= 0) {
    const wear = name.substring(idx + 1, name.length - 1).trim()
    if(typeof WEAR[wear] !== 'undefined') {
      return WEAR[wear]
    }
  }

  // const category = getItemCategory(name)
  // if(category === CATEGORY_MELEE) {
  //   return VANILLA
  // }

  return -1
}
