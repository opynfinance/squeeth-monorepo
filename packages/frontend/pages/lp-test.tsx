import { Typography, Box, TextField, Checkbox, FormControlLabel } from '@material-ui/core'
import { useState, useEffect } from 'react'
import bn from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { nearestUsableTick } from '@uniswap/v3-sdk'
import { Contract } from 'web3-eth-contract'

import { PrimaryButton } from '@components/Button'
import { useGetTicksFromPriceRange, getPoolState, useGetTickPrices } from '@state/lp/hooks'
import { squeethPoolContractAtom } from '@state/contracts/atoms'
import { normFactorAtom } from '@state/controller/atoms'
import { useGetShortAmountFromDebt } from '@state/controller/hooks'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import { useETHPrice } from '@hooks/useETHPrice'
import { INDEX_SCALE } from '@constants/index'

const LPTest3 = () => {
  const [oSQTHForLP, setOSQTHForLP] = useState('0')
  const [ethForLP, setETHForLP] = useState('0')
  const [minETHPriceInOSQTH, setMinETHPriceInOSQTH] = useState('0')
  const [maxETHPriceInOSQTH, setMaxETHPriceInOSQTH] = useState('0')

  const squeethPoolContract = useAtomValue(squeethPoolContractAtom)
  const getTicksFromPriceRange = useGetTicksFromPriceRange()
  const getTickPrices = useGetTickPrices()
  const oSQTHPrice = useOSQTHPrice()

  const handleClick = async () => {
    if (!squeethPoolContract) return
    // first calculate ticks

    const minETHPrice = new bn(minETHPriceInOSQTH).multipliedBy(oSQTHPrice)
    const maxETHPrice = new bn(maxETHPriceInOSQTH).multipliedBy(oSQTHPrice)
    const { lowerTick, upperTick } = getTicksFromPriceRange(new bn(minETHPrice), new bn(maxETHPrice))
    const { tick, tickSpacing } = await getPoolState(squeethPoolContract)

    const lowerTickVal = nearestUsableTick(lowerTick, Number(tickSpacing))
    const upperTickVal = nearestUsableTick(upperTick, Number(tickSpacing))

    // then calculate sqrtPrices from ticks
    const { sqrtLowerPrice, sqrtUpperPrice, sqrtSqueethPrice } = await getTickPrices(lowerTickVal, upperTickVal, tick)

    const sqrtPricesRatio = new bn(1)
      .multipliedBy(sqrtUpperPrice.minus(sqrtSqueethPrice))
      .div(sqrtSqueethPrice.minus(sqrtLowerPrice).multipliedBy(sqrtSqueethPrice.multipliedBy(sqrtUpperPrice)))

    // then calculate ethForLP from sqrtPrices
    const oSQTHForLPVal = new bn(ethForLP).div(sqrtPricesRatio)

    setOSQTHForLP(oSQTHForLPVal.toFixed())
  }

  return (
    <Box>
      <Typography>LP test: Calculate oSQTHForLP from ethForLP</Typography>

      <Box display="flex" flexDirection="column" gridGap="32px" marginTop="32px" width="500px">
        <TextField label="ethForLP" value={ethForLP} onChange={(event) => setETHForLP(event.target.value)} />

        <TextField
          label="Min ETH price in OSQTH"
          value={minETHPriceInOSQTH}
          onChange={(event) => setMinETHPriceInOSQTH(event.target.value)}
        />
        <TextField
          label="Max ETH price in OSQTH"
          value={maxETHPriceInOSQTH}
          onChange={(event) => setMaxETHPriceInOSQTH(event.target.value)}
        />

        <PrimaryButton onClick={handleClick}>submit</PrimaryButton>

        <Typography>oSQTHForLP: {oSQTHForLP}</Typography>
      </Box>
    </Box>
  )
}

