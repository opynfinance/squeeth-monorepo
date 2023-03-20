import { Networks } from '../types'

type Address = { [key in Networks]: string }

export const CONTROLLER: Address = {
  1: '0x64187ae08781B09368e6253F9E94951243A493D5',
  3: '0x59F0c781a6eC387F09C40FAA22b7477a2950d209',
  5: '0x6fc3f76f8a2d256cc091bd58bab8c2bc3f51d508',
  421611: '0x6FBbc7eBd7E421839915e8e4fAcC9947dC32F4dE',
  31337: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
}

//ShortPowerPerp
export const VAULT_MANAGER: Address = {
  1: '0xa653e22A963ff0026292Cc8B67941c0ba7863a38',
  3: '0x49721ED2d693F3653BC1216b8E330fA53CFC80eD',
  5: '0xe85595e810b77cf606d0afd7eb575bb025323bee',
  421611: '0x40FA4273a739667D7dBf1C46755C27338eAa0728',
  31337: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
}

//WPowerPerp
export const OSQUEETH: Address = {
  1: '0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B',
  3: '0xa4222f78d23593e82Aa74742d25D06720DCa4ab7',
  5: '0x9421c968d28dd789363fbd8c9aa5cf2090f0a656',
  421611: '0xEC0db8766bc003C14861af996e411beA6Bf800aB',
  31337: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
}

export const WETH: Address = {
  1: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  3: '0xc778417e063141139fce010982780140aa0cd5ab',
  5: '0x083fd3D47eC8DC56b572321bc4dA8b26f7E82103',
  421611: '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681',
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
}

export const USDC: Address = {
  1: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  3: '0x27415c30d8c87437becbd4f98474f26e712047f4',
  5: '0x306bf03b689f7d7e5e9D3aAC87a068F16AFF9482',
  421611: '0xc4D15025D49a88D70B023870d810f4cAa5c18a63',
  31337: '0x8dF057949E6717B6f28962f30e8415b148241e16',
}

export const UNI_V3_FACTORY: Address = {
  1: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  3: '0xa9C2f675FF8290494675dF5CFc2733319EaeeFDc',
  5: '0x55c0cef3cc64f511c34b18c720bcf38fec6c6ffa',
  421611: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  31337: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
}

export const SWAP_ROUTER: Address = {
  1: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  3: '0x528a19A3e88861E7298C86fE5490B8Ec007a4204',
  5: '0x833a158da5cebc44901211427e9df936023ec0d3',
  421611: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  31337: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
}

// check this one!
export const SWAP_ROUTER_02: Address = {
  1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  3: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  5: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  421611: '',
  31337: '',
}

export const SQUEETH_UNI_POOL: Address = {
  1: '0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C',
  3: '0x921c384F79de1BAe96d6f33E3E5b8d0B2B34cb68',
  5: '0xc3c29372b5138d48993f0699a129b9eadf5191bf',
  421611: '0x0567A9C01990a4C7EE096F077A05CeEbA87db07f',
  31337: '0x8dF057949E6717B6f28962f30e8415b148241e16',
}

export const QUOTER: Address = {
  1: '0xC8d3a4e6BB4952E3658CCA5081c358e6935Efa43',
  3: '0x267aEB76BEb6DC7Ab0D88FeEaC8A948e237e2d69',
  5: '0x759442726c06f7938cd2cb63ac9ae373dc1decf6',
  421611: '0x8f92cfB1BF6eD1ce79F2E8Eb0DC96e0F3b61276D',
  31337: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707',
}

export const SHORT_HELPER: Address = {
  1: '0x3b4095D5ff0e629972CAAa50bd3004B09a1632C5',
  3: '0x8903918DFE74476E90B63061E5b9c3E63b65d3F4',
  5: '0xE3606363ABE8fdE4A7f1A2058361976A4590e1e9',
  421611: '0x5A30a1E3873A2B5Fc9DB9b2b52491C4b6086FAe0',
  31337: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
}

export const ORACLE: Address = {
  1: '0x65D66c76447ccB45dAf1e8044e918fA786A483A1',
  3: '0xBD9F4bE886653177D22fA9c79FD0DFc41407fC89',
  5: '0xf7f94b4607bcd1235212803be8fd1b54d1d01b77',
  421611: '0xe790Afe86c0bdc4Dd7C6CBb7dB087552Ec85F6fB',
  31337: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
}

