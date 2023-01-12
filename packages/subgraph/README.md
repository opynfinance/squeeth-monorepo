# SQUEETH-MONOREPO SUBGRAPH

## HOW TO DEPLOY SUBGRAPH TO THE HOSTED SERVICE

Make sure to create a subgraph project and have an access token. If you want to update a currentl deploy subgraph, make sure also to have the access token for the existent project.

To store the access token in your computer, run `graph auth --product hosted-service <ACCESS_TOKEN>`

- To copy the config and ABIs from `hardhat` package, run `node scripts/publish.js` under hadhat folder of our repo. This will copy all your ABIs and create config files under the subgraph folder
- Make sure to manually copy ABIs from `bull-vault` package, add addresses and starting block in `config` folder for the related network json file
- Prepare the subgraph for a particular environment using `yarn prepare:ropsten` or `yarn prepare:mainnet`
- Generate types using `yarn codegen`
- Write compiled subgraph to /build, using `yarn build`
- Deploy subgraph based on environment using `yarn deploy:ropsten —deploy-key *******` or `yarn deploy —deploy-key *******`

## HOW TO INDEX NEW CONTRACT IN SUBGRAPH

- Manually copy contract ABI into `abis` folder
- Add data source in `subgraph.template.yaml`
- Create entities in `schema.graphql`
- Add handles in `src/` folder
- Run `yarn prepare:mainnet` or equivalent depend on the network
- Run `yarn codegen`
- Run `yarn build`
- Run `yarn deploy:...` similar to the one above depend on network