function useGetETHFromOSQTHForLP() {
  const squeethPoolContract = useAtomValue(squeethPoolContractAtom)
  const getTicksFromPriceRange = useGetTicksFromPriceRange()
  const getTickPrices = useGetTickPrices()

  const getETHFromOSQTHForLP = async (oSQTHForLP: bn, minETHPrice: bn, maxETHPrice: bn) => {
    if (!squeethPoolContract) {
      return
    }

    const { lowerTick, upperTick } = getTicksFromPriceRange(new bn(minETHPrice), new bn(maxETHPrice))
    const { tick, tickSpacing } = await getPoolState(squeethPoolContract)

    const lowerTickVal = nearestUsableTick(lowerTick, Number(tickSpacing))
    const upperTickVal = nearestUsableTick(upperTick, Number(tickSpacing))

    const { sqrtLowerPrice, sqrtUpperPrice, sqrtSqueethPrice } = await getTickPrices(lowerTickVal, upperTickVal, tick)

    const sqrtPricesRatio = new bn(1)
      .multipliedBy(sqrtUpperPrice.minus(sqrtSqueethPrice))
      .div(sqrtSqueethPrice.minus(sqrtLowerPrice).multipliedBy(sqrtSqueethPrice.multipliedBy(sqrtUpperPrice)))

    // then calculate ethForLP from sqrtPrices
    const ethForLPVal = oSQTHForLP.multipliedBy(sqrtPricesRatio)
    return ethForLPVal
  }

  return getETHFromOSQTHForLP
}

const LPTest2 = () => {
  const [oSQTHForLP, setOSQTHForLP] = useState('0')
  const [ethForLP, setETHForLP] = useState('0')
  const [minETHPriceInOSQTH, setMinETHPriceInOSQTH] = useState('0')
  const [maxETHPriceInOSQTH, setMaxETHPriceInOSQTH] = useState('0')

  const getETHFromOSQTHForLP = useGetETHFromOSQTHForLP()
  const oSQTHPrice = useOSQTHPrice()

  const handleClick = async () => {
    const minETHPrice = new bn(minETHPriceInOSQTH).multipliedBy(oSQTHPrice)
    const maxETHPrice = new bn(maxETHPriceInOSQTH).multipliedBy(oSQTHPrice)

    const ethForLPVal = await getETHFromOSQTHForLP(new bn(oSQTHForLP), minETHPrice, maxETHPrice)
    if (ethForLPVal) {
      setETHForLP(ethForLPVal.toFixed())
    }
  }

  return (
    <Box>
      <Typography>LP test: Calculate ethForLP from oSQTHForLP</Typography>

      <Box display="flex" flexDirection="column" gridGap="32px" marginTop="32px" width="500px">
        <TextField label="oSQTHForLP" value={oSQTHForLP} onChange={(event) => setOSQTHForLP(event.target.value)} />

        <TextField
          label="Min ETH price in OSQTH"
          value={minETHPriceInOSQTH}
          onChange={(event) => setMinETHPriceInOSQTH(event.target.value)}
        />
        <TextField
          label="Max ETH price in OSQTH"
          value={maxETHPriceInOSQTH}
          onChange={(event) => setMaxETHPriceInOSQTH(event.target.value)}
        />

        <PrimaryButton onClick={handleClick}>submit</PrimaryButton>

        <Typography>ethForLP: {ethForLP}</Typography>
      </Box>
    </Box>
  )
}

