import { Grid, Typography } from '@material-ui/core'

const PreviewItem: React.FC<{ title: string; value: string }> = ({ title, value }) => {
  return (
    <Grid container spacing={2}>
      <Grid item xs={6}>
        <Typography variant="body2" color="textSecondary">
          {title}
        </Typography>{' '}
      </Grid>
      <Grid item xs={6}>
        <Typography variant="body2" color="textPrimary" component="span" style={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </Grid>
    </Grid>
  )
}

export default PreviewItem
