import { CircularProgress, InputAdornment, TextField, Typography, Tooltip } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import { motion } from 'framer-motion'
import React, { useState } from 'react'

import { BIG_ZERO, MIN_COLLATERAL_AMOUNT, OSQUEETH_DECIMALS, Tooltips } from '../../constants'
import { LPActions, OBTAIN_METHOD, useLPState } from '@context/lp'
import { toTokenAmount } from '@utils/calculations'
import { PrimaryButton } from '../Button'
import CollatRange from '../CollatRange'
import { PrimaryInput } from '../Input/PrimaryInput'
import Long from '../Trade/Long'
import TradeDetails from '../Trade/TradeDetails'
import TradeInfoItem from '../Trade/TradeInfoItem'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useWalletBalance } from 'src/state/wallet/hooks'
import { connectedWalletAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import { addressesAtom, existingCollatAtom, existingCollatPercentAtom } from 'src/state/positions/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useGetWSqueethPositionValue } from 'src/state/squeethPool/hooks'
import {
  useGetCollatRatioAndLiqPrice,
  useGetShortAmountFromDebt,
  useOpenDepositAndMint,
} from 'src/state/controller/hooks'
import { useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { normFactorAtom } from 'src/state/controller/atoms'
import useAppEffect from '@hooks/useAppEffect'
import useAppMemo from '@hooks/useAppMemo'
import Link from 'next/link'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    getSqueethCard: {
      width: '400px',
      height: '496px',
      background: theme.palette.background.lightStone,
      margin: theme.spacing(1, 0),
      borderRadius: theme.spacing(1),
      overflow: 'auto',
    },
    thirdHeading: {
      marginTop: theme.spacing(1.5),
    },
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    amountInput: {
      marginTop: theme.spacing(1),
      backgroundColor: theme.palette.success.main,
      '&:hover': {
        backgroundColor: theme.palette.success.dark,
      },
    },
    hint: {
      display: 'flex',
      alignItems: 'center',
    },
    hintTextContainer: {
      display: 'flex',
    },
    hintTitleText: {
      marginRight: '.5em',
    },
    vaultCollatInfo: {
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'auto',
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      color: theme.palette.text.secondary,
    },
    link: {
      color: theme.palette.primary.main,
      marginBottom: theme.spacing(1),
      margin: 'auto',
      width: '300px',
      textDecoration: 'underline'
    },
  }),
)

type MintProps = {
  onMint: () => void
  showManageLink?: boolean
}

