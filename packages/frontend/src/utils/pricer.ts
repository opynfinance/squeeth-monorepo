/* eslint-disable prettier/prettier */
import db from './firestore'

const apiKey = process.env.NEXT_PUBLIC_TARDIS_API_KEY as string

const updateDB = process.env.NEXT_PUBLIC_UPDATE_DB === 'true'

export function getFairSqueethMarkBefore(price: number, timeElapsedInDay: number, vol: number, power = 2) {
  const vDaily = vol / Math.sqrt(365)
  const priceSquare = price ** 2
  return Math.E ** (((power ** 2 - power) / 2) * (timeElapsedInDay * vDaily ** 2)) * priceSquare
}

export function getFairSqueethMarkAfter(price: number, timeElapsedInDay: number, vol: number, power = 2) {
  return 2 * (getFairSqueethMarkBefore(price, timeElapsedInDay, vol, power) - price ** 2 / 2)
}

// mock ask
export function getFairSqueethAsk(price: number, timeElapsedInDay: number, vol: number, power = 2) {
  return getFairSqueethMarkAfter(price, timeElapsedInDay, power, vol)
}

// mock bid
export function getFairSqueethBid(price: number, timeElapsedInDay: number, vol: number, power = 2) {
  return getFairSqueethMarkAfter(price, timeElapsedInDay, vol, power)
}

export async function getETHPNLCompounding(ethPrices: { time: number; value: number }[]): Promise<
  {
    time: number
    longPNL: number
    shortPNL: number
  }[]
> {
  if (ethPrices.length === 0) return []
  let cumulativeEthLongShortReturn = 0
  const charts: {
    time: number
    longPNL: number
    shortPNL: number
  }[] = []
  for (let i = 0; i < ethPrices.length; i++) {
    const { value: price, time } = ethPrices[i > 0 ? i : 0]
    const preEthPrice = ethPrices[i > 0 ? i - 1 : 0].value
    cumulativeEthLongShortReturn += Math.log(price / preEthPrice)

    const longPNL = Math.round((Math.exp(cumulativeEthLongShortReturn) - 1) * 10000) / 100
    const shortPNL = Math.round((Math.exp(-cumulativeEthLongShortReturn) - 1) * 10000) / 100

    charts.push({ shortPNL, longPNL, time })
  }

  return charts
}

export async function getSqueethPNLCompounding(
  ethPrices: { time: number; value: number }[],
  volMultiplier = 1.2,
  collatRatio = 1.5,
  days = 365,
): Promise<
  {
    time: number
    longPNL: number
    shortPNL: number
  }[]
> {
  if (ethPrices.length === 0) return []
  const volsMap = await getVolMap()
  let cumulativeSqueethLongReturn = 0
  let cumulativeSqueethCrabReturn = 0
  const charts: {
    time: number
    longPNL: number
    shortPNL: number
  }[] = []
  // days > 90 is daily data, 90 >= days is hourly data, 1 > days is 5-minutely data
  const fundingPeriodMultiplier = days > 90 ? 365 : days > 1 ? 365 * 24 : 356 * 24 * 12

  for (let i = 0; i < ethPrices.length; i++) {
    const { value: price, time } = ethPrices[i > 0 ? i : 0]
    const vol = (await getVolForTimestampOrDefault(volsMap, time, price)) * volMultiplier
    const preEthPrice = ethPrices[i > 0 ? i - 1 : 0].value
    const fundingCost = i === 0 ? 0 : (vol / Math.sqrt(fundingPeriodMultiplier)) ** 2

    //short: -2r - r^2 + f + CR*r, CR=2 equals crab strategy pnl, 2r cancels out
    //long: 2r +r^2 -f
    cumulativeSqueethLongReturn += 2 * Math.log(price / preEthPrice) + Math.log(price / preEthPrice) ** 2 - fundingCost
    // crab return
    cumulativeSqueethCrabReturn += -(Math.log(price / preEthPrice) ** 2) + fundingCost
    const longPNL = Math.round((Math.exp(cumulativeSqueethLongReturn) - 1) * 10000) / 100
    const shortPNL = Math.round((Math.exp(cumulativeSqueethCrabReturn) - 1) * 10000) / 100

    charts.push({ shortPNL, longPNL, time })
  }

  return charts
}

