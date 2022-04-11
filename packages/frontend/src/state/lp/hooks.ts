import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useAtomValue } from 'jotai'
import { addressesAtom } from '../positions/atoms'
import { lpEthAmountAtom, lpSqthAmountAtom, LP_TX_TYPE } from './atoms'
import { OSQUEETH_DECIMALS, WETH_DECIMALS } from '../../constants'
import { useWalletBalance } from '../wallet/hooks'
import useAppMemo from '@hooks/useAppMemo'
import BigNumber from 'bignumber.js'
import { toTokenAmount } from '@utils/calculations'

export const useLPInputValidation = () => {
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const { data: bal } = useWalletBalance()
  const sqthAmount = useAtomValue(lpSqthAmountAtom)
  const ethAmount = useAtomValue(lpEthAmountAtom)

  const ethBalance = useAppMemo(() => {
    if (!bal) return new BigNumber(0)

    return toTokenAmount(bal, WETH_DECIMALS)
  }, [bal])

  const { isValidInput } = useAppMemo(() => {
    let isValidInput = true
    const _sqthAmount = new BigNumber(sqthAmount || 0)
    const _ethAmount = new BigNumber(ethAmount || 0)

    if (_sqthAmount.isZero() && _ethAmount.isZero()) {
      isValidInput = false
    }

    return { isValidInput }
  }, [sqthAmount, ethAmount])

  return { isValidInput }
}
