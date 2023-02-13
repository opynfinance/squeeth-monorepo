export function getNetwork(networkId: number) {
  switch (networkId) {
    case 1:
      return 'MAINNET'
    case 5:
      return 'GOERLI'
    case 11155111:
      return 'SEPOLIA'
    default:
      return 'UNKNOWN'
  }
}
