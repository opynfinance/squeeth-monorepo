/* eslint-disable prefer-const */
import {
  Bundle,
  Factory,
  Pool,
  Swap,
  Tick,
  Token,
} from "../../generated/schema";
import { Pool as PoolABI } from "../../generated/Factory/Pool";
import { BigDecimal, BigInt, ethereum, store } from "@graphprotocol/graph-ts";
import {
  Initialize,
  Swap as SwapEvent,
} from "../../generated/templates/Pool/Pool";
import { convertTokenToDecimal, loadTransaction, safeDiv } from "../utils";
import { FACTORY_ADDRESS, ONE_BI, ZERO_BD, ZERO_BI } from "../utils/constants";
import {
  findEthPerToken,
  getEthPriceInUSD,
  getTrackedAmountUSD,
  sqrtPriceX96ToTokenPrices,
} from "../utils/pricing";

export function handleSwap(event: SwapEvent): void {
  let bundle = Bundle.load("1");
  let factory = Factory.load(FACTORY_ADDRESS);
  let pool = Pool.load(event.address.toHexString());

  // hot fix for bad pricing
  if (pool.id == "0x9663f2ca0454accad3e094448ea6f77443880454") {
    return;
  }

  let token0 = Token.load(pool.token0);
  let token1 = Token.load(pool.token1);

  // updated pool ratess
  let prices = sqrtPriceX96ToTokenPrices(
    pool.sqrtPrice,
    token0 as Token,
    token1 as Token
  );
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  pool.save();

  // update USD pricing
  bundle.ethPriceUSD = getEthPriceInUSD();
  bundle.save();
  token0.derivedETH = findEthPerToken(token0 as Token);
  token1.derivedETH = findEthPerToken(token1 as Token);

  // create Swap event
  let transaction = loadTransaction(event);
  let swap = new Swap(transaction.id + "#" + pool.txCount.toString());
  swap.transaction = transaction.id;
  swap.timestamp = transaction.timestamp;
  swap.pool = pool.id;
  swap.token0 = pool.token0;
  swap.token1 = pool.token1;
  swap.sender = event.params.sender;
  swap.origin = event.transaction.from;
  swap.recipient = event.params.recipient;
  swap.amount0 = amount0;
  swap.amount1 = amount1;
  swap.amountUSD = amountTotalUSDTracked;
  swap.tick = BigInt.fromI32(event.params.tick as i32);
  swap.sqrtPriceX96 = event.params.sqrtPriceX96;
  swap.logIndex = event.logIndex;

  swap.save();
  factory.save();
  pool.save();
  token0.save();
  token1.save();
}
