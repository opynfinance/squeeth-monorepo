import Nav from '@components/Nav'
import Positions from '@components/Positions'
import { useInitCrabMigration } from '@state/crabMigration/hooks'
import SiteSeo from '@components/SiteSeo'

const PositionsPage = () => {
  useInitCrabMigration()

  return (
    <>
      <SiteSeo />
      <Nav />

      <Positions />
    </>
  )
}

export default PositionsPage
