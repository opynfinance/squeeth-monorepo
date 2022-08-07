import axios from 'axios'

export const checkIsValidAddress = async (adress: string) => {
  const { data } = await axios.get<{ valid: boolean }>(`/api/isValidAddress?address=${adress}`)

  return data.valid
}
