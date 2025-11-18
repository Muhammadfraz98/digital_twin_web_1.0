// -------------------------
//  FIREBASE INITIALIZATION
// -------------------------

// Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCOKVT1YtQtOIAJYQByqZuCmtrxilLZuFs",
    authDomain: "oldbambergwebar.firebaseapp.com",
    projectId: "oldbambergwebar",
    storageBucket: "oldbambergwebar.firebasestorage.app",
    messagingSenderId: "595923010789",
    appId: "1:595923010789:web:9dcd1e205e4432592bc00c",
    measurementId: "G-RRJSSS9LG9"
};

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);

// Export Firestore DB reference globally
window.db = firebase.firestore();


// -------------------------
// Function to fetch buildings
// -------------------------
window.fetchBuildingsFromFirebase = async function () {
  try {
    const snapshot = await window.db.collection("buildings").get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

  } catch (err) {
    console.error("Error fetching buildings:", err);
    return [];
  }
};
