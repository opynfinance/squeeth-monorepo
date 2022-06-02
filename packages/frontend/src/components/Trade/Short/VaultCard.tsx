import { createStyles, makeStyles, Card } from '@material-ui/core'
import AccountBalanceIcon from '@material-ui/icons/AccountBalance'
import Image from 'next/image'

import Arrow from '../../../../public/images/gradient-arrow.svg'

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
}
const VaultCard = ({ collatRatio, liqPrice }: VaultCardType) => {
  const classes = useStyles()
  return (
    <Card className={classes.vaultCardContainer}>
      <div className={classes.title}>
        <AccountBalanceIcon fontSize="inherit" />
        <span className={classes.vault}>Vault</span>
      </div>
      <div className={classes.subComponent}>
        <p className={classes.valueTitle}>Liquidation Price</p>
        <div className={classes.valueContainer}>
          <span>${liqPrice.existing}</span>
          <span className={classes.arrow}>
            <Image src={Arrow} alt="Liquidation Arrow" />
          </span>
          <span>${liqPrice.after}</span>
        </div>
      </div>
      <div className={classes.subComponent}>
        <p className={classes.valueTitle}>Vault Collateralization Ratio</p>
        <div className={classes.valueContainer}>
          <span>{collatRatio.existing}%</span>

          <span className={classes.arrow}>
            <Image src={Arrow} alt="Collateral Ratio Arrow" />
          </span>
          <span>{collatRatio.after}%</span>
        </div>
      </div>
    </Card>
  )
}
export default VaultCard
