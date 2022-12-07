import { CircularProgress, InputAdornment, Typography, Box, Collapse } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useState, useEffect, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import Link from 'next/link'

import {
  BIG_ZERO,
  MIN_COLLATERAL_AMOUNT,
  OSQUEETH_DECIMALS,
  Tooltips,
  DEFAULT_COLLATERAL_RATIO,
} from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { PrimaryButtonNew } from '@components/Button'
import { InputToken, InputNumber } from '@components/InputNew'
import CollatRatioSlider from '@components/CollatRatioSlider'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useWalletBalance, useSelectWallet } from '@state/wallet/hooks'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useGetCollatRatioAndLiqPrice, useGetShortAmountFromDebt, useOpenDepositAndMint } from '@state/controller/hooks'
import { useFirstValidVault } from '@state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import useAppEffect from '@hooks/useAppEffect'
import { useETHPrice } from '@hooks/useETHPrice'
import ethLogo from 'public/images/eth-logo.svg'
import osqthLogo from 'public/images/osqth-logo.svg'
import Alert from '@components/Alert'
import Checkbox from '@components/Checkbox'
import useAppCallback from '@hooks/useAppCallback'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import Metric, { MetricLabel } from '@components/Metric'
import { formatNumber, formatCurrency } from '@utils/formatter'
import RestrictionInfo from '@components/RestrictionInfo'
import { useRestrictUser } from '@context/restrict-user'

const useStyles = makeStyles((theme) =>
  createStyles({
    link: {
      color: theme.palette.primary.main,
      marginBottom: theme.spacing(1),
      margin: 'auto',
      width: '300px',
      textDecoration: 'underline',
    },
    label: {
      fontSize: '18px',
      fontWeight: 700,
    },
  }),
)

interface MintProps {
  onMint: () => void
  showManageLink?: boolean
}

