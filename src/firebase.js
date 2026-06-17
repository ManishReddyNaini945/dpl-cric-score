import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB9XrJY3rXF_3rgfmU4jNwMcV1krCyzV-M",
  authDomain: "digi-cric-score.firebaseapp.com",
  projectId: "digi-cric-score",
  storageBucket: "digi-cric-score.firebasestorage.app",
  messagingSenderId: "575549577278",
  appId: "1:575549577278:web:b41e50c955b82ec8cad96f",
  measurementId: "G-JB72P1LSET",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
