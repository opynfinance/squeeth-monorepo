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

/**
 * Convert eth price historical chart to long & short PNL (including funding)
 * @param ethPrices
 */
export async function getSqueethChartWithFunding(
  ethPrices: { time: number; value: number }[],
  volMultiplier: number,
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
    const shortPNL = premium - (markAfter * positionSize) / scale

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
 * Get vol from firebase, tradis or default with 1 * multiplier
 * @param timestamp
 * @param ethPrice
 */
export async function getVolForTimestamp(
  timestamp: number,
  ethPrice: number, // incase we need to query tradis and find ATM iv.
): Promise<number> {
  const map = await getVolMap()
  return await getVolForTimestampOrDefault(map, timestamp, ethPrice)
}

export async function getVolForTimestampOrDefault(
  volsMap: { [key: string]: number | undefined },
  timestamp: number,
  ethPrice: number, // incase we need to query tradis and find ATM iv.
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
