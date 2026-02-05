// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCRV9Vh0QSA0RQ50r8SZwt72PIwjhPoL5o",
  authDomain: "owl-manage.firebaseapp.com",
  projectId: "owl-manage",
  storageBucket: "owl-manage.firebasestorage.app",
  messagingSenderId: "971812158",
  appId: "1:971812158:web:42a468ad62bd204365106f",
  measurementId: "G-N3SCJV1H6Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);