import { Tooltip, Typography } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'

import { supportedNetworkAtom, networkIdAtom, connectedWalletAtom, addressAtom } from '@state/wallet/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { LinkButton } from '@components/Button'
import SqueethCard from '@components/SqueethCard'
import { Tooltips } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { indexAtom } from '@state/controller/atoms'
import { formatCurrency } from '@utils/formatter'
import { useENS } from '@hooks/useENS'
import { getNetwork } from '@utils/network'
import useCommonStyles from './useStyles'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
    },
    userInfoContainer: {
      display: 'flex',
      alignItems: 'center',
      gridGap: '6px',
    },
    ethPriceContainer: {
      display: 'flex',
      alignItems: 'center',
    },
    textMedium: {
      fontWeight: 500,
    },
    profileImageCircle: {
      width: theme.spacing(1.5),
      height: theme.spacing(1.5),
      borderRadius: '50%',
      marginRight: theme.spacing(0.5),
      backgroundColor: theme.palette.primary.main,
    },
    ctaButton: {
      fontSize: '16px',
    },
    networkText: {
      textTransform: 'capitalize',
    },
  }),
)

const UserInfo = () => {
  const networkId = useAtomValue(networkIdAtom)
  const address = useAtomValue(addressAtom)
  const isNetworkSupported = useAtomValue(supportedNetworkAtom)

  const { ensName } = useENS(address)

  const shortAddress = useMemo(
    () => (address ? address.slice(0, 6) + '...' + address.slice(address.length - 4, address.length) : ''),
    [address],
  )

  const classes = useStyles()

  return (
    <div className={classes.userInfoContainer}>
      <div className={classes.profileImageCircle} />
      <Typography variant="body1" className={classes.textMedium}>
        {ensName || shortAddress}
        {': '}
      </Typography>
      <Typography variant="body1" className={classes.networkText}>
        {getNetwork(networkId).toLowerCase()} {!isNetworkSupported && '(Unsupported)'}
      </Typography>
    </div>
  )
}

const EthPrice = () => {
  const index = useAtomValue(indexAtom)
  const ethPrice = toTokenAmount(index, 18).sqrt()

  const classes = useStyles()
  const commonClasses = useCommonStyles()

  return (
    <div className={classes.ethPriceContainer}>
      <Typography variant="body1" color="textSecondary">
        ETH Price:
      </Typography>

      <div className={commonClasses.tooltipContainer}>
        <Typography variant="body1" component="span" className={commonClasses.textMonospace}>
          {formatCurrency(ethPrice.toNumber())}
        </Typography>
        <Tooltip title={Tooltips.SpotPrice}>
          <InfoIcon className={commonClasses.infoIcon} />
        </Tooltip>
      </div>
    </div>
  )
}

const HeaderBar: React.FC = () => {
  const isWalletConnected = useAtomValue(connectedWalletAtom)

  const selectWallet = useSelectWallet()
  const classes = useStyles()

  return (
    <SqueethCard>
      <div className={classes.container}>
        {isWalletConnected ? (
          <UserInfo />
        ) : (
          <LinkButton onClick={selectWallet} className={classes.ctaButton}>
            Connect Wallet
          </LinkButton>
        )}
        <EthPrice />
      </div>
    </SqueethCard>
  )
}

export default HeaderBar
