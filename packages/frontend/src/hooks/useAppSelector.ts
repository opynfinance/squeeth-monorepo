import { AppState } from '../state'
import { TypedUseSelectorHook, useSelector } from 'react-redux'

export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector

export default useAppSelector
