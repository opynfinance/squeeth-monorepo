import { Grid, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import Link from 'next/link'
import { FC } from 'react'

import SqueethCard from '@components/SqueethCard'
import LabelWithTooltip from '@components/LabelWithTooltip'
import useYourVaults from '@hooks/useYourVaults'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import useStyles from './useStyles'

const YourVaults: FC = () => {
  const classes = useStyles()
  const { data: { vaults } = {}, loading, error } = useYourVaults()

  if (error) {
    return <Typography color="error">{error.message}</Typography>
  }

  if (loading) {
    return <Typography>loading...</Typography>
  }

  if (vaults?.length === 0) {
    return <Typography>No vaults found</Typography>
  }

  return (
    <>
      {vaults?.map((vault, index) => {
        const vaultShortAmount = toTokenAmount(new BigNumber(vault.shortAmount), 18)
        const vaultCollateralAmount = toTokenAmount(new BigNumber(vault.collateralAmount), 18)

        return (
          <Link key={vault.id} href={`/vault/${vault.id}`} passHref>
            <a>
              <SqueethCard mt={index ? 2 : 0}>
                <Grid container>
                  <Grid item md={4}>
                    <LabelWithTooltip labelVariant="caption" label="ID" />
                    <Typography variant="body1" className={classes.textMonospace}>
                      {vault.id}
                    </Typography>
                  </Grid>

                  <Grid item md={4}>
                    <LabelWithTooltip labelVariant="caption" label="Short Amount" />
                    <Typography variant="body1" className={classes.textMonospace}>
                      {formatNumber(vaultShortAmount.toNumber(), 4)} oSQTH
                    </Typography>
                  </Grid>

                  <Grid item md={4}>
                    <LabelWithTooltip labelVariant="caption" label="Collateral Amount" />
                    <Typography variant="body1" className={classes.textMonospace}>
                      {formatNumber(vaultCollateralAmount.toNumber(), 4)} ETH
                    </Typography>
                  </Grid>
                </Grid>
              </SqueethCard>
            </a>
          </Link>
        )
      })}
    </>
  )
}

export default YourVaults
