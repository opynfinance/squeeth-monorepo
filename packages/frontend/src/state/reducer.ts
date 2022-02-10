import { combineReducers } from '@reduxjs/toolkit'

import wallet from './wallet/reducer'

const reducer = combineReducers({
  wallet,
})

export default reducer
