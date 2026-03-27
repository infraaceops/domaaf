<script type="module">
  // Import the functions you need from the SDKs you need
  import {initializeApp} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
  import {getAnalytics} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyA-MsYW0C83qJMnq-CAw7SiQFEXUeZMN-E",
  authDomain: "domaaf-74bfb.firebaseapp.com",
  projectId: "domaaf-74bfb",
  storageBucket: "domaaf-74bfb.firebasestorage.app",
  messagingSenderId: "1015839227545",
  appId: "1:1015839227545:web:d40f6b59e2340b6d968208",
  measurementId: "G-B5LQ5ZY3R9"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>