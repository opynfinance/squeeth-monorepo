import axios from 'axios'
import * as Fathom from 'fathom-client'

export const checkIsValidAddress = async (adress: string) => {
  const { data } = await axios.get<{ valid: boolean }>(`/api/isValidAddress?address=${adress}`)

  Fathom.trackGoal(process.env.NEXT_PUBLIC_FATHOM_CODE_FOR_AML ?? '', data.valid ? 1 : 0)

  return data.valid
}
