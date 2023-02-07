export function getNetwork(networkId: number) {
  switch (networkId) {
    case 1:
      return 'MAINNET'
    case 5:
      return 'GOERI'
    case 11155111:
      return 'SEPOLIA'
    default:
      return 'UNKNOWN'
  }
}