const LPTest1 = () => {
  const [ethDeposit, setEthDeposit] = useState('0')
  const [collatRatioPercent, setCollatRatioPercent] = useState('225')
  const [minETHPriceInOSQTH, setMinETHPriceInOSQTH] = useState('0')
  const [maxETHPriceInOSQTH, setMaxETHPriceInOSQTH] = useState('0')
  const [usingUniswapLPNftAsCollat, setUsingUniswapLPNftAsCollat] = useState(true)

  const [ethForLP, setETHForLP] = useState('0')
  const [oSQTHToMint, setOSQTHToMint] = useState('0')

  const normFactor = useAtomValue(normFactorAtom)
  const ethPrice = useETHPrice()
  const oSQTHPrice = useOSQTHPrice()
  const getETHFromOSQTHForLP = useGetETHFromOSQTHForLP()

  const handleClick = () => {
    if (!usingUniswapLPNftAsCollat) {
      return
    }

    const oSQTHToMintVal = new bn(ethDeposit)
      .multipliedBy(INDEX_SCALE)
      .div(normFactor.multipliedBy(ethPrice).multipliedBy(new bn(collatRatioPercent).div(100).minus(1)))
    setOSQTHToMint(oSQTHToMintVal.toFixed())
  }

  useEffect(() => {
    async function calc() {
      const minETHPrice = new bn(minETHPriceInOSQTH).multipliedBy(oSQTHPrice)
      const maxETHPrice = new bn(maxETHPriceInOSQTH).multipliedBy(oSQTHPrice)

      const ethForLPVal = await getETHFromOSQTHForLP(new bn(oSQTHToMint), minETHPrice, maxETHPrice)
      if (ethForLPVal) {
        setETHForLP(ethForLPVal.toFixed())
      }
    }

    calc()
  }, [oSQTHToMint, minETHPriceInOSQTH, maxETHPriceInOSQTH, oSQTHPrice, getETHFromOSQTHForLP])

  const ethInVault = new bn(ethDeposit).minus(new bn(ethForLP))

  const oSQTHInETH = new bn(oSQTHToMint).multipliedBy(normFactor.multipliedBy(ethPrice).div(INDEX_SCALE))
  const totalCollateral = usingUniswapLPNftAsCollat ? ethInVault.plus(ethForLP).plus(oSQTHInETH) : new bn(0)

  return (
    <Box>
      <Typography>LP test: Split ETH deposit</Typography>

      <Box display="flex" flexDirection="column" gridGap="32px" marginTop="32px" width="500px">
        <TextField label="ETH to deposit" value={ethDeposit} onChange={(event) => setEthDeposit(event.target.value)} />
        <TextField
          label="Collateralization ratio (in %)"
          value={collatRatioPercent}
          onChange={(event) => setCollatRatioPercent(event.target.value)}
        />

        <TextField
          label="Min ETH price in oSQTH"
          value={minETHPriceInOSQTH}
          onChange={(event) => setMinETHPriceInOSQTH(event.target.value)}
        />
        <TextField
          label="Max ETH price in oSQTH"
          value={maxETHPriceInOSQTH}
          onChange={(event) => setMaxETHPriceInOSQTH(event.target.value)}
        />

        <FormControlLabel
          label="Using Uniswap LP NFT as collateral"
          control={
            <Checkbox
              checked={usingUniswapLPNftAsCollat}
              onChange={(event) => setUsingUniswapLPNftAsCollat(event.target.checked)}
            />
          }
        />

        <PrimaryButton onClick={handleClick}>submit</PrimaryButton>

        <Typography>oSQTHToMint: {oSQTHToMint}</Typography>
        <Typography>ethForLP: {ethForLP}</Typography>
        <Typography>ethInVault: {ethInVault.toFixed()}</Typography>
        <Typography>totalCollateral: {totalCollateral.toFixed()}</Typography>
      </Box>
    </Box>
  )
}

const useCalculateMintAndLPDeposits = () => {
  const getShortAmountFromDebt = useGetShortAmountFromDebt()
  const getETHFromOSQTHForLP = useGetETHFromOSQTHForLP()

  const calculateMintAndLPDeposits = async (ethDeposit: bn, collatPercent: bn, minETHPrice: bn, maxETHPrice: bn) => {
    let start = new bn(6.9)
    let end = ethDeposit
    const idealDeviation = new bn(0.05)

    const result = {
      ethInVault: new bn(0),
      ethForLP: new bn(0),
      oSQTHToMint: new bn(0),
      ethNeeded: new bn(0),
    }

    let lastDeviation = new bn(0)
    let numberOfIterations = 0

    while (start.lte(end)) {
      numberOfIterations++
      const feasibleETHInVault = start.plus(end).div(2)

      const debt = feasibleETHInVault.times(100).dividedBy(collatPercent)
      const oSQTHToMint = await getShortAmountFromDebt(debt)

      const ethForLP = await getETHFromOSQTHForLP(oSQTHToMint, minETHPrice, maxETHPrice)
      if (!ethForLP) {
        break
      }

      const total = feasibleETHInVault.plus(ethForLP)
      const realDeviation = ethDeposit.minus(total)

      // if lastDeviation and realDeviation are too close &
      if (lastDeviation.eq(realDeviation)) {
        result.ethNeeded = realDeviation.abs()
        break
      }
      lastDeviation = realDeviation

      if (realDeviation.gt(0) && realDeviation.lte(idealDeviation)) {
        result.ethInVault = feasibleETHInVault
        result.ethForLP = ethForLP
        result.oSQTHToMint = oSQTHToMint

        break
      } else {
        if (realDeviation.gt(0)) {
          start = feasibleETHInVault
        } else {
          end = feasibleETHInVault
        }
      }
    }

    console.log({ numberOfIterations })
    return result
  }

  return calculateMintAndLPDeposits
}

