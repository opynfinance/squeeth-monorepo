/* eslint-disable prettier/prettier */
import React, { useContext, useState } from 'react'

import { useETHPriceCharts } from '../hooks/useETHPriceCharts'

type point = {
  value: number
  time: number
}

type WorldContextProps = {
  researchMode: boolean
  // usePriceSeries: boolean,
  setResearchMode: Function
  // setUsePriceSeries: Function,

  ethPrices: point[]
  startingETHPrice: number
  longEthPNL: point[]
  shortEthPNL: point[]
  squeethPrices: point[]
  longSeries: point[]
  shortSeries: point[]

  positionSizeSeries: point[]
  fundingPercentageSeries: point[]

  accFunding: number
  volMultiplier: number
  days: number
  setVolMultiplier: Function
  setDays: Function
  collatRatio: number
  setCollatRatio: Function

  ethPriceMap: { [key: number]: number }

  getVaultPNLWithRebalance: (longAmount: number) => point[]
  getStableYieldPNL: (comparedlongAmount: number) => point[]
}

const initialContext = {
  researchMode: false,
  usePriceSeries: false,
  setResearchMode: () => { },
  setUsePriceSeries: () => { },

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
  collatRatio: 1.5,
  setCollatRatio: () => { },
  setVolMultiplier: () => { },
  setDays: () => { },

  getVaultPNLWithRebalance: () => [],
  getStableYieldPNL: () => [],
}

const worldContext = React.createContext<WorldContextProps>(initialContext)
const useWorldContext = () => useContext(worldContext)

const WorldProvider: React.FC = ({ children }) => {
  const [researchMode, setResearchMode] = useState(false)
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
    collatRatio,
    setCollatRatio
  } = useETHPriceCharts()

  return (
    <worldContext.Provider
      value={{
        // usePriceSeries,
        // setUsePriceSeries,
        accFunding,
        setResearchMode,
        researchMode,
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
        collatRatio,
        setCollatRatio
      }}
    >
      {children}
    </worldContext.Provider>
  )
}

export { useWorldContext, WorldProvider }
