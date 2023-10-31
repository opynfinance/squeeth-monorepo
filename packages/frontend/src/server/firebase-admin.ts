import { initializeApp, cert } from 'firebase-admin/app'
import { apps, auth, firestore } from 'firebase-admin'

try {
  apps.length > 0
    ? apps[0]
    : initializeApp({
        credential: cert({
          projectId: 'mm-bot-prod',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY,
        }),
      })
} catch (e) {
  console.log('error in init', e)
}

export const dbAdmin = firestore()

export const updateBlockedAddress = async (address: string) => {
  const docRef = dbAdmin.collection('blocked-addresses').doc(address)
  const doc = await docRef.get()

  let visitCount = 0

  if (doc.exists) {
    visitCount = doc.data()?.visitCount + 1
    await docRef.set({ address, visitCount })
  } else {
    visitCount = 1
    await docRef.set({ address, visitCount: 1 })
  }

  return visitCount
}

export const getAddressStrikeCount = async (address: string) => {
  const docRef = dbAdmin.collection('blocked-addresses').doc(address)
  const doc = await docRef.get()
  if (doc.exists) {
    return doc.data()?.visitCount
  } else {
    return 0
  }
}
