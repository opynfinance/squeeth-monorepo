import { Networks } from '../types'

type Address = { [key in Networks]: string }

export const CONTROLLER: Address = {
  1: '',
  3: '',
  31337: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
}

export const VAULT_MANAGER: Address = {
  1: '',
  3: '',
  31337: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
}

export const WSQUEETH: Address = {
  1: '',
  3: '',
  31337: '0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0',
}

export const WETH: Address = {
  1: '',
  3: '',
  31337: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
}

export const UNI_V3_FACTORY: Address = {
  1: '',
  3: '',
  31337: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
}

export const SWAP_ROUTER: Address = {
  1: '',
  3: '',
  31337: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
}

export const SQUEETH_UNI_POOL: Address = {
  1: '',
  3: '',
  31337: '0xf49a09b12d6D09485A77620Cf49A5bc40a679002',
}

export const QUOTER: Address = {
  1: '',
  3: '',
  31337: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
}

export const ZERO_ADDR = '0x0000000000000000000000000000000000000000'