export const MintSqueeth: React.FC<MintProps> = ({ onMint, showManageLink }) => {
  const classes = useStyles()
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const { data: balance } = useWalletBalance()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const { loading: vaultIDLoading } = useVaultManager()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const openDepositAndMint = useOpenDepositAndMint()
  const getShortAmountFromDebt = useGetShortAmountFromDebt()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const { existingCollat, existingCollatPercent } = useVaultData(vault)

  const [mintAmount, setMintAmount] = useState(new BigNumber(0))
  const [collatAmount, setCollatAmount] = useState('0')
  const collatAmountBN = new BigNumber(collatAmount)
  const [collatPercent, setCollatPercent] = useState(200)
  const [loading, setLoading] = useState(false)
  const [mintMinCollatError, setMintMinCollatError] = useState('')
  const [minCollRatioError, setMinCollRatioError] = useState('')
  const [liqPrice, setLiqPrice] = useState(BIG_ZERO)

  const mint = async () => {
    setLoading(true)
    try {
      if (vaultIDLoading) return
      await openDepositAndMint(Number(vaultId), mintAmount, collatAmountBN)
      onMint()
    } catch (e) {
      console.log(e)
    }
    setLoading(false)
  }

  useAppEffect(() => {
    let isMounted = true

    if (collatAmountBN.isNaN() || collatAmountBN.isZero()) {
      //if no collateral is being inputted and user is not trying to only adjust vault collateral
      if (isMounted) setMintAmount(new BigNumber(0))
      return
    }
    const debt = collatAmountBN.times(100).div(collatPercent)
    getShortAmountFromDebt(debt).then((s) => {
      if (isMounted) setMintAmount(s)
    })
    return () => {
      isMounted = false
    }
  }, [collatPercent, collatAmount.toString()])

  useAppEffect(() => {
    if (collatPercent < 150) {
      setMinCollRatioError('Minimum collateral ratio is 150%')
    } else {
      setMinCollRatioError('')
    }

    if (connected && collatAmountBN.isGreaterThan(balance ?? BIG_ZERO)) {
      setMintMinCollatError('Insufficient ETH balance')
    } else if (connected && collatAmountBN.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) {
      setMintMinCollatError('Minimum collateral is 6.9 ETH')
    }
  }, [balance?.toString(), connected, existingCollat.toString(), collatAmountBN.toString(), collatPercent])

  useAppEffect(() => {
    getCollatRatioAndLiqPrice(collatAmountBN, mintAmount).then(({ liquidationPrice }) => {
      setLiqPrice(liquidationPrice)
    })
  }, [collatAmountBN, mintAmount, getCollatRatioAndLiqPrice, vault?.shortAmount])

  return (
    <div>
      {vaultId && showManageLink ? (
        <Typography className={classes.link} style={{ margin: 'auto' }}>
          <Link href={`vault/${vaultId}`}>Manage Vault</Link>
        </Typography>
      ) : null}
      <div style={{ marginBottom: '16px' }} />
      <PrimaryInput
        id="lp-page-mint-eth-input"
        value={collatAmount}
        onChange={(v) => setCollatAmount(v)}
        label="Collateral"
        tooltip={Tooltips.SellOpenAmount}
        actionTxt="Max"
        onActionClicked={() => setCollatAmount(toTokenAmount(balance ?? BIG_ZERO, 18).toString())}
        unit="ETH"
        convertedValue={0.0}
        hint={
          !!mintMinCollatError ? (
            mintMinCollatError
          ) : (
            <div className={classes.hint}>
              <span className={classes.hintTextContainer}>
                <span className={classes.hintTitleText}>Balance</span>{' '}
                <span>{toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4)}</span>
              </span>
              <span style={{ marginLeft: '4px' }}>ETH</span>
            </div>
          )
        }
        error={connected && collatAmountBN.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)}
      />
      <div className={classes.divider}>
        <TextField
          size="small"
          value={collatPercent}
          type="number"
          style={{ width: 300 }}
          onChange={(event: any) => setCollatPercent(Number(event.target.value))}
          id="filled-basic"
          label="Collateral Ratio"
          variant="outlined"
          error={!!minCollRatioError}
          helperText={minCollRatioError}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption">%</Typography>
              </InputAdornment>
            ),
          }}
          inputProps={{
            min: '0',
          }}
        />
      </div>
      <div className={classes.thirdHeading}></div>
      <CollatRange onCollatValueChange={(val) => setCollatPercent(val)} collatValue={collatPercent} />
      <TradeDetails
        actionTitle="Mint"
        amount={mintAmount.toFixed(6)}
        unit="oSQTH"
        value={getWSqueethPositionValue(mintAmount).toFixed(2)}
        hint={`Balance ${oSqueethBal.toFixed(6)}`}
      />
      <div className={classes.divider}>
        <TradeInfoItem
          label="Liquidation Price"
          value={liqPrice.toFixed(2)}
          tooltip={`${Tooltips.LiquidationPrice}. ${Tooltips.Twap}`}
          unit="USDC"
          priceType="twap"
        />
        <TradeInfoItem
          label="Current collateral ratio"
          value={existingCollatPercent}
          tooltip={Tooltips.CurrentCollRatio}
          unit="%"
        />
        <PrimaryButton
          id="mint-to-lp-btn"
          variant="contained"
          onClick={mint}
          className={classes.amountInput}
          style={{ width: '100%' }}
          disabled={
            !supportedNetwork || (connected && collatAmountBN.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) || loading
          }
        >
          {!supportedNetwork ? (
            'Unsupported Network'
          ) : loading ? (
            <CircularProgress color="primary" size="1.5rem" />
          ) : (
            'Mint'
          )}
        </PrimaryButton>
      </div>
    </div>
  )
}

const GetSqueeth: React.FC = () => {
  const classes = useStyles()
  const { lpState, dispatch } = useLPState()

  const onMint = () => {
    dispatch({ type: LPActions.GO_TO_PROVIDE_LIQUIDITY })
  }

  return (
    <>
      <Typography component="span" color="primary">
        {lpState.obtainMethod === OBTAIN_METHOD.BUY ? 'Buy Squeeth to LP' : 'Mint Squeeth to LP'}
      </Typography>
      <motion.div
        initial={{ x: '-5%', opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        className={classes.getSqueethCard}
      >
        {lpState.obtainMethod === OBTAIN_METHOD.BUY ? (
          <Long
            isLPage
            // balance={Number(toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4))}
            open={true}
          // closeTitle="Sell squeeth ERC20"
          />
        ) : (
          <MintSqueeth onMint={onMint} />
        )}
      </motion.div>
    </>
  )
}

export default GetSqueeth