export const ETH_USDC_POOL: Address = {
  1: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
  3: '0x8356AbC730a218c24446C2c85708F373f354F0D8',
  5: '0x5d3EfE9157003f05be0d4031F00D43F952d6F6b7',
  421611: '0xe7715b01a0B16E3e38A7d9b78F6Bd2b163D7f319',
  31337: '0x8dF057949E6717B6f28962f30e8415b148241e16',
}

export const NFT_MANAGER: Address = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  3: '0x8c7c1f786da4dee7d4bb49697a9b0c0c8fb328e0',
  5: '0x24a66308bab3bebc2821480ada395bf1c4ff8bf2',
  421611: '',
  31337: '',
}

export const CRAB_STRATEGY: Address = {
  1: '0xf205ad80bb86ac92247638914265887a8baa437d',
  3: '0xbffBD99cFD9d77c49595dFe8eB531715906ca4Cf',
  5: '',
  421611: '',
  31337: '',
}

export const CRAB_MIGRATION: Address = {
  1: '0xa1cab67a4383312718a5799eaa127906e9d4b19e',
  3: '0xD0fb9d47B5F65d76C6bDf1b9E43a4A2345080B2f',
  5: '', // this is a wrong address, ignore for now
  421611: '',
  31337: '',
}

export const CRAB_STRATEGY2: Address = {
  1: '0x3B960E47784150F5a63777201ee2B15253D713e8',
  3: '0xdD1e9c25115e0d6e531d9F9E6ab7dbbEd15158Ce',
  5: '0x3fF39f6BF8156bdA997D93E3EFF6904c2bc4481f',
  421611: '',
  31337: '',
}

export const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

export const CONTROLLER_HELPER: Address = {
  1: '0xfa86d43b41Fa7a759c606130cc81970A955ff816',
  3: '0x7e9C5490e91F93529c6480B46a59D738F6bcEa43',
  5: '0xef0f6f951f0e62774597eb29b86065498bb7ac32',
  421611: '',
  31337: '',
}

export const CRAB_HELPER: Address = {
  1: '0x2f55e27e669f070def7b5771db72f6b31a6d4df8',
  3: '',
  5: '0xFB02DBd2f3803d660413335789291186A0390E35',
  421611: '',
  31337: '',
}

export const CRAB_NETTING: Address = {
  1: '0x6E536adDB53d1b47d357cdca83BCF460194A395F',
  3: '',
  5: '0xa168df7B65093Cb54c88194eD070677cE34F551B',
  421611: '',
  31337: '',
}

export const FLASH_BULL_STRATEGY: Address = {
  1: '0x11A56a3A7A6Eb768A9125798B1eABE9EBD9EcE02',
  3: '',
  5: '0x3876aF971560FD4c4ba3FB18632AcC0570B745b1',
  421611: '',
  31337: '',
}

export const BULL_STRATEGY: Address = {
  1: '0xb46Fb07b0c80DBC3F97cae3BFe168AcaD46dF507',
  3: '',
  5: '0x2a5AD7582a9e42944Ee32671436593D16999c70a',
  421611: '',
  31337: '',
}

export const WETH_E_TOKEN: Address = {
  1: '0x1b808F49ADD4b8C6b5117d9681cF7312Fcf0dC1D',
  3: '',
  5: '0xef5e087d827194732bc1843351cca80982e154eb',
  421611: '',
  31337: '',
}

export const USDC_D_TOKEN: Address = {
  1: '0x84721A3dB22EB852233AEAE74f9bC8477F8bcc42',
  3: '',
  5: '0x356079240635b276a63065478471d89340443c49',
  421611: '',
  31337: '',
}

export const AUCTION_BULL: Address = {
  1: '0x6cd0890054d308264cD68B0b6ba38A36860593ec',
  3: '',
  5: '0xE5E4302933aef104Bb93181Ae9E8A664E42c8d9C',
  421611: '',
  31337: '',
}

export const EULER_SIMPLE_LENS: Address = {
  1: '0x5077B7642abF198b4a5b7C4BdCE4f03016C7089C',
  3: '',
  5: '0x62626a0f051B547b3182e55D1Eba667138790D8D',
  421611: '',
  31337: '',
}

export const BULL_EMERGENCY_WITHDRAW: Address = {
  1: '',
  3: '',
  5: '0xdcF3989ff235549936BA1e0CD14e3fc968185fAC',
  421611: '',
  31337: '',
}