const MintSqueeth: React.FC<MintProps> = ({ onMint, showManageLink }) => {
  const classes = useStyles()
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: oSqueethBal } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const { data } = useWalletBalance()
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const { loading: vaultIDLoading } = useVaultManager()
  const openDepositAndMint = useOpenDepositAndMint()
  const getShortAmountFromDebt = useGetShortAmountFromDebt()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const { existingCollat, existingCollatPercent } = useVaultData(vault)
  const ethPrice = useETHPrice()
  const { data: osqthPrice } = useOSQTHPrice()
  const { isRestricted } = useRestrictUser()
  const selectWallet = useSelectWallet()

  const [mintAmount, setMintAmount] = useState(new BigNumber(0))
  const [collatAmount, setCollatAmount] = useState('0')
  const collatAmountBN = useMemo(() => new BigNumber(collatAmount), [collatAmount])
  const [collatPercent, setCollatPercent] = useState(200)
  const [loading, setLoading] = useState(false)
  const [mintMinCollatError, setMintMinCollatError] = useState('')
  const [minCollRatioError, setMinCollRatioError] = useState('')
  const [liqPrice, setLiqPrice] = useState(BIG_ZERO)
  const [usingDefaultCollatRatio, setUsingDefaultCollatRatio] = useState(true)

  const balance = toTokenAmount(data ?? BIG_ZERO, 18)

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
  }, [collatPercent, collatAmountBN.toString()])

  useAppEffect(() => {
    if (collatPercent < 150) {
      setMinCollRatioError('Minimum collateral ratio is 150%')
    } else {
      setMinCollRatioError('')
    }

    if (connected && collatAmountBN.isGreaterThan(balance)) {
      setMintMinCollatError('Insufficient ETH balance')
    } else if (connected && collatAmountBN.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) {
      setMintMinCollatError('Minimum collateral is 6.9 ETH')
    }
  }, [balance.toString(), connected, existingCollat.toString(), collatAmountBN.toString(), collatPercent])

  const handleDefaultCollatRatioToggle = useAppCallback(
    (value: boolean) => {
      if (value) {
        setCollatPercent(DEFAULT_COLLATERAL_RATIO)
      }
      setUsingDefaultCollatRatio(value)
    },
    [setCollatPercent],
  )

  useEffect(() => {
    if (collatPercent !== DEFAULT_COLLATERAL_RATIO) {
      setUsingDefaultCollatRatio(false)
    }
  }, [collatPercent])

  useAppEffect(() => {
    getCollatRatioAndLiqPrice(collatAmountBN, mintAmount).then(({ liquidationPrice }) => {
      setLiqPrice(liquidationPrice)
    })
  }, [collatAmountBN, mintAmount, getCollatRatioAndLiqPrice, vault?.shortAmount])

  const error = mintMinCollatError ? mintMinCollatError : minCollRatioError ? minCollRatioError : ''

  return (
    <div>
      {vaultId && showManageLink ? (
        <Typography className={classes.link} style={{ margin: 'auto' }}>
          <Link href={`vault/${vaultId}`}>Manage Vault</Link>
        </Typography>
      ) : null}

      <Box display="flex" flexDirection="column">
        <InputToken
          id="lp-page-mint-eth-input"
          value={collatAmount}
          onInputChange={(v) => setCollatAmount(v)}
          symbol="ETH"
          logo={ethLogo}
          balance={balance}
          usdPrice={ethPrice}
          onBalanceClick={() => setCollatAmount(balance.toString())}
          error={!!mintMinCollatError}
          helperText={mintMinCollatError}
        />
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center" marginTop="24px">
        <Typography variant="h4" className={classes.label}>
          Collateral ratio
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gridGap: '16px' }}>
          <Checkbox
            name="priceRangeDefault"
            label="Default"
            isChecked={usingDefaultCollatRatio}
            onInputChange={handleDefaultCollatRatioToggle}
          />

          <InputNumber
            id="collateral-ratio-input"
            value={collatPercent}
            onInputChange={(value) => setCollatPercent(Number(value))}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end" style={{ opacity: '0.5' }}>
                  %
                </InputAdornment>
              ),
            }}
            style={{ width: '80px' }}
          />
        </Box>
      </Box>

      <Box marginTop="24px">
        <CollatRatioSlider
          collatRatio={collatPercent}
          onCollatRatioChange={(value) => setCollatPercent(value)}
          minCollatRatio={150}
        />

        <Box marginTop="12px">
          <Collapse in={collatPercent <= 150}>
            <Alert severity="error" id={'collat-ratio-slider-alert-text'}>
              You will get liquidated.
            </Alert>
          </Collapse>
          <Collapse in={collatPercent > 150 && collatPercent < 200}>
            <Alert severity="warning" id={'collat-ratio-slider-alert-text'}>
              Collateral ratio is too low. You will get liquidated at 150%.
            </Alert>
          </Collapse>

          <Collapse in={collatPercent >= 200 && collatPercent < 225}>
            <Alert severity="warning" id={'collat-ratio-slider-alert-text'}>
              Collateral ratio is risky.
            </Alert>
          </Collapse>
        </Box>
      </Box>

      <Box marginTop="24px">
        <InputToken
          id="lp-page-mint-trade-details"
          label="Mint"
          value={mintAmount.toFixed(6)}
          symbol="oSQTH"
          logo={osqthLogo}
          balance={oSqueethBal}
          usdPrice={osqthPrice}
          showMaxAction={false}
          readOnly
        />
      </Box>

      <Collapse in={!!error}>
        <Alert severity="error" marginTop="24px">
          {error}
        </Alert>
      </Collapse>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gridGap="12px"
        marginTop="24px"
        flexWrap="wrap"
      >
        <Metric
          label={
            <MetricLabel
              label="Liquidation Price"
              tooltipTitle={`${Tooltips.LiquidationPrice}. ${Tooltips.Twap}`}
              isSmall
            />
          }
          value={formatCurrency(liqPrice.toNumber())}
          isSmall
        />
        <Metric
          label={<MetricLabel label="Current collateral ratio" tooltipTitle={Tooltips.CurrentCollRatio} isSmall />}
          value={formatNumber(existingCollatPercent) + '%'}
          isSmall
        />
      </Box>

      {isRestricted && <RestrictionInfo marginTop="24px" />}

      <Box marginTop="24px">
        {isRestricted ? (
          <PrimaryButtonNew fullWidth variant="contained" disabled={true} id="mint-to-lp-restricted-btn">
            {'Unavailable'}
          </PrimaryButtonNew>
        ) : !connected ? (
          <PrimaryButtonNew fullWidth variant="contained" onClick={selectWallet} id="mint-to-lp-connect-wallet-btn">
            {'Connect Wallet'}
          </PrimaryButtonNew>
        ) : (
          <PrimaryButtonNew
            id="mint-to-lp-btn"
            variant="contained"
            onClick={mint}
            fullWidth
            disabled={
              !supportedNetwork ||
              (connected && collatAmountBN.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) ||
              loading
            }
          >
            {!supportedNetwork ? (
              'Unsupported Network'
            ) : loading ? (
              <CircularProgress color="primary" size="1.5rem" />
            ) : (
              'Mint'
            )}
          </PrimaryButtonNew>
        )}
      </Box>
    </div>
  )
}

export default MintSqueeth
