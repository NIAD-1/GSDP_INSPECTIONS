// auth.js
import { auth, provider, signInWithPopup, signOut, onAuthStateChanged } from './firebase-init.js';

export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfile = document.querySelector('.user-profile');
    const appContent = document.querySelector('.app-container');
    const loginScreen = document.getElementById('login-screen');

    // Login
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then((result) => {
                console.log("User signed in:", result.user);
            }).catch((error) => {
                console.error("Login failed:", error);
                alert("Login failed: " + error.message);
            });
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out");
        }).catch((error) => {
            console.error("Logout failed:", error);
        });
    });

    // Auth State Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            loginScreen.style.display = 'none';
            appContent.style.display = 'flex';

            // Update Sidebar Profile
            document.querySelector('.user-profile .name').textContent = user.displayName || "Inspector";
            document.querySelector('.user-profile .role').textContent = user.email;
            document.querySelector('.user-profile .avatar').textContent = (user.displayName || "U").charAt(0).toUpperCase();

            // Trigger dashboard load
            window.dispatchEvent(new Event('user-logged-in'));
        } else {
            // User is signed out
            loginScreen.style.display = 'flex';
            appContent.style.display = 'none';
        }
    });
}
