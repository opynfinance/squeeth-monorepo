import { useState } from 'react'

import { Modal } from '../src/components/Modal/Modal'

const App = () => {
  const [open] = useState(true)

  return (
    <>
      <Modal open={open} title="">
        <div style={{ padding: '0 1em' }}>
          <h1 style={{ textAlign: 'center', fontSize: '1.5rem' }}>Country Not supported</h1>
          <p>Unfortunately, this app is not supported in your region. </p>
        </div>
      </Modal>
    </>
  )
}

export default App
