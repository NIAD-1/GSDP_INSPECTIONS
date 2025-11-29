// firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCyY3YADOOO3dNEYfELlm1E6qhz1HmXlCg",
    authDomain: "gsdp-inspections.firebaseapp.com",
    projectId: "gsdp-inspections",
    storageBucket: "gsdp-inspections.firebasestorage.app",
    messagingSenderId: "644430675438",
    appId: "1:644430675438:web:26dbd1d6dc0f2b45baa2ff",
    measurementId: "G-SV1BT6E64R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, updateDoc, doc };
