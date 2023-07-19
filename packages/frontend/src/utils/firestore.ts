import firebase from 'firebase'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const firebaseApp = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app()

const db = firebaseApp.firestore()

export default db

export const isBlocked = async (address: string) => {
  const docRef = db.doc(`blocked-addresses/${address}`)
  console.log('docRef', docRef)
  const doc = (await docRef.get()).data()
  console.log('doc', doc)

  return doc?.visitCount > 0
}
