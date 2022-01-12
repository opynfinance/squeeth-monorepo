import { useRouter } from 'next/router'
import { useEffect } from 'react'

import { useRestrictUser } from '@context/restrict-user'
// import { Modal } from '../src/components/Modal/Modal'

const App = () => {
  const router = useRouter()
  const { handleRestrictUser } = useRestrictUser()
  // const [open] = useState(true)

  useEffect(() => {
    handleRestrictUser(true)
    router.push('/')
  }, [])

  return null
  // (
  //   <>
  //     <Modal open={open} title="">
  //       <div style={{ padding: '0 1em' }}>
  //         <h1 style={{ textAlign: 'center', fontSize: '1.5rem' }}>Country Not supported</h1>
  //         <p>Unfortunately, this app is not supported in your region. </p>
  //       </div>
  //     </Modal>
  //   </>
  // )
}

export default App
