import { createStyles, makeStyles, Card } from '@material-ui/core'
import AccountBalanceIcon from '@material-ui/icons/AccountBalance'
import RemoveIcon from '@material-ui/icons/Remove'
import Image from 'next/image'
import clsx from 'clsx'

import { MIN_COLLATERAL_AMOUNT } from 'src/constants/'
import IncreaseArrow from '../../../../public/images/gradient-arrow.svg'
import DecreaseArrow from '../../../../public/images/gradient-arrow-dec.svg'
import BigNumber from 'bignumber.js'

const useStyles = makeStyles(() =>
  createStyles({
    vaultCardContainer: {
      width: '300px',
      margin: 'auto',
      backgroundColor: 'rgba(255, 255, 255, 0.12)',
      marginBottom: '1.5em',
      padding: '1em',
      textAlign: 'left',
    },
    title: {
      display: 'flex',
      alignItems: 'center',
    },
    vault: {
      marginLeft: '.5em',
      fontWeight: 'bold',
    },
    valueTitle: {
      opacity: 0.75,
      margin: '0',
      marginBottom: '.5em',
    },
    valueContainer: {
      display: 'flex',
      alignItems: 'center',
      fontWeight: 'bold',
    },
    arrow: {
      margin: '0 1em',
    },
    subComponent: {
      marginTop: '1em',
    },
    errorMsg: {
      fontSize: '.75rem',
      color: 'rgb(245, 71, 92)',
    },
    vaultItems: {
      flexBasis: '30%',
    },
  }),
)

type VaultCardType = {
  collatRatio: {
    existing: number | string
    after: number | string
  }
  liqPrice: {
    existing: number | string
    after: number | string
  }
  vaultCollat: {
    existing: number | string
    after: number | string
  }
  error?: {
    vaultCollat: string
  }
  vaultId: number
  id?: string
}
const VaultCard = ({ collatRatio, liqPrice, id, vaultCollat, vaultId, error }: VaultCardType) => {
  const classes = useStyles()
  return (
    <Card className={classes.vaultCardContainer} id={id}>
      <div className={classes.title}>
        <AccountBalanceIcon fontSize="inherit" />
        <span className={classes.vault}>Vault</span>
      </div>
      <div className={classes.subComponent}>
        <p className={classes.valueTitle}>Liquidation Price</p>
        <div className={classes.valueContainer}>
          <span className={clsx(classes.vaultItems, 'prev-liq-price')}>${liqPrice.existing}</span>

          <span className={clsx(classes.vaultItems, classes.arrow)}>
            {new BigNumber(liqPrice.after).lt(new BigNumber(liqPrice.existing)) ? (
              <Image src={DecreaseArrow} alt="Liquidation Arrow" />
            ) : (
              <Image src={IncreaseArrow} alt="Liquidation Arrow" />
            )}
          </span>

          <span className={clsx(classes.vaultItems, 'current-liq-price')}>${liqPrice.after}</span>
        </div>
      </div>
      <div className={classes.subComponent}>
        <p className={classes.valueTitle}>Vault Collateralization Ratio</p>
        <div className={classes.valueContainer}>
          <span className={clsx(classes.vaultItems, 'prev-collat-ratio')}>
            {vaultId !== 0 ? `${collatRatio.existing}%` : <RemoveIcon />}
          </span>

          <span className={clsx(classes.vaultItems, classes.arrow)}>
            {new BigNumber(collatRatio.after).lt(new BigNumber(collatRatio.existing)) ? (
              <Image src={DecreaseArrow} alt="Collateral Ratio Arrow" />
            ) : (
              <Image src={IncreaseArrow} alt="Collateral Ratio Arrow" />
            )}
          </span>
          <span className={clsx(classes.vaultItems, 'current-collat-ratio')}>{collatRatio.after}%</span>
        </div>
      </div>
      <div className={classes.subComponent}>
        <p className={classes.valueTitle}>Vault Collateral</p>
        <div className={classes.valueContainer}>
          <span className={clsx(classes.vaultItems, 'prev-vault-collat')}>
            {vaultId !== 0 ? `${vaultCollat.existing} ETH` : <RemoveIcon />}
          </span>

          <span className={clsx(classes.vaultItems, classes.arrow)}>
            {new BigNumber(vaultCollat.after).lt(new BigNumber(vaultCollat.existing)) ? (
              <Image src={DecreaseArrow} alt="Vault Collateral Arrow" />
            ) : (
              <Image src={IncreaseArrow} alt="Vault Collateral Arrow" />
            )}
          </span>
          <span className={clsx(classes.vaultItems, 'current-vault-collat')}>{vaultCollat.after} ETH</span>
        </div>
        {error?.vaultCollat !== '' && (
          <span className={classes.errorMsg}>{`Minimum vault collateral is ${MIN_COLLATERAL_AMOUNT} ETH`}</span>
        )}
      </div>
    </Card>
  )
}
export default VaultCard
