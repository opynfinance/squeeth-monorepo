# Squeeth Monorepo

> 

<p align="center">
<img src="https://i.imgur.com/Iyulvqq.png" width=400>
</p>
<p align="center"> The monorepo that rules all. </p>
<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg"><a href="https://discord.gg/ztEuhjyaBF"> <img alt="Discord" src="https://img.shields.io/discord/590664003815211058?style=for-the-badge" height=20></a>
  <a href="https://twitter.com/opyn_"><img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/opyn_?style=for-the-badge" height=20></a>
</p>

## 🤔 What is Squeeth

The squeeth contract is designed for users to long or short a special index: eth², as an implementation of a Power Perpetual.

<p align="center">
<img height="150" src="https://i.imgur.com/bGue31m.png"> </img>
</p>

This monorepo contains the source code for the frontend app as well as the contracts, you can spin up the environment locally, run tests, or play around with the code. For more details about how to use the contracts and frontend, go to `packages/` and choose `hardhat` or `frontend`, we have more detailed explanation in each sub-folder.

# 📚 Learn more

* Read our [GitBook](https://app.gitbook.com/invite/-LufZJ5ZhQjPzA36K4pN/5P9fhUvlTZOdOQZy68Jr) Documentation
* Visit our official [Medium page](https://medium.com/opyn) where we have tons of great posts
* Original paper on [Power Perpetual](https://www.paradigm.xyz/2021/08/power-perpetuals/)
* Join our [Discord](https://discord.gg/ztEuhjyaBF) to chat with all the derivative big brains 

# 🏄‍♂️ Quick Start

Prerequisites: [Node](https://nodejs.org/en/download/) plus [Yarn](https://classic.yarnpkg.com/en/docs/install/).

> install and start your 👷‍ Hardhat chain:

```bash
cd scaffold-eth
yarn install
yarn chain
```

> in a second terminal window, start your 📱 frontend:

```bash
cd scaffold-eth
yarn start
```

> in a third terminal window, 🛰 deploy your contract:

```bash
cd scaffold-eth
yarn deploy
```

Open http://localhost:3000 to see the app
