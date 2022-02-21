import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import erc721Abi from '../../abis/erc721.json'
import { useWallet } from '@context/wallet'
import { toTokenAmount } from '@utils/calculations'
import useInterval from '../useInterval'

export const useERC721 = (token: string) => {
  const [contract, setContract] = useState<Contract>()

  const { address, web3, handleTransaction } = useWallet()

  useEffect(() => {
    if (!web3 || !token) return
    setContract(new web3.eth.Contract(erc721Abi as any, token))
  }, [web3, token])

  const approve = async (toAddress: string, tokenId: number) => {
    if (!contract || !address) return

    await handleTransaction(
      contract.methods.approve(toAddress, tokenId).send({
        from: address,
      }),
    )
  }

  const getApproved = async (tokenId: number) => {
    if (!contract || !address) return

    const approveAddress = await contract.methods.getApproved(tokenId).call()
    return approveAddress
  }

  return {
    approve,
    getApproved,
  }
}
