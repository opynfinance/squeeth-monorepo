import { AppDispatch } from '../state'
import { useDispatch } from 'react-redux'

export const useAppDispatch = () => useDispatch<AppDispatch>()

export default useAppDispatch
