import { configureStore } from '@reduxjs/toolkit'
import { save, load } from 'redux-localstorage-simple'

import wallet from './wallet/reducer'

const store = configureStore({
  reducer: {
    wallet,
  },
  middleware: (getDefaultMiddleware) => [
    ...getDefaultMiddleware({
      thunk: false,
      immutableCheck: false,
      serializableCheck: false,
    }),
    save({ states: [] }),
  ],
  preloadedState: load({ states: [] }),
  devTools: process.env.NODE_ENV === 'development',
})

export default store

export type AppState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
