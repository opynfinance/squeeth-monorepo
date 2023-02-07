import Positions from '@components/Positions'
import { useInitCrabMigration } from '@state/crabMigration/hooks'
import DefaultSiteSeo from '@components/DefaultSiteSeo/DefaultSiteSeo'
import Nav from '@components/Nav'

const PositionsPage = () => {
  useInitCrabMigration()

  return (
    <>
      <DefaultSiteSeo />
      <Nav />

      <Positions />
    </>
  )
}

export default PositionsPage
