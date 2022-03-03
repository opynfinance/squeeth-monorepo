import React, { useContext } from 'react'

import { useETHPriceCharts } from '@hooks/useETHPriceCharts'
import BigNumber from 'bignumber.js'
import { OSQUEETH_DECIMALS } from '../constants/index'
import { useAddresses } from '@hooks/useAddress'
import { useETHPrice } from '@hooks/useETHPrice'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'

type point = {
  value: number
  time: number
}

type WorldContextProps = {
  // researchMode: boolean
  // usePriceSeries: boolean,
  // setResearchMode: Function
  // setUsePriceSeries: Function,

  ethPrices: point[] | undefined
  startingETHPrice: number
  longEthPNL: point[] | undefined
  shortEthPNL: point[] | undefined
  squeethPrices: point[] | undefined
  longSeries: point[] | undefined
  shortSeries: point[] | undefined

  positionSizeSeries: point[] | undefined
  fundingPercentageSeries: point[] | undefined

  accFunding: number | undefined
  volMultiplier: number
  days: number
  setVolMultiplier: Function
  setDays: Function
  collatRatio: number
  setCollatRatio: Function

  ethPriceMap: { [key: number]: number } | undefined
  eth90daysPriceMap: { [key: number]: number } | undefined
  ethWithinOneDayPriceMap: { [key: number]: number }

  getVaultPNLWithRebalance: (longAmount: number) => point[] | undefined
  getStableYieldPNL: (comparedlongAmount: number) => point[]

  ethPrice: BigNumber
  oSqueethBal: BigNumber

  squeethIsLive: boolean[] | undefined
}

const initialContext = {
  // researchMode: false,
  // usePriceSeries: false,
  // setResearchMode: () => {},
  // setUsePriceSeries: () => {},

  ethPrices: [],
  startingETHPrice: 0,
  longEthPNL: [],
  shortEthPNL: [],
  squeethPrices: [],
  longSeries: [],
  shortSeries: [],
  positionSizeSeries: [],
  fundingPercentageSeries: [],
  accFunding: 0,
  volMultiplier: 1.2,
  days: 180,
  ethPriceMap: {},
  ethWithinOneDayPriceMap: {},
  eth90daysPriceMap: {},
  collatRatio: 1.5,
  setCollatRatio: () => null,
  setVolMultiplier: () => null,
  setDays: () => null,

  getVaultPNLWithRebalance: () => [],
  getStableYieldPNL: () => [],

  ethPrice: new BigNumber(0),
  oSqueethBal: new BigNumber(0),
  setOSqueethBal: () => null,

  squeethIsLive: [],
}

const worldContext = React.createContext<WorldContextProps>(initialContext)
const useWorldContext = () => useContext(worldContext)

const WorldProvider: React.FC = ({ children }) => {
  // const [researchMode, setResearchMode] = useState(false)
  // const [ usePriceSeries, setUsePriceSeries ] = useState(false) // default to show PNL.

  const {
    ethPrices,
    startingETHPrice,
    longEthPNL,
    shortEthPNL,
    squeethPrices,
    longSeries,
    shortSeries,
    getVaultPNLWithRebalance,
    volMultiplier,
    setVolMultiplier,
    days,
    setDays,
    getStableYieldPNL,
    accFunding,
    positionSizeSeries,
    fundingPercentageSeries,
    ethPriceMap,
    ethWithinOneDayPriceMap,
    eth90daysPriceMap,
    collatRatio,
    setCollatRatio,
    squeethIsLive,
  } = useETHPriceCharts()

  const { oSqueeth } = useAddresses()
  const ethPrice = useETHPrice(10)
  const oSqueethBal = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)

  return (
    <worldContext.Provider
      value={{
        // usePriceSeries,
        // setUsePriceSeries,
        accFunding,
        // setResearchMode,
        // researchMode,
        volMultiplier,
        setVolMultiplier,
        days,
        setDays,
        ethPrices,
        startingETHPrice,
        getVaultPNLWithRebalance,
        longEthPNL,
        shortEthPNL,
        getStableYieldPNL,
        squeethPrices,
        longSeries,
        shortSeries,
        positionSizeSeries,
        fundingPercentageSeries,
        ethPriceMap,
        ethWithinOneDayPriceMap,
        eth90daysPriceMap,
        collatRatio,
        setCollatRatio,
        ethPrice,
        oSqueethBal,
        squeethIsLive,
      }}
    >
      {children}
    </worldContext.Provider>
  )
}

export { useWorldContext, WorldProvider }
