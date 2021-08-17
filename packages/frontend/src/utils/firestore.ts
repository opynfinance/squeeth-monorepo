import firebase from 'firebase';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'mm-bot-prod.firebaseapp.com',
  projectId: 'mm-bot-prod',
  storageBucket: 'mm-bot-prod.appspot.com',
  messagingSenderId: '539833876431',
  appId: '1:539833876431:web:8d09c724aedd9a7f871cba',
};

console.log(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)

const firebaseApp = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

const db = firebaseApp.firestore();

export default db;
