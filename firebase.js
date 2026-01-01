// Firebase Configuration and Initialization (Modular v9+)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyA7GbPDFEPDKqOrRa-0I0_Pk7dhfWyGkXY",
  authDomain: "batman-bf259.firebaseapp.com",
  databaseURL: "https://batman-bf259-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "batman-bf259",
  storageBucket: "batman-bf259.firebasestorage.app",
  messagingSenderId: "786158701900",
  appId: "1:786158701900:web:518e3698d655a3808c93e9",
  measurementId: "G-5E5N6G1MY3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const database = getDatabase(app);
