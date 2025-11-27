// auth.js
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase-init.js';

export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfile = document.querySelector('.user-profile');
    const appContent = document.querySelector('.app-container');
    const loginScreen = document.getElementById('login-screen');
    const guestBtn = document.getElementById('guest-btn');

    // Guest Login
    guestBtn.addEventListener('click', () => {
        console.log("Guest login");
        handleLogin({
            displayName: "Guest Inspector",
            email: "guest@nafdac.gov.ng",
            isAnonymous: true
        });
    });

    // Login
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then((result) => {
                console.log("User signed in:", result.user);
                // Auth state listener will handle the rest
            }).catch((error) => {
                console.error("Login failed:", error);
                alert("Login failed: " + error.message + "\n\nTip: Try 'Continue as Guest' if Firebase is not configured.");
            });
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out");
            window.location.reload();
        }).catch((error) => {
            console.error("Logout failed:", error);
            window.location.reload();
        });
    });

    // Auth State Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            handleLogin(user);
        } else {
            // User is signed out
            loginScreen.style.display = 'flex';
            appContent.style.display = 'none';
        }
    });

    function handleLogin(user) {
        // User is signed in
        loginScreen.style.display = 'none';
        appContent.style.display = 'flex';

        // Update Sidebar Profile
        document.querySelector('.user-profile .name').textContent = user.displayName || "Inspector";
        document.querySelector('.user-profile .role').textContent = user.email;
        document.querySelector('.user-profile .avatar').textContent = (user.displayName || "U").charAt(0).toUpperCase();

        // Trigger dashboard load
        window.dispatchEvent(new CustomEvent('user-logged-in', { detail: user }));
    }
}
