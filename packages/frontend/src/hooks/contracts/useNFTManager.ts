import { useWallet } from '@context/wallet'
import { useAddresses } from '@hooks/useAddress'
import { Position } from '@uniswap/v3-sdk'
import React, { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'
import positionManagerAbi from '../../abis/NFTpositionmanager.json'

export const useNFTManager = () => {
  const { nftManager } = useAddresses()
  const { address, web3 } = useWallet()

  const [contract, setContract] = useState<Contract>()

  useEffect(() => {
    if (!web3 || !nftManager) return
    setContract(new web3.eth.Contract(positionManagerAbi as any, nftManager))
  }, [web3])

  const getPosition = (posId: number) => {
    console.log('hello')
  }
}
