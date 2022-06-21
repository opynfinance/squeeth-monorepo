# Squeeth Monorepo

<p align="center">
<img src="https://i.imgur.com/Iyulvqq.png" width=400>
</p>
<p align="center"> The Squeethiest 🐱 </p>
<p align="center">
  <a href="https://discord.gg/ztEuhjyaBF"> <img alt="Discord" src="https://img.shields.io/discord/590664003815211058?style=for-the-badge" height=20></a>
  <a href="https://twitter.com/opyn_"><img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/opyn_?style=for-the-badge" height=20></a>
</p>

## 🤔 What is Squeeth

The squeeth contract is designed for users to long or short a special index: Eth², as an implementation of a Power Perpetual.

<p align="center">
<img height="150" src="https://i.imgur.com/bGue31m.png"> </img>
</p>

This monorepo contains the source code for the frontend app as well as the contracts, you can spin up the environment locally, run tests, or play around with the code. For more details about how to use the contracts and frontend, go to `packages/` and choose `hardhat` for the contracts or `frontend`, we have more detailed explanation in each sub-folder.

## 📚 Learn more

- Read our [GitBook](https://opyn.gitbook.io/squeeth/) Documentation
- Visit our official [Medium page](https://medium.com/opyn) where we have tons of great posts
- Original paper on [Power Perpetual](https://www.paradigm.xyz/2021/08/power-perpetuals/)
- Join our [Discord](https://tiny.cc/opyndiscord) to chat with all the derivative big brains


## 🔒 Security And Bug Bounty Program
Security is our one of our highest priorities. Our team has created a protocol that we believe is safe and dependable, and is audited by Trail of Bits and Akira, and is insured by Sherlock. All smart contract code is publicly verifiable and we have a bug bounty for undiscovered vulnerabilities. We encourage our users to be mindful of risk and only use funds they can afford to lose. Smart contracts are still new and experimental technology. We want to remind our users to be optimistic about innovation while remaining cautious about where they put their money.

Please see here for details on our [security audit](https://opyn.gitbook.io/squeeth/security/audits-and-insurance) and [bug bounty program](https://opyn.gitbook.io/squeeth/security/bug-bounty).


## 🏄‍♂️ Quick Start

### Prerequisites
1. Install [Node](https://nodejs.org/en/download/) LTS
1. Install [Yarn](https://classic.yarnpkg.com/en/docs/install/)

### Steps
> install and start your 👷‍ Hardhat chain:

```bash
cd packages/hardhat
yarn install
yarn chain
```

> in a second terminal window, start your 📱 frontend:

```bash
cd packages/frontend
yarn install
yarn dev
```

> in a third terminal window, 🛰 deploy your contract:

```bash
cd packages/hardhat
yarn deploy
```

Open http://localhost:3000 to see the app
