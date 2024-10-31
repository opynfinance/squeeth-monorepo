import { useQuery } from '@apollo/client'
import {
  CircularProgress,
  Link,
  Typography,
  Tooltip,
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
import { useAtom, useAtomValue } from 'jotai'

import ethLogo from '../../public/images/ethereum-eth.svg'
import squeethLogo from '../../public/images/Squeeth.svg'
import { AddButton, RemoveButton } from '@components/Button'
import CollatRange from '@components/CollatRange'
import NumberInput from '@components/Input/NumberInput'
import Nav from '@components/Nav'
import TradeInfoItem from '@components/TradeOld/TradeInfoItem'
import { Tooltips } from '@constants/enums'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT, OSQUEETH_DECIMALS, SQUEETH_BASE_URL } from '../../src/constants'
import { PositionType } from '../../src/types'
import { useRestrictUser } from '@context/restrict-user'
import { useVaultLiquidations } from '@hooks/contracts/useLiquidations'
import { CollateralStatus, Vault } from '../../src/types'
import { getCollatPercentStatus, toTokenAmount } from '@utils/calculations'
import { LinkButton } from '@components/Button'
import { useERC721 } from '@hooks/contracts/useERC721'
import { ACTIVE_POSITIONS_QUERY } from '@queries/uniswap/positionsQuery'
import { positions, positionsVariables } from '@queries/uniswap/__generated__/positions'
import { addressAtom, connectedWalletAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useWalletBalance } from 'src/state/wallet/hooks'
import { addressesAtom, collatPercentAtom, positionTypeAtom } from 'src/state/positions/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { UniswapIframe } from 'src/components/Modal/UniswapIframe'
import {
  useBurnAndRedeem,
  useDepositCollateral,
  useDepositUnuPositionToken,
  useGetCollatRatioAndLiqPrice,
  useGetDebtAmount,
  useGetShortAmountFromDebt,
  useGetTwapEthPrice,
  useGetUniNFTCollatDetail,
  useGetUniNFTDetails,
  useOpenDepositAndMint,
  useWithdrawCollateral,
  useWithdrawUniPositionToken,
  useRedeemVault,
} from 'src/state/controller/hooks'
import {
  useComputeSwaps,
  useLpDebt,
  useMintedDebt,
  useShortDebt,
  usePositionsAndFeesComputation,
} from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import useVault from '@hooks/useVault'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'
import RestrictionInfo from '@components/RestrictionInfo'

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
    overviewHeaderTitle: {
      fontSize: '20px',
      marginTop: theme.spacing(1),
      fontWeight: 300,
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
      maxWidth: '225px',
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
    redeemVaultBtnContainer: {
      marginTop: theme.spacing(4),
      padding: theme.spacing(3),
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
    },
    redeemVaultBtn: {
      width: '100%',
      minHeight: '40px',
      marginTop: theme.spacing(2),
      cursor: 'pointer',
    },
    redeemVaultTitle: {
      fontSize: '20px',
      fontWeight: 500,
      marginBottom: theme.spacing(2),
    },
    redeemVaultDescription: {
      color: theme.palette.text.secondary,
      fontSize: '14px',
      '& span': {
        display: 'block',
        marginTop: theme.spacing(0.5),
        paddingLeft: theme.spacing(2),
      },
    },
    redeemVaultWarning: {
      color: theme.palette.text.secondary,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      fontSize: '14px',

      '& a': {
        textDecoration: 'underline',
      },
    },
    manager: {
      display: 'flex',
      justifyContent: 'space-between',
      margin: theme.spacing(3, 0),
      gap: theme.spacing(2),
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
      marginTop: theme.spacing(2),
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
      marginTop: theme.spacing(2),
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
    manageLPTokenActionsContainer: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
    },
    manageLPTokenActions: {
      display: 'flex',
      justifyContent: 'space-around',
      width: '100%',
    },
    lpManagerContainer: {
      marginTop: theme.spacing(4),
      padding: theme.spacing(3),
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
    },
    lpManagerHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3),
    },
    lpManagerTitle: {
      fontSize: '20px',
      fontWeight: 500,
    },
    lpManagerContent: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(2),
    },
    lpManagerDescription: {
      color: theme.palette.text.secondary,
      textAlign: 'center',
      maxWidth: '600px',
      fontSize: '14px',
      lineHeight: 1.5,
    },
    logoContainer: {
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
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
  REDEEM_UNI_POSITION,
  REDEEM_VAULT,
}

