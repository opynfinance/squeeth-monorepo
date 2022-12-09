import { useState } from 'react'
import { useAtomValue } from 'jotai'

import { squeethInitialPriceAtom, squeethInitialPriceErrorAtom } from '@state/squeethPool/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import useAppEffect from '@hooks/useAppEffect'

export const useOSQTHPrice = () => {
  const [loading, setLoading] = useState(false)

  const ethPrice = useETHPrice()
  const squeethPriceInETH = useAtomValue(squeethInitialPriceAtom)
  const squeethPriceError = useAtomValue(squeethInitialPriceErrorAtom)

  const squeethPrice = squeethPriceInETH.times(ethPrice)

  useAppEffect(() => {
    if (squeethPrice.isZero() && squeethPriceError === '') {
      setLoading(true)
    } else {
      setLoading(false)
    }
  }, [squeethPrice, squeethPriceError])

  return { loading, data: squeethPrice, error: squeethPriceError }
}
