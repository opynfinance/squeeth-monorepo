import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Typography } from '@material-ui/core'
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

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      paddingTop: theme.spacing(2)
    },
    infoBox: {
      background: '#8282821A',
      border: '1px solid #828282',
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1, 2),
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'top'
    },
    infoIcon: {
      color: theme.palette.text.secondary,
      fontSize: '14px',
      marginTop: theme.spacing(0.5)
    }
  }),
)

enum MIGRATION_STEP {
  APPROVE,
  MIGRATE,
}

const getAction = (action: MIGRATION_STEP) => {
  if (action === MIGRATION_STEP.APPROVE) return 'Approve crab to migrate funds'

  return 'Confirm Queue Migration'
}

const CrabMigration: React.FC = () => {
  const classes = useStyles()
  const { crabMigration, crabStrategy } = useAtomValue(addressesAtom)
  const { value: userCrabBalance } = useTokenBalance(crabStrategy, 15, 18)
  const { allowance, isLoadingAllowance, approve } = useUserAllowance(crabStrategy, crabMigration)

  const [amount, setAmount] = useState(userCrabBalance.toString())
  const [action, setAction] = useState(MIGRATION_STEP.APPROVE)
  const [loadingTx, setLoadingTx] = useState(false)

  useAppEffect(() => {
    if (allowance.gte(new BigNumber(amount))) {
      setAction(MIGRATION_STEP.MIGRATE)
    }
  }, [allowance, amount])

  const executeAction = useCallback(async (action: MIGRATION_STEP) => {
    if (action === MIGRATION_STEP.APPROVE) {
      setLoadingTx(true)
      try {
        await approve(() => null)
      } catch (e) {
        console.log(e)
      }
      setLoadingTx(false)
    }
  }, [approve, setLoadingTx])

  const loading = useMemo(() => {
    return isLoadingAllowance || loadingTx
  }, [isLoadingAllowance, loadingTx])

  return (
    <div className={classes.container}>
      <PrimaryInput
        id="crab-deposit-eth-input"
        value={amount}
        onChange={(v) => setAmount(v)}
        label="Amount"
        tooltip="CRAB token to queue"
        actionTxt="Max"
        unit="CRAB"
        hint="Balance"
        onActionClicked={() => console.log('none')}
      />
      <div className={classes.infoBox}>
        <InfoIcon className={classes.infoIcon} />

        <Typography color="textSecondary" variant="caption" style={{ marginLeft: '4px' }}>
          Your funds are still participating in crab v1 and will be deposited in crab v2 upon launch. <LinkWrapper href="https://www.notion.so/opynopyn/Crab-Migration-FAQ-Draft-1b79e3c2b98641b08745d5cc72c94a5c"> Learn more.</LinkWrapper>
        </Typography>
      </div>
      <PrimaryButton variant="contained" style={{ marginTop: '16px' }} disabled={loading} onClick={() => executeAction(action)}>
        {loading ? <CircularProgress color="primary" size="1.5rem" /> : getAction(action)}
      </PrimaryButton>
    </div>
  )
}

export default memo(CrabMigration)
