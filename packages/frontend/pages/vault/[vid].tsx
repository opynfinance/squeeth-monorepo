import { useQuery } from '@apollo/client'
import {
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
  Tooltip,
  Input,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core'
import { orange } from '@material-ui/core/colors'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import AccessTimeIcon from '@material-ui/icons/AccessTime'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'
import Image from 'next/image'
import { useRouter } from 'next/router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'

import ethLogo from '../../public/images/ethereum-eth.svg'
import squeethLogo from '../../public/images/Squeeth.svg'
import { AddButton, RemoveButton } from '@components/Button'
import CollatRange from '@components/CollatRange'
import NumberInput from '@components/Input/NumberInput'
import Nav from '@components/Nav'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import { Tooltips } from '@constants/enums'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT, OSQUEETH_DECIMALS } from '../../src/constants'
import { PositionType } from '../../src/types'
import { useRestrictUser } from '@context/restrict-user'
import { useController } from '@hooks/contracts/useController'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { useVaultData } from '@hooks/useVaultData'
import { CollateralStatus, Vault } from '../../src/types'
import { squeethClient } from '@utils/apollo-client'
import { getCollatPercentStatus, toTokenAmount } from '@utils/calculations'
import { LinkButton } from '@components/Button'
import { useERC721 } from '@hooks/contracts/useERC721'
import { useAddresses } from '@hooks/useAddress'
import { ACTIVE_POSITIONS_QUERY } from '@queries/uniswap/positionsQuery'
import { positions, positionsVariables } from '@queries/uniswap/__generated__/positions'
import { addressAtom, connectedWalletAtom } from 'src/state/wallet/atoms'
import { useWalletBalance } from 'src/state/wallet/hooks'
import { addressesAtom, positionTypeAtom } from 'src/state/positions/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import {
  useBurnAndRedeem,
  useDepositCollateral,
  useDepositUnuPositionToken,
  useGetCollatRatioAndLiqPrice,
  useGetDebtAmount,
  useGetShortAmountFromDebt,
  useGetTwapEthPrice,
  useOpenDepositAndMint,
  useWithdrawCollateral,
  useWithdrawUniPositionToken,
} from 'src/state/controller/hooks'
import { useComputeSwaps, useLpDebt, useMintedDebt, useShortDebt } from 'src/state/positions/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: theme.spacing(0, 'auto'),
      padding: theme.spacing(6, 0),
      width: '840px',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        padding: theme.spacing(0, 2),
        margin: theme.spacing(0, 'auto'),
      },
    },
    overview: {
      display: 'flex',
      marginTop: theme.spacing(2),
      gap: '15px',
    },
    overviewItem: {
      display: 'flex',
      flexDirection: 'column',
      background: theme.palette.background.stone,
      // height: '75px',
      width: '100%',
      borderRadius: theme.spacing(2),
      padding: theme.spacing(2, 3),
      marginBottom: '1em',
    },
    overviewTitle: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
    },
    overviewValue: {
      fontSize: '22px',
    },
    manager: {
      display: 'flex',
      justifyContent: 'space-between',
      margin: theme.spacing(3, 0),
    },
    managerItem: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      padding: theme.spacing(4, 6.8),
    },
    managerItemHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      '& > *': {
        display: 'flex',
        justifyContent: 'flex-start',
      },
    },
    managerItemTitle: {
      fontSize: '24px',
      marginLeft: theme.spacing(1),
      fontWeight: 300,
    },
    managerActions: {
      margin: 'auto',
      width: '300px',
      display: 'flex',
      justifyContent: 'space-around',
    },
    actionBtn: {
      width: '75px',
    },
    collatContainer: {
      margin: 'auto',
      width: '300px',
      marginBottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'left',
      justifyContent: 'center',
      marginTop: '16px',
    },
    txDetails: {
      background: theme.palette.background.paper,
      width: '300px',
      borderRadius: theme.spacing(1),
      marginLeft: 'auto',
      marginRight: 'auto',
      marginBottom: theme.spacing(2),
      padding: theme.spacing(1),
    },
    collatStatus: {
      padding: theme.spacing(0, 1),
      borderRadius: theme.spacing(0.5),
      fontSize: '10px',
      fontWeight: 600,
    },
    safe: {
      background: `${theme.palette.success.main}30`,
      color: theme.palette.success.main,
    },
    risky: {
      background: `${orange[600]}30`,
      color: orange[600],
    },
    danger: {
      background: `${theme.palette.error.main}30`,
      color: theme.palette.error.main,
    },
    loading: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      marginTop: theme.spacing(8),
    },
    liquidationContainer: {
      width: '380px',
      background: `${theme.palette.error.main}20`,
      borderRadius: theme.spacing(2),
      marginTop: theme.spacing(2),
      padding: theme.spacing(2, 3),
    },
    liqTitle: {
      fontWeight: 600,
      marginLeft: theme.spacing(2),
    },
    liqItem: {
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(1),
    },
    withdrawBtn: {
      padding: theme.spacing(0, 1),
      borderRadius: theme.spacing(0.5),
      fontSize: '10px',
      fontWeight: 600,
      marginLeft: theme.spacing(1),
      color: theme.palette.error.main,
      textDecoration: 'underline',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
    },
    debtOverview: {
      margin: '2em 0 2em 0',
    },
    debtItem: {
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #DCDAE94D',
      width: '100%',
      padding: theme.spacing(2),
      borderRadius: theme.spacing(2),
      // marginBottom: '1em',
    },
    vaultHeader: {
      display: 'flex',
      justifyContent: 'space-between',
    },
    infoIcon: {
      fontSize: '14px',
      marginLeft: theme.spacing(0.5),
    },
    mintBurnTooltip: {
      display: 'flex',
      justifyContent: 'space-between',
    },
  }),
)