/**
 * Convert eth price historical chart to long & short PNL (including funding)
 * @param ethPrices
 */
export async function getSqueethChartWithFunding(
  ethPrices: { time: number; value: number }[],
  volMultiplier: number,
  collatRatio = 1.5,
): Promise<{
  series: {
    time: number
    longPNL: number
    shortPNL: number
    positionSize: number
    fundingPerSqueeth: number
    timeElapsed: number
    mark: number
  }[]
  accFunding: number
}> {
  if (ethPrices.length === 0) return { series: [], accFunding: 0 }

  // let price = squeethPrices[0].value
  let positionSize = 1
  let lastTime = ethPrices[0].time
  let accFunding = 0

  const startPrice = ethPrices[0].value
  const scale = startPrice

  const charts: {
    time: number
    longPNL: number
    shortPNL: number
    positionSize: number
    mark: number
    fundingPerSqueeth: number
    timeElapsed: number
  }[] = []

  const volsMap = await getVolMap()

  for (const { value: price, time } of ethPrices) {
    const vol = (await getVolForTimestampOrDefault(volsMap, time, price)) * volMultiplier

    const cost = getFairSqueethAsk(startPrice, 0, vol) / scale
    const premium = getFairSqueethBid(startPrice, 0, vol) / scale

    const timeElapsed = (time - lastTime) / 86400 // time since last action, in day
    lastTime = time

    const markBefore = getFairSqueethMarkBefore(price, timeElapsed, vol)

    const fundingPerSqueeth = getFunding(price, markBefore)

    const markAfter = getFairSqueethMarkAfter(price, timeElapsed, vol)

    // reduce position size over time, as a funding charge
    const fundingRatio = 1 - fundingPerSqueeth / markAfter
    positionSize = positionSize * fundingRatio

    const longPNL = (markAfter * positionSize) / scale - cost
    const shortPNL = premium - (markAfter * positionSize) / scale + collatRatio * (price - startPrice)

    charts.push({ shortPNL, longPNL, mark: markAfter, positionSize, time, fundingPerSqueeth, timeElapsed })

    accFunding = accFunding + fundingPerSqueeth
  }

  return { series: charts, accFunding }
}

function getFunding(price: number, mark: number, power = 2) {
  const index = price ** power
  return mark - index
}

/**
 * Get vol from firebase, tardis or default with 1 * multiplier
 * @param timestamp
 * @param ethPrice
 */
export async function getVolForTimestamp(
  timestamp: number,
  ethPrice: number, // incase we need to query tardis and find ATM iv.
): Promise<number> {
  const map = await getVolMap()
  return await getVolForTimestampOrDefault(map, timestamp, ethPrice)
}

export async function getVolForTimestampOrDefault(
  volsMap: { [key: string]: number | undefined },
  timestamp: number,
  ethPrice: number, // incase we need to query tardis and find ATM iv.
): Promise<number> {
  const utcDate = new Date(timestamp * 1000).toISOString().split('T')[0]
  const vol = volsMap[utcDate]
  if (vol) return vol

  // if vol is not in the map

  // if we're not updating the db, just use 1 * multiplier
  if (!updateDB) return 1

  // we're updating the db: get value from
  const iv = await getVolForTimestampFromTardis(timestamp, ethPrice)
  await updateTimestampVolDB(timestamp, iv)
  return iv
}

/**
 * Get vol map object from firestore
 */
export async function getVolMap(): Promise<{ [key: string]: number }> {
  const document = db.doc('squeeth-vol/historical-vol')
  const doc = await document.get()
  const data = doc.get('daily-vol')
  return data
}

