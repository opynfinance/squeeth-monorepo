import { Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip } from '@material-ui/core'
import Paper from '@material-ui/core/Paper'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import Link from 'next/link'
import * as React from 'react'
import { useState } from 'react'
import { useAtomValue } from 'jotai'

import { SecondaryTab, SecondaryTabs } from '../../components/Tabs'
import { Tooltips, UniswapIFrameOpen } from '@constants/enums'
import { inRange } from '@utils/calculations'
import { UniswapIframe } from '../Modal/UniswapIframe'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import { activePositionsAtom, closedPositionsAtom, isWethToken0Atom } from 'src/state/positions/atoms'
import { useGetWSqueethPositionValue } from 'src/state/squeethPool/hooks'
import { useLPPositionsQuery } from 'src/state/positions/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    tableContainer: {
      flexBasis: '72%',
      marginRight: '1.5em',
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      backgroundColor: `${theme.palette.background.paper}40`,
      height: '25vh',
    },
    isLPageTableContainer: {
      flexBasis: '72%',
      marginTop: theme.spacing(2),
      marginRight: '1.5em',
    },
    table: {
      minWidth: 650,
    },
    listLink: {
      color: '#FF007A',
    },
    linkHover: {
      '&:hover': {
        opacity: 0.7,
      },
    },
    anchor: {
      color: '#FF007A',
      fontSize: '16px',
    },
    tokenIdLink: {
      textDecoration: 'underline',
      cursor: 'pointer',
    },
    inRange: {
      backgroundColor: theme.palette.success.main,
    },
    outRange: {
      backgroundColor: theme.palette.error.main,
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
    },
    infoIcon: {
      fontSize: '.75rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
    },
  }),
)

interface LPTableProps {
  isLPage?: boolean
  pool?: Pool | undefined
}

const calculatePnL = (
  depositedToken0: string | undefined,
  depositedToken1: string | undefined,
  withdrawToken0: string | undefined,
  withdrawToken1: string | undefined,
  ethPrice: BigNumber,
  squeethPrice: BigNumber,
  currValue: BigNumber | undefined,
  isWethToken0: boolean,
): BigNumber => {
  if (!depositedToken0 || !depositedToken1 || !currValue) {
    return new BigNumber(0)
  }
  const depToken0 = new BigNumber(depositedToken0)
  const depToken1 = new BigNumber(depositedToken1)

  const withToken0 = new BigNumber(withdrawToken0 || 0)
  const withToken1 = new BigNumber(withdrawToken1 || 0)

  const ethDepValue = (isWethToken0 ? depToken0 : depToken1).times(ethPrice)
  const squeethDepValue = (isWethToken0 ? depToken1 : depToken0).times(squeethPrice)
  const ethWithdrawValue = (isWethToken0 ? withToken0 : withToken1).times(ethPrice)
  const squeethWithdrawValue = (isWethToken0 ? withToken1 : withToken0).times(squeethPrice)

  const originalValue = ethDepValue.plus(squeethDepValue).minus(ethWithdrawValue).minus(squeethWithdrawValue)
  return currValue.minus(originalValue)
}

