import React, { useEffect } from 'react'
import { createStyles, makeStyles } from '@material-ui/core/styles'

import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import MyPosition from '@components/Strategies/Crab/MyPosition'
import About from '@components/Strategies/Crab/About'
import StrategyPerformance from '@components/Strategies/Crab/StrategyPerformance'
import { useSetStrategyDataV2, useCurrentCrabPositionValueV2 } from '@state/crab/hooks'
import { useInitCrabMigration } from '@state/crabMigration/hooks'
import SiteSeo from '@components/SiteSeo'
import { CRAB_SEO_DEFAULTS } from '@constants/seo'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: '32px',
      display: 'flex',
      justifyContent: 'center',
      gridGap: '96px',
      flexWrap: 'wrap',
      [theme.breakpoints.down('md')]: {
        gridGap: '40px',
      },
    },
    leftColumn: {
      flex: 1,
      minWidth: '480px',
      [theme.breakpoints.down('xs')]: {
        minWidth: '320px',
      },
    },
    rightColumn: {
      flexBasis: '452px',
      [theme.breakpoints.down('xs')]: {
        flex: '1',
      },
    },
    infoContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '72px',
    },
    tradeSection: {
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(1),
      padding: '32px 24px',
    },
  }),
)

const Crab: React.FC = () => {
  const setStrategyDataV2 = useSetStrategyDataV2()
  const classes = useStyles()
  const { currentCrabPositionValue, isCrabPositionValueLoading, refetchCrabTokenBalance } =
    useCurrentCrabPositionValueV2()

  useInitCrabMigration()

  useEffect(() => {
    setStrategyDataV2()
  }, [setStrategyDataV2])

  return (
    <>
      <SiteSeo
        title={CRAB_SEO_DEFAULTS.TITLE}
        description={CRAB_SEO_DEFAULTS.DESCRIPTION}
        ogImage={CRAB_SEO_DEFAULTS.OG_IMAGE}
        ogImageAlt={CRAB_SEO_DEFAULTS.OG_IMAGE_ALT}
      />

      <div className={classes.container}>
        <div className={classes.leftColumn}>
          <div className={classes.infoContainer}>
            <MyPosition
              currentCrabPositionValue={currentCrabPositionValue}
              isCrabPositionValueLoading={isCrabPositionValueLoading}
            />
            <StrategyPerformance />
            <About />
          </div>
        </div>
        <div className={classes.rightColumn}>
          <div className={classes.tradeSection}>
            <CrabTradeV2 refetchCrabTokenBalance={refetchCrabTokenBalance} />
          </div>
        </div>
      </div>
    </>
  )
}

export default Crab
