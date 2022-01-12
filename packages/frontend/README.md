# Squeeth Frontend

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Getting started

As the first step, install the node dependencies

```
yarn install
```

### Set up the environment

Copy the contents of `.env.example` to a new file `.env`.

`NEXT_PUBLIC_INFURA_API_KEY` - Sign up in [Infura](https://infura.io/dashboard/ethereum) and create an Ethereum project to get infura key.
`NEXT_PUBLIC_ALCHEMY_API_KEY` - Sign up at [Alchemy] (https://www.alchemy.com/) and create an Etheruem project to get an alchemy key
`NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID` - Sign up in [Blocknative](https://www.blocknative.com/) and get the api key.

The backtests use Tardis and Firebase and we use Fathom for analytics. All of those fields are optional (note that the backtests will not show up without them though).

### Run the app

Once everything is set run the following command.

```
yarn start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment

The easiest way to deploy this Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Contributions

We welcome contributions to the Squeeth Frontend! You can contribute by resolving existing issues, taking on feature requests, and refactoring code. Please feel free to open new issues / feature requests as well. You can find our [contribution guidelines here.](CONTRIBUTING.md) If you have questions about contributing, ping us on #dev in the [Opyn discord](http://tiny.cc/opyndiscord) :)

## Branding

Don't use the Opyn or Squeeth logo or name in anything dishonest or fraudulent. If you deploy another version of the interface, please make it clear that it is an interface to the Squeeth Protocol, but not affiliated with Opyn Inc.