enum VaultError {
  MIN_COLLATERAL = 'Minimum vault collateral is 6.9 ETH',
  MIN_COLLAT_PERCENT = 'Minimum collateral ratio is 150%',
  INSUFFICIENT_ETH_BALANCE = 'Insufficient ETH Balance',
  INSUFFICIENT_OSQTH_BALANCE = 'Insufficient oSQTH Balance',
}

const SelectLP: React.FC<{ lpToken: number; setLpToken: (t: number) => void; disabled?: boolean }> = ({
  lpToken,
  setLpToken,
  disabled,
}) => {
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
        disabled={disabled}
        labelId="demo-simple-select-label"
        id="lp-id-select"
        value={lpToken}
        onChange={(e) => setLpToken(Number(e.target.value))}
        label="LP id"
      >
        <MenuItem value={0} id="lp-id-option-none">
          None
        </MenuItem>
        {data?.positions?.map((p, index) => (
          <MenuItem key={p.id} value={p.id} id={'lp-id-option' + '-' + index}>
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
  const { isRestricted, isWithdrawAllowed } = useRestrictUser()
  usePositionsAndFeesComputation()

  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getDebtAmount = useGetDebtAmount()
  const withdrawCollateral = useWithdrawCollateral()
  const getTwapEthPrice = useGetTwapEthPrice()
  const redeemVault = useRedeemVault()
  const getUniNFTCollatDetail = useGetUniNFTCollatDetail()

  const { vid } = router.query
  const { liquidations } = useVaultLiquidations(Number(vid))
  const mintedDebt = useMintedDebt()
  const shortDebt = useShortDebt()

  const lpedSqueeth = useLpDebt()

  const [minCollateral, setMinCollateral] = useState<string | undefined>(undefined)
  const [collateral, setCollateral] = useState('0')
  const [lpNftCollatPercent, setLpNftCollatPercent] = useState(0)
  const collateralBN = new BigNumber(collateral)
  const [shortAmount, setShortAmount] = useState('0')

  const [twapEthPrice, setTwapEthPrice] = useState(new BigNumber(0))
  const [newLiqPrice, setNewLiqPrice] = useState(new BigNumber(0))
  const [newLpNftLiqPrice, setNewLpNftLiqPrice] = useState(new BigNumber(0))
  const [action, setAction] = useState(VaultAction.ADD_COLLATERAL)
  const [txLoading, setTxLoading] = useState(false)

  const { vault, loading: isVaultLoading, updateVault } = useVault(Number(vid))
  const { existingCollatPercent, existingLiqPrice } = useVaultData(vault as any)
  const [collatPercent, setCollatPercent] = useAtom(collatPercentAtom)

  const [lpedEth, setLpedEth] = useState(new BigNumber(0))
  const [lpedSqueethInEth, setLpedSqueethInEth] = useState(new BigNumber(0))
  const [lpedSqueethAmount, setLpedSqueethAmount] = useState(new BigNumber(0))

  const getUniNFTDetails = useGetUniNFTDetails()

  useEffect(() => {
    const getLPValues = async () => {
      if (!isVaultLoading && vault && Number(vault?.NFTCollateralId) !== 0) {
        try {
          const { ethAmount, squeethValueInEth, squeethAmount } = await getUniNFTDetails(Number(vault?.NFTCollateralId))
          setLpedEth(ethAmount)
          setLpedSqueethInEth(squeethValueInEth)
          setLpedSqueethAmount(squeethAmount)
        } catch (err) {
          console.error('Error getting LP values:', err)
          setLpedEth(new BigNumber(0))
          setLpedSqueethInEth(new BigNumber(0))
          setLpedSqueethAmount(new BigNumber(0))
        }
      } else {
        setLpedEth(new BigNumber(0))
        setLpedSqueethInEth(new BigNumber(0))
        setLpedSqueethAmount(new BigNumber(0))
      }
    }

    getLPValues()
  }, [vault?.NFTCollateralId, isVaultLoading])

  useEffect(() => {
    ;(async () => {
      if (vault) {
        let collateralAmount = vault.collateralAmount
        if (currentLpNftId) {
          const { collateral: uniCollat } = await getUniNFTCollatDetail(currentLpNftId)
          collateralAmount = collateralAmount.plus(uniCollat)
        }
        const debt = await getDebtAmount(vault.shortAmount)
        const collateralWithMinRatio = debt.times(1.5).minus(collateralAmount).toNumber()
        const minCollateral = vault.collateralAmount.minus(MIN_COLLATERAL_AMOUNT).negated().toNumber()
        if (collateralWithMinRatio < 0 && minCollateral < 0) {
          setMinCollateral(Math.max(collateralWithMinRatio, minCollateral).toString())
        } else if (collateralWithMinRatio >= 0 && minCollateral < 0) {
          setMinCollateral(minCollateral.toString())
        } else if (collateralWithMinRatio < 0 && minCollateral >= 0) {
          setMinCollateral(collateralWithMinRatio.toString())
        } else {
          setMinCollateral('0')
        }
      } else {
        setMinCollateral(collateral)
      }
    })()
  }, [vault])

  useEffect(() => {
    getTwapEthPrice().then((price) => {
      setTwapEthPrice(price)
    })
  }, [getTwapEthPrice])

  const updateNftCollateral = async (
    collatAmountToUpdate: BigNumber,
    shortAmountToUpdate: BigNumber,
    lpNftIdToManage: number,
  ) => {
    if (!vault) return

    const { collateralPercent: cp, liquidationPrice: lp } = await getCollatRatioAndLiqPrice(
      collatAmountToUpdate.plus(vault.collateralAmount),
      shortAmountToUpdate.plus(vault.shortAmount),
      lpNftIdToManage, // 0 means to simulate the removal of lp nft
    )

    setNewLpNftLiqPrice(lp)
    setLpNftCollatPercent(cp)
  }

  const updateCollateral = async (collatAmount: string) => {
    setCollateral(collatAmount)
    if (!vault) return
    const collatAmountBN = new BigNumber(collatAmount)

    const { collateralPercent: cp, liquidationPrice: lp } = await getCollatRatioAndLiqPrice(
      collatAmountBN.plus(vault.collateralAmount), // Get liquidation price and collatPercent for total collat after tx happens
      vault.shortAmount,
      currentLpNftId,
    )
    setNewLiqPrice(lp)
    setCollatPercent(cp)
    setAction(collatAmountBN.isPositive() ? VaultAction.ADD_COLLATERAL : VaultAction.REMOVE_COLLATERAL)
  }

  const removeCollat = async (collatAmount: BigNumber) => {
    if (!vault) return

    setTxLoading(true)
    try {
      await withdrawCollateral(Number(vault.id), collatAmount.abs())
      updateVault()

      updateNftCollateral(BIG_ZERO, BIG_ZERO, currentLpNftId)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const handleRedeemVault = async () => {
    if (!vault) return

    setTxLoading(true)
    setAction(VaultAction.REDEEM_VAULT)
    try {
      await redeemVault(Number(vault.id))
      updateVault()
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

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

  const currentLpNftId = Number(vault?.NFTCollateralId)
  const isLPDeposited = currentLpNftId !== 0

  useEffect(() => {
    if (isLPDeposited && !!currentLpNftId && vault) {
      setAction(VaultAction.DEPOSIT_UNI_POSITION)
      updateNftCollateral(BIG_ZERO, BIG_ZERO, 0)
    }
  }, [isLPDeposited, currentLpNftId, vault, vault?.collateralAmount, vault?.shortAmount])

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
                <Typography className={classes.overviewValue} id="vault-total-debt-bal">
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
                <Typography className={classes.overviewValue} id="vault-shorted-debt-bal">
                  {shortDebt?.gt(0) ? shortDebt.toFixed(6) : 0}
                </Typography>
              </div>
              <div className={classes.debtItem}>
                <Typography className={classes.overviewTitle}>
                  <span>Minted Debt (oSQTH)</span>
                  <Tooltip title={Tooltips.MintedDebt}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </Typography>

                <Typography className={classes.overviewValue} id="vault-minted-debt-bal">
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
                <Typography className={classes.overviewValue} id="vault-lped-debt-bal">
                  {lpedSqueeth?.gt(0) ? lpedSqueeth.toFixed(6) : 0}
                </Typography>
              </div>
            </div>
          </div>

          <Typography className={classes.overviewHeaderTitle} variant="h6">
            Vault Stats
          </Typography>
          <div className={classes.overview}>
            <div className={classes.overviewItem}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography className={classes.overviewValue}>
                  {existingCollatPercent === Infinity ? '--' : `${existingCollatPercent || 0} %`}
                </Typography>
                <Typography className={clsx(classes.collatStatus, collatClass)} variant="caption" id="vault-cr">
                  {getCollatPercentStatus(existingCollatPercent)}
                </Typography>
              </div>
              <Typography className={classes.overviewTitle}>Collateral percent</Typography>
            </div>
            <div className={classes.overviewItem}>
              <Typography className={classes.overviewValue}>
                $ <span id="vault-liqp">{!existingLiqPrice.isFinite() ? '--' : existingLiqPrice.toFixed(2)}</span>
              </Typography>
              <Typography className={classes.overviewTitle}>Liquidation Price</Typography>
            </div>
          </div>

          <Typography className={classes.overviewHeaderTitle} variant="h6">
            Vault Components
          </Typography>
          <div className={classes.overview}>
            <div className={classes.overviewItem}>
              <Typography className={classes.overviewValue}>{vault?.shortAmount.toFixed(6)}</Typography>
              <Typography className={classes.overviewTitle}>Total Debt (oSQTH)</Typography>
            </div>
            <div className={classes.overviewItem}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography className={classes.overviewValue} id="vault-collat-amount">
                  {vault?.collateralAmount.toFixed(4)}
                </Typography>
                {!isRestricted || isWithdrawAllowed ? (
                  <>
                    {vault?.shortAmount.isZero() && vault.collateralAmount.gt(0) ? (
                      <button
                        className={clsx(classes.withdrawBtn)}
                        onClick={() => {
                          updateCollateral(vault!.collateralAmount.negated().toString())
                          removeCollat(vault!.collateralAmount)
                        }}
                        id="withdraw-collat-submit-btn"
                      >
                        WITHDRAW
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
              <Typography className={classes.overviewTitle}>Collateral (ETH)</Typography>
            </div>

            {isLPDeposited && (
              <>
                <div className={classes.overviewItem}>
                  <Typography className={classes.overviewValue}>{lpedEth.toFixed(4)}</Typography>
                  <Typography className={classes.overviewTitle}>LP ETH Amount</Typography>
                </div>
                <div className={classes.overviewItem}>
                  <Typography className={classes.overviewValue}>{lpedSqueethAmount.toFixed(6)}</Typography>
                  <Typography className={classes.overviewTitle}>LP oSQTH Amount</Typography>
                </div>
              </>
            )}
          </div>
          <div className={classes.redeemVaultBtnContainer}>
            <Typography className={classes.redeemVaultTitle}>Redeem Vault</Typography>
            <Typography className={classes.redeemVaultDescription}>
              {!vault?.shortAmount?.gt(0) && !isLPDeposited ? (
                <Typography className={classes.redeemVaultDescription}>
                  This vault has no positions to redeem.
                </Typography>
              ) : (
                <>
                  <Typography className={classes.redeemVaultDescription}>
                    {(vault?.shortAmount?.gt(0) || isLPDeposited) && (
                      <>
                        This will:
                        {isLPDeposited && <span>• Withdraw your LP position from vault</span>}
                        {vault?.shortAmount?.gt(0) && (
                          <span>• Close your short position by burning {vault.shortAmount.toFixed(6)} oSQTH</span>
                        )}
                      </>
                    )}
                  </Typography>

                  <RemoveButton
                    id="redeem-vault-submit-tx-btn"
                    onClick={handleRedeemVault}
                    disabled={txLoading}
                    className={classes.redeemVaultBtn}
                  >
                    {action === VaultAction.REDEEM_VAULT && txLoading ? (
                      <CircularProgress color="primary" size="1rem" />
                    ) : (
                      'Redeem Vault'
                    )}
                  </RemoveButton>
                </>
              )}
            </Typography>

            {lpedSqueeth?.gt(vault?.shortAmount || BIG_ZERO) && (
              <Typography className={classes.redeemVaultWarning}>
                <b>Note:</b> After redemption, you&apos;ll need to manually redeem{' '}
                {lpedSqueeth.minus(vault?.shortAmount || BIG_ZERO).toFixed(6)} oSQTH from your LP position using the
                &quot;Redeem Long&quot; functionality on the <Link href="/squeeth">trade page</Link>
              </Typography>
            )}
          </div>

          {!isRestricted || isWithdrawAllowed ? (
            <div className={classes.lpManagerContainer}>
              <div className={classes.lpManagerHeader}>
                <div className={classes.logoContainer}>
                  <Image src={ethLogo} alt="ETH logo" width={40} height={40} />
                </div>
                <Typography className={classes.lpManagerTitle}>Manage LP Token</Typography>
              </div>

              <div className={classes.lpManagerContent}>
                <UniswapIframe text={'Withdraw LP Position'} closePosition={true} />
                <Typography className={classes.lpManagerDescription}>
                  If you have an LP position in Uniswap, you can withdraw it directly here. The withdrawn oSQTH can then
                  be redeemed separately.
                </Typography>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

const Main: React.FC = () => {
  const classes = useStyles()

  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  if (!connected || !supportedNetwork) {
    return (
      <div>
        <Nav />
        <div className={classes.loading}>
          <Typography variant="h5" color="textSecondary">
            {!supportedNetwork ? 'Unsupported Network' : 'Connect wallet'}
          </Typography>
        </div>
      </div>
    )
  }

  return <Component />
}

const Page: React.FC = () => {
  return (
    <>
      <DefaultSiteSeo />
      <Main />
    </>
  )
}

export default Page
