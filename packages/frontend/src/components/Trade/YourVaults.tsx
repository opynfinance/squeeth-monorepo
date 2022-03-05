import LabelWithTooltip from '../LabelWithTooltip'
import SqueethCard from '../SqueethCard'
import useYourVaults from '../../hooks/useYourVaults'
import { Box, Grid, Typography } from '@material-ui/core'
import { toTokenAmount } from '../../utils/calculations'
import BigNumber from 'bignumber.js'
import Link from 'next/link'
import { FC } from 'react'

const YourVaults: FC = () => {
  const { data: { vaults } = {}, loading, error } = useYourVaults()

  if (error) {
    return <Typography color="error">{error.message}</Typography>
  }

  if (loading) {
    return <Typography>Loading...</Typography>
  }

  return (
    <>
      {vaults?.map((vault, index) => (
        <Link key={vault.id} href={`/vault/${vault.id}`} passHref>
          <a>
            <SqueethCard mt={index ? 2 : 0}>
              <Grid container>
                <Grid item md={4}>
                  <LabelWithTooltip labelVariant="caption" label="Id" />
                  <Typography variant="body1">{vault.id}</Typography>
                </Grid>

                <Grid item md={4}>
                  <LabelWithTooltip labelVariant="caption" label="Short Amount" />
                  <Box display="flex" alignItems="flex-end">
                    <Typography variant="body1">
                      {toTokenAmount(new BigNumber(vault.shortAmount), 18).toFixed(4)}
                    </Typography>
                    <Box clone pl={2}>
                      <Typography variant="body2" color="error">
                        oSQTH
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                <Grid item md={4}>
                  <LabelWithTooltip labelVariant="caption" label="Collateral Amount" />
                  <Box display="flex" alignItems="flex-end">
                    <Typography variant="body1">
                      {toTokenAmount(new BigNumber(vault.collateralAmount), 18).toFixed(4)}
                    </Typography>
                    <Box clone pl={2}>
                      <Typography variant="body2" color="error">
                        ETH
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </SqueethCard>
          </a>
        </Link>
      ))}
    </>
  )
}

export default YourVaults