export async function updateTimestampVolDB(timestamp: number, vol: number): Promise<void> {
  const utcDate = new Date(timestamp * 1000).toISOString().split('T')[0]

  const document = db.doc('squeeth-vol/historical-vol')
  const doc = await document.get()
  const data = doc.get('daily-vol')

  if (Object.keys(data).includes(utcDate)) {
    console.log(`don't need to update ${utcDate} vol`)
    return
  }
  console.log(`Updating vol for ${utcDate} ${vol}`)
  const copy = { ...data }
  copy[utcDate] = Number(vol)
  await document.set({
    'daily-vol': copy,
  })
}

export async function getVolForTimestampFromTardis(timestamp: number, ethPrice: number) {
  const utcDate = new Date(timestamp * 1000).toISOString().split('T')[0]

  const domain = 'http://localhost:8010/proxy'
  const base_url = `${domain}/v1/data-feeds/deribit`
  const url = `${base_url}?from=${utcDate}&filters=[{"channel":"markprice.options"}]&offset=0`

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    if (response.body === null) return 1
    const text = await response.text()
    // only get second line (which is ETH at the 0:00 time)
    const firstLine = text.split('\n')[1]

    const [, obj] = firstLine.split(' ')

    const data = JSON.parse(obj).params.data

    // find the most ATM option and use its IV.
    let smallestDiff = Infinity
    let tempIv = 0
    for (const option of data) {
      const { instrument_name, iv } = option as { instrument_name: string; iv: number }
      const diff = Math.abs(instrumentNameToStrike(instrument_name) - ethPrice)
      if (diff < smallestDiff) {
        smallestDiff = diff
        tempIv = iv
      }
    }

    return tempIv
  } catch (error) {
    console.log(error)
    return 1
  }
}

function instrumentNameToStrike(optionName: string) {
  return parseInt(optionName.split('-')[2])
}

/**
 * Todo: fill in logic
 * @param shortAmount
 * @param vol
 * @param ethPrice
 */
export function calculateMinCollatReq(shortAmount: number, vol: number, ethPrice: number) {
  return shortAmount
}

/**
 * Todo: fill in logic
 * @param shortAmount
 * @param collateralAmount
 * @param vol
 * @param ethPrice
 */
export function calculateLiquidationPrice(
  shortAmount: number,
  collateralAmount: number,
  vol: number,
  ethPrice: number,
) {
  // mock
  return (ethPrice * (shortAmount / collateralAmount + 2)) / (shortAmount / collateralAmount + 1)
}

export function getSqueethLongPayOffGraph(ethPrice: number) {
  const unitPerTrade = 2 / (2 * ethPrice) // Took from the sheet
  const indexAtTrade = ethPrice ** 2 // Squeeeeeeth

  const getEthPrices = () => {
    let inc = 0
    return Array(400)
      .fill(0)
      .map((_, i) => {
        if (i === 0) return inc
        inc += 20
        return inc
      })
  }

  const getWeightedPrice = (index: number) => {
    let inc = 0
    const days = Array(20)
      .fill(0)
      .map((_, i) => {
        if (i === 0) return inc
        inc += 1
        return inc
      })
    const texps = days.map((d) => d / 365)
    const weights = days.map((d) => 0.5 ** (1 + d))
    const prices = texps.map((tx) => {
      return index * Math.exp(1.44 * tx) // Sigma is 1.2
    })
    const weightedPrice = prices.reduce((acc, p, i) => acc + p * weights[i], 0)
    return weightedPrice
  }

  const ethPrices = getEthPrices()
  const markAtTrade = getWeightedPrice(indexAtTrade)
  const powerPrices = ethPrices.map((p) => (p ** 2 * markAtTrade) / indexAtTrade)
  const powerTokenPayout = powerPrices.map((p, i) => {
    return (((unitPerTrade * (powerPrices[i] - markAtTrade)) / ethPrice) * 100).toFixed(0)
  })
  const ethPercents = ethPrices.map((p) => (100 * (p / ethPrice - 1)).toFixed(2))

  const twoXLeverage = ethPrices.map((p) => {
    const res = (((p - ethPrice) * 2) / ethPrice) * 100
    if (res < -100) return null
    return Number(res.toFixed(2))
  })

  const twoXLeverageImaginary = ethPrices.map((p) => {
    const res = (((p - ethPrice) * 2) / ethPrice) * 100
    if (res <= -100) return Number(res.toFixed(2))
    return null
  })

  return {
    ethPercents,
    powerTokenPayout,
    twoXLeverage,
    twoXLeverageImaginary,
  }
}

