import { useState } from 'react'
import { Contract } from 'web3-eth-contract'
import { useAtomValue } from 'jotai'

import erc721Abi from '../../abis/erc721.json'
import { useHandleTransaction } from 'src/state/wallet/hooks'
import { addressAtom, web3Atom } from 'src/state/wallet/atoms'
import useAppEffect from '@hooks/useAppEffect'

export const useERC721 = (token: string) => {
  const [contract, setContract] = useState<Contract>()

  const handleTransaction = useHandleTransaction()
  const web3 = useAtomValue(web3Atom)
  const address = useAtomValue(addressAtom)

  useAppEffect(() => {
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