enum VaultAction {
  ADD_COLLATERAL,
  REMOVE_COLLATERAL,
  MINT_SQUEETH,
  BURN_SQUEETH,
  APPROVE_UNI_POSITION,
  DEPOSIT_UNI_POSITION,
  WITHDRAW_UNI_POSITION,
}

enum VaultError {
  MIN_COLLATERAL = 'Minimum vault collateral is 6.9 ETH',
  MIN_COLLAT_PERCENT = 'Minimum collateral ratio is 150%',
  INSUFFICIENT_ETH_BALANCE = 'Insufficient ETH Balance',
  INSUFFICIENT_OSQTH_BALANCE = 'Insufficient oSQTH Balance',
}

const SelectLP: React.FC<{ lpToken: number; setLpToken: (t: number) => void }> = ({ lpToken, setLpToken }) => {
  // const { squeethPool } = useAddresses()
  // const { address } = useWallet()
  const { squeethPool } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)

  const { data } = useQuery<positions, positionsVariables>(ACTIVE_POSITIONS_QUERY, {
    variables: {
      poolAddress: squeethPool,
      owner: address || '',
    },
    fetchPolicy: 'no-cache',
  })

  return (
    <FormControl variant="outlined" style={{ width: '300px' }} size="small">
      <InputLabel id="demo-simple-select-outlined-label">LP Id</InputLabel>
      <Select
        labelId="demo-simple-select-label"
        id="demo-simple-select"
        value={lpToken}
        onChange={(e) => setLpToken(Number(e.target.value))}
        label="LP id"
      >
        <MenuItem value={0}>None</MenuItem>
        {data?.positions?.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.id}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

const Component: React.FC = () => {
  const classes = useStyles()
  const router = useRouter()
  const { isRestricted } = useRestrictUser()

  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getDebtAmount = useGetDebtAmount()
  const getShortAmountFromDebt = useGetShortAmountFromDebt()
  const depositCollateral = useDepositCollateral()
  const withdrawCollateral = useWithdrawCollateral()
  const openDepositAndMint = useOpenDepositAndMint()
  const burnAndRedeem = useBurnAndRedeem()
  const getTwapEthPrice = useGetTwapEthPrice()
  const depositUniPositionToken = useDepositUnuPositionToken()
  const withdrawUniPositionToken = useWithdrawUniPositionToken()

  const { data: balance } = useWalletBalance()
  const { vid } = router.query
  const { liquidations } = useVaultLiquidations(Number(vid))
  const { oSqueeth, nftManager, controller } = useAtomValue(addressesAtom)
  const positionType = useAtomValue(positionTypeAtom)
  const { squeethAmount } = useComputeSwaps()
  const mintedDebt = useMintedDebt()
  const shortDebt = useShortDebt()
  const lpedSqueeth = useLpDebt()
  const { getApproved, approve } = useERC721(nftManager)
  const oSqueethBal = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)

  const [collateral, setCollateral] = useState('0')
  const collateralBN = new BigNumber(collateral)
  const [shortAmount, setShortAmount] = useState('0')
  const shortAmountBN = new BigNumber(shortAmount)
  const [maxToMint, setMaxToMint] = useState(new BigNumber(0))
  const [twapEthPrice, setTwapEthPrice] = useState(new BigNumber(0))
  const [newLiqPrice, setNewLiqPrice] = useState(new BigNumber(0))
  const [action, setAction] = useState(VaultAction.ADD_COLLATERAL)
  const [txLoading, setTxLoading] = useState(false)
  const [uniTokenToDeposit, setUniTokenToDeposit] = useState(0)

  const {
    vault,
    existingCollatPercent,
    existingLiqPrice,
    updateVault,
    setCollatPercent,
    collatPercent,
    isVaultLoading,
  } = useVaultData(Number(vid))

  useEffect(() => {
    getTwapEthPrice().then((price) => {
      setTwapEthPrice(price)
    })
  }, [getTwapEthPrice])

  const updateCollateral = async (collatAmount: string) => {
    setCollateral(collatAmount)
    if (!vault) return
    const collatAmountBN = new BigNumber(collatAmount)

    const { collateralPercent: cp, liquidationPrice: lp } = await getCollatRatioAndLiqPrice(
      collatAmountBN.plus(vault.collateralAmount), // Get liquidation price and collatPercent for total collat after tx happens
      vault.shortAmount,
      lpNftId,
    )
    setNewLiqPrice(lp)
    setCollatPercent(cp)
    setAction(collatAmountBN.isPositive() ? VaultAction.ADD_COLLATERAL : VaultAction.REMOVE_COLLATERAL)
  }

  const updateCollatPercent = async (percent: number) => {
    if (!vault) return

    setAction(percent > existingCollatPercent ? VaultAction.ADD_COLLATERAL : VaultAction.REMOVE_COLLATERAL)
    setCollatPercent(percent)
    const debt = await getDebtAmount(vault.shortAmount)
    const newCollat = new BigNumber(percent).times(debt).div(100)
    const { liquidationPrice: lp } = await getCollatRatioAndLiqPrice(newCollat, vault.shortAmount, lpNftId)
    setNewLiqPrice(lp)
    setCollateral(newCollat.minus(vault.collateralAmount).toString())
  }

  const updateShort = async (shortAmountInput: string) => {
    setShortAmount(shortAmountInput)
    if (!vault) return
    const shortAmountBN = new BigNumber(shortAmountInput)

    const { collateralPercent: cp, liquidationPrice: lp } = await getCollatRatioAndLiqPrice(
      vault.collateralAmount,
      shortAmountBN.plus(vault.shortAmount),
      lpNftId,
    )
    setNewLiqPrice(lp)
    setCollatPercent(cp)
    setAction(shortAmountBN.isPositive() ? VaultAction.MINT_SQUEETH : VaultAction.BURN_SQUEETH)
  }

  const updateDebtForCollatPercent = async (percent: number) => {
    setCollatPercent(percent)
    if (!vault) return

    const debt = vault.collateralAmount.times(100).div(percent)
    const _shortAmt = await getShortAmountFromDebt(debt)
    setShortAmount(_shortAmt.minus(vault.shortAmount).toString())
    setAction(percent < existingCollatPercent ? VaultAction.MINT_SQUEETH : VaultAction.BURN_SQUEETH)
    const { liquidationPrice: lp } = await getCollatRatioAndLiqPrice(vault.collateralAmount, _shortAmt, lpNftId)
    setNewLiqPrice(lp)
  }

  const getMaxToMint = async () => {
    const max = await getShortAmountFromDebt(vault ? vault?.collateralAmount.times(100).div(150) : new BigNumber(0))
    const diff = vault ? max.minus(vault?.shortAmount) : new BigNumber(0)
    setMaxToMint(diff)
  }

  const updateUniLPTokenInput = useCallback(
    async (input: number) => {
      setUniTokenToDeposit(input)
      if (!input) return
      console.log(input)
      const approvedAddress: string = await getApproved(input)
      if (controller === (approvedAddress || '')) {
        setAction(VaultAction.DEPOSIT_UNI_POSITION)
      } else {
        setAction(VaultAction.APPROVE_UNI_POSITION)
      }
    },
    [controller, getApproved],
  )

  useEffect(() => {
    if (vault) getMaxToMint()
  }, [vault, vault?.collateralAmount])

  const addCollat = async (collatAmount: BigNumber) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await depositCollateral(vault.id, collatAmount)
      updateVault()
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const removeCollat = async (collatAmount: BigNumber) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await withdrawCollateral(vault.id, collatAmount.abs())
      updateVault()
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const mint = async (sAmount: BigNumber) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await openDepositAndMint(vault.id, sAmount, new BigNumber(0))
      updateVault()
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const burn = async (sAmount: BigNumber) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await burnAndRedeem(vault.id, sAmount.abs(), new BigNumber(0))
      updateVault()
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const depositUniLPToken = async (tokenId: number) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await depositUniPositionToken(vault.id, tokenId)
      setAction(VaultAction.WITHDRAW_UNI_POSITION)
      updateVault()
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const withdrawUniLPToken = async () => {
    if (!vault) return

    setTxLoading(true)
    setAction(VaultAction.WITHDRAW_UNI_POSITION)
    try {
      await withdrawUniPositionToken(vault.id)
      updateVault()
      setAction(VaultAction.DEPOSIT_UNI_POSITION)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const approveUniLPToken = async (tokenId: number) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await approve(controller, tokenId)
      setAction(VaultAction.DEPOSIT_UNI_POSITION)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const isCollatAction = useMemo(() => {
    return action === VaultAction.ADD_COLLATERAL || action === VaultAction.REMOVE_COLLATERAL
  }, [action])

  const { adjustAmountError, adjustCollatError } = useMemo(() => {
    let adjustCollatError = null
    let adjustAmountError = null
    if (!vault?.shortAmount.gt(0)) return { adjustAmountError, adjustCollatError }
    if (action === VaultAction.ADD_COLLATERAL && collateralBN.gt(toTokenAmount(balance ?? BIG_ZERO, 18)))
      adjustCollatError = VaultError.INSUFFICIENT_ETH_BALANCE
    else if (isCollatAction) {
      if (collatPercent < 150) adjustCollatError = VaultError.MIN_COLLAT_PERCENT
      else if (
        vault?.collateralAmount.minus(collateralBN.negated()).lt(MIN_COLLATERAL_AMOUNT) &&
        !vault?.collateralAmount.minus(collateralBN.negated()).eq(0)
      )
        adjustCollatError = VaultError.MIN_COLLATERAL
    } else {
      if (action === VaultAction.BURN_SQUEETH && shortAmountBN.abs().gt(oSqueethBal))
        adjustAmountError = VaultError.INSUFFICIENT_OSQTH_BALANCE
      else if (collatPercent < 150) adjustAmountError = VaultError.MIN_COLLAT_PERCENT
    }

    return { adjustAmountError, adjustCollatError }
  }, [shortAmount, collateral, collatPercent, action, balance?.toString()])

  const collatStatus = useCallback(() => {
    return getCollatPercentStatus(existingCollatPercent)
  }, [existingCollatPercent])

  const collatClass = useMemo(() => {
    if (collatStatus() === CollateralStatus.SAFE) return classes.safe
    if (collatStatus() === CollateralStatus.RISKY) return classes.risky
    return classes.danger
  }, [classes.danger, classes.risky, classes.safe, collatStatus()])

  const { totalLiquidated, totalCollatPaid } = liquidations.reduce(
    (acc, l) => {
      acc.totalLiquidated = acc.totalLiquidated.plus(l.debtAmount)
      acc.totalCollatPaid = acc.totalCollatPaid.plus(l.collateralPaid)
      return acc
    },
    {
      totalLiquidated: new BigNumber(0),
      totalCollatPaid: new BigNumber(0),
    },
  )

  const lpNftId = Number(vault?.NFTCollateralId)
  const isLPDeposited = lpNftId !== 0

  return (
    <div>
      <Nav />
      {isVaultLoading ? (
        <div className={classes.loading}>
          <Typography variant="h5" color="textSecondary">
            Loading...
          </Typography>
        </div>
      ) : (
        <div className={classes.container}>
          <div className={classes.vaultHeader}>
            <Typography color="primary" variant="h6">
              Manage Vault #{vid}
            </Typography>
            <div className={classes.liqItem}>
              <Typography color="textSecondary" variant="body2">
                ETH Price:
              </Typography>
              <Typography variant="body2" color="textPrimary" style={{ marginLeft: '8px' }}>
                $ {twapEthPrice.toFixed(2)}
              </Typography>
              <Tooltip title="This is a 7min TWAP from Uniswap">
                <AccessTimeIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>
          </div>
          {liquidations.length ? (
            <div className={classes.liquidationContainer}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <ReportProblemOutlinedIcon color="error" fontSize="small" />
                <Typography className={classes.liqTitle} color="error">
                  Vault Liquidated
                </Typography>
              </div>
              <div className={classes.liqItem}>
                <Typography color="textSecondary" variant="body2">
                  Total squeeth liquidated:
                </Typography>
                <Typography variant="body2" color="textPrimary" style={{ marginLeft: '8px' }}>
                  {totalLiquidated.toFixed(6)} oSQTH
                </Typography>
              </div>
              <div className={classes.liqItem}>
                <Typography color="textSecondary" variant="body2">
                  Total collateral paid:
                </Typography>
                <Typography variant="body2" color="textPrimary" style={{ marginLeft: '8px' }}>
                  {totalCollatPaid.toFixed(6)} ETH
                </Typography>
              </div>
            </div>
          ) : null}

          <div className={classes.debtOverview}>
            <div className={classes.overview}>
              <div className={classes.debtItem}>
                <Typography className={classes.overviewTitle}>
                  <span>Total Debt (oSQTH)</span>
                  <Tooltip title={Tooltips.TotalDebt}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </Typography>
                <Typography className={classes.overviewValue}>
                  {vault?.shortAmount.gt(0) ? vault?.shortAmount.toFixed(6) : 0}
                </Typography>
              </div>
              <div className={classes.debtItem}>
                <Typography className={classes.overviewTitle}>
                  <span>Short Debt (oSQTH)</span>
                  <Tooltip title={Tooltips.ShortDebt}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </Typography>
                <Typography className={classes.overviewValue}>{shortDebt?.gt(0) ? shortDebt.toFixed(6) : 0}</Typography>
              </div>
              <div className={classes.debtItem}>
                <Typography className={classes.overviewTitle}>
                  <span>Minted Debt (oSQTH)</span>
                  <Tooltip title={Tooltips.MintedDebt}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </Typography>

                <Typography className={classes.overviewValue}>
                  {mintedDebt.gt(0) ? mintedDebt.toFixed(6) : 0}
                </Typography>
              </div>
              <div className={classes.debtItem}>
                <Typography className={classes.overviewTitle}>
                  <span>LPed Debt (oSQTH)</span>
                  <Tooltip title={Tooltips.LPDebt}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </Typography>
                <Typography className={classes.overviewValue}>
                  {lpedSqueeth?.gt(0) ? lpedSqueeth.toFixed(6) : 0}
                </Typography>
              </div>
            </div>
          </div>

          <div className={classes.overview}>
            {/* <div className={classes.overviewItem}>
              <Typography className={classes.overviewValue}>{vault?.shortAmount.toFixed(6)}</Typography>
              <Typography className={classes.overviewTitle}>Total Debt (oSQTH)</Typography>
            </div> */}
            <div className={classes.overviewItem}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography className={classes.overviewValue}>{vault?.collateralAmount.toFixed(4)}</Typography>
                {!isRestricted ? (
                  <>
                    {vault?.shortAmount.isZero() && vault.collateralAmount.gt(0) ? (
                      <button
                        className={clsx(classes.withdrawBtn)}
                        onClick={() => {
                          updateCollateral(vault!.collateralAmount.negated().toString())
                          removeCollat(vault!.collateralAmount)
                        }}
                      >
                        WITHDRAW
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Typography className={classes.overviewTitle}>Collateral (ETH)</Typography>
            </div>
            <div className={classes.overviewItem}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography className={classes.overviewValue}>
                  {existingCollatPercent === Infinity ? '--' : `${existingCollatPercent || 0} %`}
                </Typography>
                <Typography className={clsx(classes.collatStatus, collatClass)} variant="caption">
                  {getCollatPercentStatus(existingCollatPercent)}
                </Typography>
              </div>
              <Typography className={classes.overviewTitle}>Collateral percent</Typography>
            </div>
            <div className={classes.overviewItem}>
              <Typography className={classes.overviewValue}>
                $ {!existingLiqPrice.isFinite() ? '--' : existingLiqPrice.toFixed(2)}
              </Typography>
              <Typography className={classes.overviewTitle}>Liquidation Price</Typography>
            </div>
          </div>
          {!isRestricted ? (
            <>
              <div className={classes.manager}>
                <div className={classes.managerItem}>
                  <div className={classes.managerItemHeader}>
                    <div style={{ width: '40px', height: '40px' }}>
                      <Image src={ethLogo} alt="logo" width={40} height={40} />
                    </div>
                    <Typography className={classes.managerItemTitle} variant="h6">
                      Adjust Collateral
                    </Typography>
                  </div>
                  <div style={{ margin: 'auto', width: '300px', marginTop: '24px' }}>
                    <div className={classes.mintBurnTooltip}>
                      <Tooltip title={Tooltips.CollatRemoveAdd} style={{ alignSelf: 'center' }}>
                        <InfoIcon fontSize="small" className={classes.infoIcon} />
                      </Tooltip>
                      <LinkButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          collateralBN.isPositive()
                            ? updateCollateral(toTokenAmount(balance ?? BIG_ZERO, 18).toString())
                            : updateCollateral(vault ? vault?.collateralAmount.negated().toString() : collateral)
                        }
                        variant="text"
                      >
                        Max
                      </LinkButton>
                    </div>

                    <NumberInput
                      min={vault?.collateralAmount.negated().toString()}
                      step={0.1}
                      placeholder="Collateral"
                      onChange={(v) => updateCollateral(v)}
                      value={collateral}
                      unit="ETH"
                      hint={
                        !!adjustCollatError
                          ? adjustCollatError
                          : `Balance ${toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(4)} ETH`
                      }
                      error={!!adjustCollatError}
                    />
                  </div>
                  <div className={classes.collatContainer}>
                    <TextField
                      size="small"
                      type="number"
                      style={{ width: '100%', marginRight: '4px' }}
                      onChange={(event) => updateCollatPercent(Number(event.target.value))}
                      value={isCollatAction ? collatPercent : existingCollatPercent}
                      id="filled-basic"
                      label="Ratio"
                      variant="outlined"
                      // error={collatPercent < 150}
                      // helperText={`Balance ${toTokenAmount(balance, 18).toFixed(4)} ETH`}
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
                    <CollatRange
                      collatValue={isCollatAction ? collatPercent : existingCollatPercent}
                      onCollatValueChange={updateCollatPercent}
                    />
                  </div>
                  <div className={classes.txDetails}>
                    <TradeInfoItem
                      label="New liquidation price"
                      value={isCollatAction ? (newLiqPrice || 0).toFixed(2) : '0'}
                      frontUnit="$"
                    />
                  </div>
                  <div className={classes.managerActions}>
                    <RemoveButton
                      className={classes.actionBtn}
                      size="small"
                      disabled={action !== VaultAction.REMOVE_COLLATERAL || txLoading || !!adjustCollatError}
                      onClick={() => removeCollat(collateralBN.abs())}
                    >
                      {action === VaultAction.REMOVE_COLLATERAL && txLoading ? (
                        <CircularProgress color="primary" size="1rem" />
                      ) : (
                        'Remove'
                      )}
                    </RemoveButton>
                    <AddButton
                      onClick={() => addCollat(collateralBN)}
                      className={classes.actionBtn}
                      size="small"
                      disabled={action !== VaultAction.ADD_COLLATERAL || txLoading || !!adjustCollatError}
                    >
                      {action === VaultAction.ADD_COLLATERAL && txLoading ? (
                        <CircularProgress color="primary" size="1rem" />
                      ) : (
                        'Add'
                      )}
                    </AddButton>
                  </div>
                </div>
                <div className={classes.managerItem}>
                  <div className={classes.managerItemHeader}>
                    <div style={{ width: '40px', height: '40px' }}>
                      <Image src={squeethLogo} alt="logo" width={40} height={40} />
                    </div>
                    <Typography className={classes.managerItemTitle} variant="h6">
                      Adjust Debt
                    </Typography>
                  </div>
                  <div style={{ margin: 'auto', width: '300px', marginTop: '24px' }}>
                    <div className={classes.mintBurnTooltip}>
                      <Tooltip title={Tooltips.MintBurnInput} style={{ alignSelf: 'center' }}>
                        <InfoIcon fontSize="small" className={classes.infoIcon} />
                      </Tooltip>
                      <LinkButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          shortAmountBN.isPositive()
                            ? updateShort(maxToMint.toString())
                            : updateShort(oSqueethBal.negated().toString())
                        }
                        variant="text"
                      >
                        Max
                      </LinkButton>
                    </div>
                    <NumberInput
                      min={oSqueethBal.negated().toString()}
                      step={0.1}
                      placeholder="Amount"
                      onChange={(v) => updateShort(v)}
                      value={shortAmount}
                      unit="oSQTH"
                      hint={
                        !!adjustAmountError
                          ? adjustAmountError
                          : `Balance ${
                              oSqueethBal?.isGreaterThan(0) &&
                              positionType === PositionType.LONG &&
                              oSqueethBal.minus(squeethAmount).isGreaterThan(0)
                                ? oSqueethBal.minus(squeethAmount).toFixed(8)
                                : oSqueethBal.toFixed(8)
                            } oSQTH`
                      }
                      error={!!adjustAmountError}
                    />
                    <div className={classes.collatContainer}>
                      <TextField
                        size="small"
                        type="number"
                        style={{ width: '100%', marginRight: '4px' }}
                        onChange={(event) => updateDebtForCollatPercent(Number(event.target.value))}
                        value={!isCollatAction ? collatPercent : existingCollatPercent}
                        id="filled-basic"
                        label="Ratio"
                        variant="outlined"
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
                      <CollatRange
                        collatValue={!isCollatAction ? collatPercent : existingCollatPercent}
                        onCollatValueChange={updateDebtForCollatPercent}
                      />
                    </div>
                  </div>
                  <div className={classes.txDetails}>
                    <TradeInfoItem
                      label="New liquidation price"
                      value={!isCollatAction ? (newLiqPrice || 0).toFixed(2) : '0'}
                      frontUnit="$"
                    />
                  </div>
                  <div className={classes.managerActions}>
                    <RemoveButton
                      onClick={() => burn(shortAmountBN)}
                      className={classes.actionBtn}
                      size="small"
                      disabled={action !== VaultAction.BURN_SQUEETH || txLoading || !!adjustAmountError}
                    >
                      {action === VaultAction.BURN_SQUEETH && txLoading ? (
                        <CircularProgress color="primary" size="1rem" />
                      ) : (
                        'Burn'
                      )}
                    </RemoveButton>
                    <AddButton
                      onClick={() => mint(shortAmountBN)}
                      className={classes.actionBtn}
                      size="small"
                      disabled={action !== VaultAction.MINT_SQUEETH || txLoading || !!adjustAmountError}
                    >
                      {action === VaultAction.MINT_SQUEETH && txLoading ? (
                        <CircularProgress color="primary" size="1rem" />
                      ) : (
                        'Mint'
                      )}
                    </AddButton>
                  </div>
                </div>
              </div>
              <div className={classes.manager}>
                <div className={classes.managerItem}>
                  <div className={classes.managerItemHeader}>
                    <div style={{ marginLeft: '16px', width: '40px', height: '40px' }}>
                      <Image src={ethLogo} alt="logo" width={40} height={40} />
                    </div>
                    <Typography className={classes.managerItemTitle} variant="h6">
                      Manage LP token
                    </Typography>
                  </div>
                  <div style={{ margin: 'auto', width: '300px', marginTop: '24px' }}>
                    {!isLPDeposited ? (
                      <SelectLP lpToken={uniTokenToDeposit} setLpToken={updateUniLPTokenInput} />
                    ) : (
                      <TextField
                        size="small"
                        value={isLPDeposited ? vault?.NFTCollateralId : uniTokenToDeposit}
                        type="number"
                        style={{ width: 300 }}
                        onChange={(event) => updateUniLPTokenInput(Number(event.target.value))}
                        id="filled-basic"
                        label="Uni LP token"
                        variant="outlined"
                        disabled={isLPDeposited}
                      />
                    )}
                  </div>
                  <div className={classes.managerActions} style={{ marginTop: '16px' }}>
                    {isLPDeposited ? (
                      <RemoveButton
                        className={classes.actionBtn}
                        size="small"
                        disabled={txLoading}
                        onClick={() => withdrawUniLPToken()}
                      >
                        {action === VaultAction.WITHDRAW_UNI_POSITION && txLoading ? (
                          <CircularProgress color="primary" size="1rem" />
                        ) : (
                          'Remove'
                        )}
                      </RemoveButton>
                    ) : null}
                    {!isLPDeposited && action === VaultAction.APPROVE_UNI_POSITION ? (
                      <AddButton
                        onClick={() => approveUniLPToken(uniTokenToDeposit)}
                        className={classes.actionBtn}
                        size="small"
                        disabled={action !== VaultAction.APPROVE_UNI_POSITION || txLoading}
                      >
                        {action === VaultAction.APPROVE_UNI_POSITION && txLoading ? (
                          <CircularProgress color="primary" size="1rem" />
                        ) : (
                          'Approve'
                        )}
                      </AddButton>
                    ) : null}
                    {!isLPDeposited && action === VaultAction.DEPOSIT_UNI_POSITION ? (
                      <AddButton
                        onClick={() => depositUniLPToken(uniTokenToDeposit)}
                        className={classes.actionBtn}
                        size="small"
                        disabled={action !== VaultAction.DEPOSIT_UNI_POSITION || txLoading}
                      >
                        {action === VaultAction.DEPOSIT_UNI_POSITION && txLoading ? (
                          <CircularProgress color="primary" size="1rem" />
                        ) : (
                          'Deposit'
                        )}
                      </AddButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

const Main: React.FC = () => {
  const classes = useStyles()
  // const { connected } = useWallet()

  const connected = useAtomValue(connectedWalletAtom)

  if (!connected) {
    return (
      <div>
        <Nav />
        <div className={classes.loading}>
          <Typography variant="h5" color="textSecondary">
            Connect wallet
          </Typography>
        </div>
      </div>
    )
  }

  return <Component />
}

export default Main
