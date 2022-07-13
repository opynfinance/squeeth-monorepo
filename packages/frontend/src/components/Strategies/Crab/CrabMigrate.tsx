import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Step, Stepper, StepLabel } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { CircularProgress } from '@material-ui/core'
import { LinkWrapper } from '@components/LinkWrapper'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { useAtomValue } from 'jotai'
import { addressesAtom } from 'src/state/positions/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import useAppEffect from '@hooks/useAppEffect'
import BigNumber from 'bignumber.js'
import useAppCallback from '@hooks/useAppCallback'
import { useInitCrabMigration, useQueueMigrate } from 'src/state/crabMigration/hooks'
import { currentCrabPositionValueAtom, currentCrabPositionValueInETHAtom } from 'src/state/crab/atoms'
import TradeInfoItem from '@components/Trade/TradeInfoItem'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      // paddingTop: theme.spacing(1),
    },
    infoBox: {
      background: '#8282821A',
      border: '1px solid #828282',
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1, 2),
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'top',
    },
    infoIcon: {
      color: theme.palette.text.secondary,
      fontSize: '14px',
      marginTop: theme.spacing(0.5),
    },
    position: {
      marginTop: theme.spacing(1),
    },
    stepper: {
      backgroundColor: 'transparent',
    },
  }),
)

enum MIGRATION_STEP {
  APPROVE,
  MIGRATE,
}

const getAction = (action: MIGRATION_STEP) => {
  if (action === MIGRATION_STEP.APPROVE) return 'Approve crab to transfer funds to v2 at launch'

  return 'Secure spot in Crab v2'
}

const CrabMigration: React.FC = () => {
  const classes = useStyles()
  const { crabMigration, crabStrategy } = useAtomValue(addressesAtom)
  const positionInEth = useAtomValue(currentCrabPositionValueInETHAtom)
  const positionInUsd = useAtomValue(currentCrabPositionValueAtom)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy, 15, 18)
  const { allowance, isLoadingAllowance, approve } = useUserAllowance(crabStrategy, crabMigration)
  const queueMigrate = useQueueMigrate()

  const [action, setAction] = useState(MIGRATION_STEP.APPROVE)
  const [loadingTx, setLoadingTx] = useState(false)

  const steps = ['Approve Crab Contract', 'Secure spot in Crab v2']

  useAppEffect(() => {
    if (allowance.gte(userCrabBalance)) {
      setAction(MIGRATION_STEP.MIGRATE)
    } else {
      setAction(MIGRATION_STEP.APPROVE)
    }
  }, [allowance, userCrabBalance])

  const executeAction = useCallback(
    async (action: MIGRATION_STEP) => {
      setLoadingTx(true)
      if (action === MIGRATION_STEP.APPROVE) {
        try {
          await approve(() => null)
        } catch (e) {
          console.log(e)
        }
      } else if (action === MIGRATION_STEP.MIGRATE) {
        try {
          await queueMigrate(userCrabBalance)
        } catch (e) {
          console.log(e)
        }
      }
      setLoadingTx(false)
    },
    [userCrabBalance, approve, queueMigrate],
  )

  const loading = useMemo(() => {
    return isLoadingAllowance || loadingTx
  }, [isLoadingAllowance, loadingTx])

  return (
    <div className={classes.container}>
      <Stepper
        className={classes.stepper}
        activeStep={getAction(action) === 'Secure spot in Crab v2' ? 1 : 0}
        alternativeLabel
      >
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      {/* <div className={classes.infoBox}>
        <InfoIcon className={classes.infoIcon} />
        <Typography color="textSecondary" variant="caption" style={{ marginLeft: '4px' }}>
          Your position is still participating in crab v1 until crab v2 drops. When crab v2 drops, your position will
          automatically be transferred to crab v2.{' '}
          <LinkWrapper href="https://www.notion.so/opynopyn/Crab-Migration-FAQ-Draft-1b79e3c2b98641b08745d5cc72c94a5c">
            {' '}
            Learn more.
          </LinkWrapper>
        </Typography>
      </div> */}
      <div className={classes.position}>
        <TradeInfoItem
          label="Crab v1 Position"
          value={`${positionInEth.toFixed(4)} ETH`}
          unit={`$${positionInUsd.toFixed(1)}`}
          tooltip={
            ' Your position is still participating in crab v1 until crab v2 drops. When crab v2 drops, your position will automatically be transferred to crab v2.'
          }
        />
        {/* <Typography variant="body2" color="textSecondary">
          Crab Position
        </Typography>
        <Typography variant="body2">{positionInEth.toFixed(6)} ETH</Typography> */}
      </div>
      <PrimaryButton
        variant="contained"
        style={{ marginTop: '16px' }}
        disabled={loading || userCrabBalance.isZero()}
        onClick={() => executeAction(action)}
      >
        {loading ? <CircularProgress color="primary" size="1.5rem" /> : getAction(action)}
      </PrimaryButton>
    </div>
  )
}

export default memo(CrabMigration)
