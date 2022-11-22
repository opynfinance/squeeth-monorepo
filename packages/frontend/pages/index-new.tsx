import { useState } from 'react'

import Nav from '@components/Nav'
import { WelcomeModal } from '@components/Trade/WelcomeModal'
import Footer from '@components/PageFooter'

function TradePage() {
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false)

  const handleClose = () => {
    setWelcomeModalOpen(false)
  }

  return (
    <div>
      <Nav />

      <Footer />
      <WelcomeModal open={isWelcomeModalOpen} handleClose={handleClose} />
    </div>
  )
}

export default TradePage
