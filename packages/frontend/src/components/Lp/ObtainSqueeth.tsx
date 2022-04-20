import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

import { Steps, useLPState } from '@context/lp'
import GetSqueeth from './GetSqueeth'
import ProvideLiquidity from './ProvideLiquidity'
import SelectMethod from './SelectMethod'
import Stepper from './Stepper'

const useStyles = makeStyles(() =>
  createStyles({
    container: {
      width: '400px',
    },
    title: {
      // display: 'flex',
      // justifyContent: 'center',
    },
    obtainSqueeth: {
      display: 'flex',
      justifyContent: 'center',
      flexDirection: 'column',
      width: '100%',
      textAlign: 'center',
      alignItems: 'center',
    },
  }),
)

const ObtainSqueeth: React.FC = () => {
  const classes = useStyles()
  const { lpState } = useLPState()

  return (
    <div className={classes.container}>
      <div className={classes.obtainSqueeth}>
        {lpState.step === Steps.SELECT_METHOD ? <SelectMethod /> : null}
        {lpState.step === Steps.GET_SQUEETH ? <GetSqueeth /> : null}
        {lpState.step === Steps.PROVIDE_LIQUIDITY ? <ProvideLiquidity /> : null}
        <Stepper />
      </div>
    </div>
  )
}

export default ObtainSqueeth
