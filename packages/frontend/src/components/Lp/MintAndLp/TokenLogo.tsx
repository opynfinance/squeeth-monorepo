import { makeStyles, createStyles } from '@material-ui/core/styles'
import React from 'react'
import Image from 'next/image'

const useTokenLogoStyles = makeStyles((theme) =>
  createStyles({
    logoContainer: {
      width: '40px',
      height: '40px',
      marginRight: theme.spacing(1),
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      height: '24px',
      width: '14px',
    },
  }),
)

const TokenLogo: React.FC<{ logoSrc: string }> = ({ logoSrc }) => {
  const classes = useTokenLogoStyles()

  return (
    <div className={classes.logoContainer}>
      <div className={classes.logo}>
        <Image src={logoSrc} alt="logo" />
      </div>
    </div>
  )
}

export default TokenLogo
