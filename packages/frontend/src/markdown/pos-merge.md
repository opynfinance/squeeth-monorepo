### What Opyn Users Should Know Ahead of The Merge

### Last Modified: September 13, 2022

&nbsp;
&nbsp;
&nbsp;

Opyn supports The Merge and does not have plans to support any forks in our web app. Opyn will only work on the canonical chain that is moving to PoS. If a canonical PoW ETH fork emerges, the Squeeth interface will not support forked PoW Squeeth, vault NFTs, or Crab Vault receipt tokens. To learn more about The Merge, see Ethereum’s [announcement](https://blog.ethereum.org/2022/08/24/mainnet-merge-announcement).

As an Opyn user, you do not need to do anything. Assuming the Merge is successful, the Squeeth Protocol will continue to work without issue through the transition from proof of work (PoW) to proof of stake (PoS). Opyn’s web app ([squeeth.opyn.co](https://squeeth.opyn.co/)) will also continue to function. Though if any third-party infrastructure providers (e.g. node providers) have downtime, some users may experience brief periods of unavailability.

It’s also worth noting the possibility of increased ETH price volatility leading up to and around the merge. Squeeth offers exposure to the squared price of Ethereum, so ETH volatility is particularly pertinent. Users who are short Squeeth or deposited in the Crab Strategy should monitor ETH price volatility and liquidation levels. Users who are long Squeeth should continue to monitor their positions and the funding cost of Squeeth. Please take note of The Merge timeline and manage your positions accordingly.

Given Squeeth uses the [Uniswap v3 GMA](https://uniswap.org/whitepaper-v3.pdf) (geometric moving average) TWAP as an oracle price, we want to highlight changes that accompany The Merge:

Uniswap v3 oracles were designed with PoW security tradeoffs in mind, where it’s predictably difficult for a single entity to mine multiple blocks in a row. To combat the possibility of a Uniswap v3 GMA TWAP oracle manipulation for Squeeth, Opyn uses the ETH-USDC pool and sets a TWAP period long enough to reduce the likelihood of manipulation attempts. Uniswap details the new risks for TWAP under PoS [here](https://uniswap.org/blog/what-to-know-pre-merge).

Users utilizing Opyn’s gamma protocol infra also do not need to do anything.

The Merge will occur around ETH mainnet block height of 15,540,293, which, at the time of writing, is [estimated to happen between Thu Sep 15 2:23 UTC & Thu Sep 15 3:33 UTC](https://bordel.wtf/). If The Merge delays and occurs within 1 hour of 8:00 UTC on Fri Sep 16, it’s possible that gamma contracts will be paused to ensure accurate oracle pricing for option expiration.

*Note: Trading digital assets confers high risk due to large price fluctuations. Before trading, please have a full understanding of all the risks associated with investing in digital assets.*

*It is your responsibility to understand the implications of the Merge. Opyn is not liable for any losses incurred.*

We are looking forward to The Merge! Please reach out in [Discord](http://discord.gg/opyn) if you have any questions.

