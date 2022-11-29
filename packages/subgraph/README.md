# SQUEETH-MONOREPO SUBGRAPH

## HOW TO DEPLOY SUBGRAPH TO THE HOSTED SERVICE

Make sure to create a subgraph project and have an access token. If you want to update a currentl deploy subgraph, make sure also to have the access token for the existent project.

To store the access token in your computer, run `graph auth --product hosted-service <ACCESS_TOKEN>`

- 

## HOW TO INDEX NEW CONTRACT IN SUBGRAPH

- Run `graph add --contract-name <ContractName> --network-file <PathToFile> --abi <PathToAbi> <PathToSubgraph.yaml>`. Or run `graph add --contract-name <ContractName> --network-file <PathToFile> <ContractAddressIfDeployedAlready> <PathToSubgraph.yaml>`