export const LPTable: React.FC<LPTableProps> = ({ isLPage, pool }) => {
  const classes = useStyles()
  const activePositions = useAtomValue(activePositionsAtom)
  const closedPositions = useAtomValue(closedPositionsAtom)
  const { loading: lpLoading } = useLPPositionsQuery()

  const [activeTab, setActiveTab] = useState(0)
  const ethPrice = useETHPrice()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const networkId = useAtomValue(networkIdAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)

  return (
    <TableContainer component={Paper} className={isLPage ? classes.isLPageTableContainer : classes.tableContainer}>
      {isLPage ? (
        <SecondaryTabs
          value={activeTab}
          onChange={() => (activeTab === 0 ? setActiveTab(1) : setActiveTab(0))}
          aria-label="simple tabs example"
          centered
          variant="fullWidth"
          className={classes.tabBackGround}
        >
          <SecondaryTab label="Active" />
          <SecondaryTab label="Closed" />
        </SecondaryTabs>
      ) : null}
      <Table aria-label="simple table" className={classes.table}>
        <TableHead>
          <TableRow style={{ fontSize: '0.8rem' }}>
            <TableCell align="left">Token ID</TableCell>
            <TableCell align="left">In Range</TableCell>
            <Tooltip title={Tooltips.PercentOfPool}>
              <TableCell align="left">% of Pool</TableCell>
            </Tooltip>
            <TableCell align="left">Liquidity</TableCell>
            {/* <TableCell align="left">Collected Fees</TableCell> */}
            <TableCell align="left">Uncollected Fees</TableCell>
            <TableCell align="left">Value</TableCell>
            {
              //only show PnL on active tab for now until closed is implemented
              activeTab === 0 ? (
                <TableCell align="left">
                  <span>PnL</span>
                  <Tooltip title={Tooltips.LPPnL}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </TableCell>
              ) : null
            }
          </TableRow>
        </TableHead>

        {isLPage && activeTab === 1 ? (
          <TableBody>
            {closedPositions?.length === 0 ? (
              lpLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" style={{ textAlign: 'center', fontSize: '16px' }}>
                    <p>Loading...</p>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" style={{ textAlign: 'center', fontSize: '16px' }}>
                    <p>No Closed LP Positions</p>

                    <div>
                      <UniswapIframe text={'Close LP Position'} closePosition={true} />
                    </div>
                  </TableCell>
                </TableRow>
              )
            ) : (
              closedPositions?.map((p) => {
                return (
                  <TableRow key={p.id}>
                    <TableCell component="th" align="left" scope="row">
                      <a
                        href={
                          networkId === 3
                            ? `https://squeeth-uniswap.netlify.app/#/pool/${p.id}`
                            : `https://app.uniswap.org/#/pool/${p.id}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className={classes.tokenIdLink}
                      >
                        #{p.id}
                      </a>
                    </TableCell>
                    <TableCell align="left">
                      <Chip label="Closed" size="small" />
                    </TableCell>
                    <TableCell align="left">
                      {((pool ? p.liquidity / Number(pool?.liquidity) : 0) * 100).toFixed(3)}
                    </TableCell>
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>
                        {Number(p.amount0).toFixed(4)} {p.token0.symbol}
                      </span>
                      <span>
                        {Number(p.amount1).toFixed(4)} {p.token1.symbol}
                      </span>
                    </TableCell>
                    {/* <TableCell align="left">
                <span style={{ marginRight: '.5em' }}>
                  {p.collectedFeesToken0} {p.token0.symbol}
                </span>
                <span>
                  {p.collectedFeesToken1} {p.token1.symbol}
                </span>
              </TableCell> */}
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>
                        {p.fees0?.toFixed(6)} {p.token0.symbol}
                      </span>
                      <span>
                        {p.fees1?.toFixed(6)} {p.token1.symbol}
                      </span>
                    </TableCell>
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>$ {p.dollarValue?.toFixed(2)}</span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}

            {closedPositions && closedPositions?.length > 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <UniswapIframe text={'Close LP Position'} closePosition={true} />
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        ) : (
          <TableBody>
            {activePositions?.length === 0 ? (
              lpLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" style={{ textAlign: 'center', fontSize: '16px' }}>
                    <p>Loading...</p>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" style={{ textAlign: 'center', fontSize: '16px' }}>
                    <p>No Existing LP Positions</p>

                    <div>
                      <p>1. Mint or buy squeeth on the right.</p>
                      <a
                        href={UniswapIFrameOpen[networkId]}
                        target={'_blank'}
                        rel="noreferrer"
                        style={{ textDecoration: 'underline' }}
                      >
                        {' '}
                        <p>2. Deposit Squeeth and ETH into Uniswap V3 Pool 🦄</p>{' '}
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              )
            ) : (
              activePositions?.slice(0, isLPage ? activePositions.length : 3).map((p) => {
                return (
                  <TableRow key={p.id}>
                    <TableCell component="th" align="left" scope="row">
                      <a
                        href={
                          networkId === 3
                            ? `https://squeeth-uniswap.netlify.app/#/pool/${p.id}`
                            : `https://app.uniswap.org/#/pool/${p.id}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className={classes.tokenIdLink}
                      >
                        #{p.id}
                      </a>
                    </TableCell>
                    <TableCell align="left">
                      {inRange(p.tickLower.tickIdx, p.tickUpper.tickIdx, pool) ? (
                        <Chip label="Yes" size="small" className={classes.inRange} />
                      ) : (
                        <Chip label="No" size="small" className={classes.outRange} />
                      )}
                    </TableCell>
                    <TableCell align="left">
                      {((pool ? p.liquidity / Number(pool?.liquidity) : 0) * 100).toFixed(3)}
                    </TableCell>
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>
                        {Number(p.amount0).toFixed(4)} {p.token0.symbol}
                      </span>
                      <span>
                        {Number(p.amount1).toFixed(4)} {p.token1.symbol}
                      </span>
                    </TableCell>
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>
                        {p.fees0?.toFixed(6)} {p.token0.symbol}
                      </span>
                      <span>
                        {p.fees1?.toFixed(6)} {p.token1.symbol}
                      </span>
                    </TableCell>
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>$ {p.dollarValue?.toFixed(2)}</span>
                    </TableCell>
                    <TableCell align="left">
                      <span style={{ marginRight: '.5em' }}>
                        ${' '}
                        {calculatePnL(
                          p.depositedToken0,
                          p.depositedToken1,
                          p.withdrawnToken0,
                          p.withdrawnToken1,
                          ethPrice,
                          getWSqueethPositionValue(1),
                          p.dollarValue,
                          isWethToken0,
                        )?.toFixed(3)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
            {!isLPage && activePositions?.length > 3 && (
              <TableRow>
                <TableCell className={classes.linkHover} colSpan={7} align="center" style={{ fontSize: '1rem' }}>
                  <Link href="/lp">View more</Link>
                </TableCell>
              </TableRow>
            )}

            {/* {activePositions && activePositions?.length > 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <UniswapIframe text={'Deposit Squeeth and ETH into Uniswap V3 Pool 🦄'} />
                  </div>
                </TableCell>
              </TableRow>
            )} */}
          </TableBody>
        )}
      </Table>
    </TableContainer>
  )
}
