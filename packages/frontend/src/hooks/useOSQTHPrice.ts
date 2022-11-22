import { useGetWSqueethPositionValue } from '@state/squeethPool/hooks'

export const useOSQTHPrice = () => {
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  return getWSqueethPositionValue(1)
}
