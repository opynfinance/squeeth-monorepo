import LabelWithTooltip from '@components/LabelWithTooltip'
import SqueethCard from '@components/SqueethCard'
import { Grid, Typography } from '@material-ui/core'
import { FC } from 'react'

const mockedVault = {
  id: 172,
  shortAmount: 200,
  collateralAmount: 240,
}

const YourVaults: FC = () => {
  return (
    <SqueethCard>
      <Grid container>
        <Grid item md={4}>
          <LabelWithTooltip labelVariant="caption" label="Id" tooltip="Vault Id" />
          <Typography variant="body1">{mockedVault.id}</Typography>
        </Grid>

        <Grid item md={4}>
          <LabelWithTooltip labelVariant="caption" label="Short Amount" />
          <Typography variant="body1">{mockedVault.shortAmount}</Typography>
        </Grid>

        <Grid item md={4}>
          <LabelWithTooltip labelVariant="caption" label="Collateral Amount" />
          <Typography variant="body1">{mockedVault.collateralAmount}</Typography>
        </Grid>
      </Grid>
    </SqueethCard>
  )
}

export default YourVaults
