- Setup / Preparation

  1. Test Environment
     1. Test locally
     2. Network: Ropsten
     3. Wallet: Metamask
     4. Browser: Default is Chrome
        1. Can test with firefox or chromium-based browsers as well, but will need to change the command in `package.json` ,
     5. Test websites
        1. squeeth, at `localhost:3000`
        2. uniswap lp page to lp oSQTH
  2. Test setup

     1. Make sure `synpress` and `dotenv-cli` packages are installed successfully with `package.json`
        1. if there is no `dotenv-cli` installed, run `yarn global add dotenv-cli`
     2. Put SECRET_WORDS or PRIVATE_KEY and NETWORK in `.env` file, i.e.

        ```jsx
        SECRET_WORDS = 'word1, word2, word3...'
        NETWORK_NAME = ropsten
        OR
        PRIVATE_KEY = 'your PRIVATE_KEY'
        NETWORK_NAME = ropsten
        ```

     3. If you want to test with squeeth website, set `baseUrl` in `cypress.json` as `"baseUrl": "http://localhost:3000",`
     4. if you want to test lp, set `baseUrl` in `cypress.json` as `"baseUrl": "https://squeeth-uniswap.netlify.app/#/add/ETH/0xa4222f78d23593e82Aa74742d25D06720DCa4ab7/3000",`
     5. Recommended to clear your existing position before you run the tests, otherwise it may be hard to tell if the test fails because of the existing position or the new position
     6. Run `yarn run build` and `yarn start` , dont use `yarn dev` , cuz it will have warning pop-ups hiding some DOM elements
     7. **Recommended**: if you only want to test one page or related functionalities or the functionalities you changed, plz specify the tests file you would like to include, it will run only provided spec files, i.e.

        ```jsx
        yarn run cypress -s cypress/integration/specs/01-trade-long.spec.js
        yarn run cypress -s cypress/integration/specs/02-trade-short.spec.js
        ```

        1. Tests you should run
           1. Test long: `01-trade-long.spec`
           2. Test short: `02-trade-short.spec`
           3. Test vault with short or mint position: `03-vault.spec`
           4. Test lp:
              1. buy to lp: `04-buy-lp` + `05-lp-uniswap` + `05-lp-position`
              2. mint to lp: `04-mint-lp` + `05-lp-uniswap` + `05-lp-position` + `05-lp-vault`
           5. Test manual short : `06-manual-short`
           6. Test strategy: `07-strategy`
           7. Test on position page : `08-position`
           8. Test on lp nft as collateral : `09-lp-token`

     8. **Not recommended**: Run `yarn run cypress` to start all testing, it will start with `01-trade-long.spec` by default, it will take forever to run through all the tests
