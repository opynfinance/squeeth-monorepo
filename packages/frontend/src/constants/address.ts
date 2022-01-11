import { Networks } from '../types'

type Address = { [key in Networks]: string }

export const CONTROLLER: Address = {
  1: '0x64187ae08781B09368e6253F9E94951243A493D5',
  3: '0x78Bb5067Bb8e83Ff0fB2b25b493f59B7B418BFAE',
  421611: '0x6FBbc7eBd7E421839915e8e4fAcC9947dC32F4dE',
  31337: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
}

//ShortPowerPerp
export const VAULT_MANAGER: Address = {
  1: '0xa653e22A963ff0026292Cc8B67941c0ba7863a38',
  3: '0xCd658E838e52EF3B8a5AEf105C34e2C3Fdb0Bf52',
  421611: '0x40FA4273a739667D7dBf1C46755C27338eAa0728',
  31337: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
}

//WPowerPerp
export const WSQUEETH: Address = {
  1: '0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B',
  3: '0x2c1d37d7d8444B24c14064e35aD1B37E5f7B6035',
  421611: '0xEC0db8766bc003C14861af996e411beA6Bf800aB',
  31337: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
}

export const WETH: Address = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  421611: '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681',
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
}

export const USDC: Address = {
  1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  3: '0x27415c30d8c87437becbd4f98474f26e712047f4',
  421611: '0xc4D15025D49a88D70B023870d810f4cAa5c18a63',
  31337: '0x8dF057949E6717B6f28962f30e8415b148241e16',
}

export const UNI_V3_FACTORY: Address = {
  1: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  3: '0xa9C2f675FF8290494675dF5CFc2733319EaeeFDc',
  421611: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  31337: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
}

export const SWAP_ROUTER: Address = {
  1: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  3: '0x528a19A3e88861E7298C86fE5490B8Ec007a4204',
  421611: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  31337: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
}

export const SQUEETH_UNI_POOL: Address = {
  1: '0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C',
  3: '0xd2bA5Eab8291931B8182d629BbC8b86cb940aACB',
  421611: '0x0567A9C01990a4C7EE096F077A05CeEbA87db07f',
  31337: '0x8dF057949E6717B6f28962f30e8415b148241e16',
}

export const QUOTER: Address = {
  1: '0xC8d3a4e6BB4952E3658CCA5081c358e6935Efa43',
  3: '0x267aEB76BEb6DC7Ab0D88FeEaC8A948e237e2d69',
  421611: '0x8f92cfB1BF6eD1ce79F2E8Eb0DC96e0F3b61276D',
  31337: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
}

export const SHORT_HELPER: Address = {
  1: '0x3b4095D5ff0e629972CAAa50bd3004B09a1632C5',
  3: '0xD910A33940cd3D2E32d9014B64F4Cf5cE97a48eF',
  421611: '0x5A30a1E3873A2B5Fc9DB9b2b52491C4b6086FAe0',
  31337: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
}

export const ORACLE: Address = {
  1: '0x65D66c76447ccB45dAf1e8044e918fA786A483A1',
  3: '0x4a9c2246DACB27Fc01490d6b315461cff76FE2DB',
  421611: '0xe790Afe86c0bdc4Dd7C6CBb7dB087552Ec85F6fB',
  31337: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
}

export const ETH_USDC_POOL: Address = {
  1: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
  3: '0x8356AbC730a218c24446C2c85708F373f354F0D8',
  421611: '0xe7715b01a0B16E3e38A7d9b78F6Bd2b163D7f319',
  31337: '0x8dF057949E6717B6f28962f30e8415b148241e16',
}

export const NFT_MANAGER: Address = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  3: '0x8c7c1f786da4dee7d4bb49697a9b0c0c8fb328e0',
  421611: '',
  31337: '',
}

export const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