const LPTest0 = () => {
  const [ethDeposit, setEthDeposit] = useState('0')
  const [collatRatioPercent, setCollatRatioPercent] = useState('225')
  const [minETHPriceInOSQTH, setMinETHPriceInOSQTH] = useState('0')
  const [maxETHPriceInOSQTH, setMaxETHPriceInOSQTH] = useState('0')
  const [usingUniswapLPNftAsCollat, setUsingUniswapLPNftAsCollat] = useState(true)

  const [ethForLP, setETHForLP] = useState('0')
  const [oSQTHToMint, setOSQTHToMint] = useState('0')
  const [ethInVault, setEthInVault] = useState('0')
  const [ethNeeded, setETHNeeded] = useState('0')

  const oSQTHPrice = useOSQTHPrice()
  const calculateMintAndLPDeposits = useCalculateMintAndLPDeposits()

  const handleClick = async () => {
    /*
      input is ethDeposit = 20 ETH

      my task is to binary search the correct value for ethInVault so that:
      ethInVault >= 6.9ETH (minimum vault size)
      
      ethInVault -> spits out how many oSQTH to mint -> gives us ethToLp
    
    */

    const minETHPrice = new bn(minETHPriceInOSQTH).multipliedBy(oSQTHPrice)
    const maxETHPrice = new bn(maxETHPriceInOSQTH).multipliedBy(oSQTHPrice)

    const deposits = await calculateMintAndLPDeposits(
      new bn(ethDeposit),
      new bn(collatRatioPercent),
      minETHPrice,
      maxETHPrice,
    )
    if (deposits) {
      setEthInVault(deposits.ethInVault.toFixed())
      setETHForLP(deposits.ethForLP.toFixed())
      setOSQTHToMint(deposits.oSQTHToMint.toFixed())
      setETHNeeded(deposits.ethNeeded.toFixed())
    }
  }

  return (
    <Box>
      <Typography>LP test: Split ETH deposit (Binary search approach)</Typography>

      <Box display="flex" flexDirection="column" gridGap="32px" marginTop="32px" width="500px">
        <TextField label="ETH to deposit" value={ethDeposit} onChange={(event) => setEthDeposit(event.target.value)} />
        <TextField
          label="Collateralization ratio (in %)"
          value={collatRatioPercent}
          onChange={(event) => setCollatRatioPercent(event.target.value)}
        />

        <TextField
          label="Min ETH price in oSQTH"
          value={minETHPriceInOSQTH}
          onChange={(event) => setMinETHPriceInOSQTH(event.target.value)}
        />
        <TextField
          label="Max ETH price in oSQTH"
          value={maxETHPriceInOSQTH}
          onChange={(event) => setMaxETHPriceInOSQTH(event.target.value)}
        />

        <FormControlLabel
          label="Using Uniswap LP NFT as collateral"
          control={
            <Checkbox
              checked={usingUniswapLPNftAsCollat}
              onChange={(event) => setUsingUniswapLPNftAsCollat(event.target.checked)}
            />
          }
        />

        <PrimaryButton onClick={handleClick}>submit</PrimaryButton>

        <Typography>oSQTHToMint: {oSQTHToMint}</Typography>
        <Typography>ethForLP: {ethForLP}</Typography>
        <Typography>ethInVault: {ethInVault}</Typography>
        <Typography>ethNeeded: {ethNeeded}</Typography>
      </Box>
    </Box>
  )
}

const Wrapper = () => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      gridGap="60px"
      paddingTop="100px"
      paddingBottom="100px"
    >
      <LPTest3 />
      <LPTest2 />
      <LPTest1 />
      <LPTest0 />
    </Box>
  )
}
export default Wrapper