function getShortParams(ethPrice: number, collatRatio: number) {
  const squeethIndex = ethPrice ** 2
  const markRatio = 1.0035
  const squeethMark = squeethIndex * markRatio
  const dailyNormFactor = squeethMark / (2 * squeethMark - squeethIndex)
  const initialCollat = collatRatio * ethPrice
  const depositValue = initialCollat * ethPrice - squeethMark

  const cuNF0 = dailyNormFactor ** 0
  const cuNF14 = dailyNormFactor ** 14
  const cuNF28 = dailyNormFactor ** 28
  const getEthPrices = () => {
    let inc = Math.floor(ethPrice / 2)
    return Array(120)
      .fill(0)
      .map((_, i) => {
        if (i === 0) return inc
        inc += 30
        return inc
      })
  }

  return {
    squeethIndex,
    markRatio,
    squeethMark,
    initialCollat,
    depositValue,
    cuNF0,
    cuNF14,
    cuNF28,
    ethPrices: getEthPrices(),
  }
}

export function getSqueethShortPayOffGraph(ethPrice: number, collatRatio: number) {
  const { markRatio, initialCollat, depositValue, cuNF0, cuNF14, cuNF28, ethPrices } = getShortParams(
    ethPrice,
    collatRatio,
  )

  const payout0 = ethPrices.map((p) => {
    return (((-1 * cuNF0 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  const payout14 = ethPrices.map((p) => {
    return (((-1 * cuNF14 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  const payout28 = ethPrices.map((p) => {
    return (((-1 * cuNF28 * p ** 2 * markRatio + initialCollat * p) / depositValue - 1) * 100).toFixed(2)
  })

  return {
    ethPrices,
    payout0,
    payout14,
    payout28,
  }
}

export function getCrabVaultPayoff(ethPrice: number, collatRatio: number) {
  const { markRatio, initialCollat, depositValue, cuNF0, cuNF14, cuNF28, ethPrices } = getShortParams(
    ethPrice,
    collatRatio,
  )

  const payout0 = ethPrices.map((p) => {
    return (
      ((-(cuNF0 + (initialCollat - 2 * cuNF0 * ethPrice) / ethPrice) * p ** 2 * markRatio +
        (initialCollat + ((initialCollat - 2 * cuNF0 * ethPrice) / ethPrice) * markRatio * ethPrice) * p) /
        depositValue -
        1) *
      100
    ).toFixed(2)
  })

  const payout14 = ethPrices.map((p) => {
    return (
      ((-(cuNF14 + (initialCollat - 2 * cuNF14 * ethPrice) / ethPrice) * p ** 2 * markRatio +
        (initialCollat + ((initialCollat - 2 * cuNF14 * ethPrice) / ethPrice) * markRatio * ethPrice) * p) /
        depositValue -
        1) *
      100
    ).toFixed(2)
  })

  const payout28 = ethPrices.map((p) => {
    return (
      ((-(cuNF28 + (initialCollat - 2 * cuNF28 * ethPrice) / ethPrice) * p ** 2 * markRatio +
        (initialCollat + ((initialCollat - 2 * cuNF28 * ethPrice) / ethPrice) * markRatio * ethPrice) * p) /
        depositValue -
        1) *
      100
    ).toFixed(2)
  })

  return {
    ethPrices,
    payout0,
    payout14,
    payout28,
  }
}
