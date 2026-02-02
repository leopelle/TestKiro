/**
 * Example usage of the auto-lock temporal feature
 * 
 * This file demonstrates how to use the auto-lock functionality
 * in the AuthenticationService.
 * 
 * Requirements: 1.5 - Auto-lock vault after 5 minutes of inactivity
 */

import { createAuthenticationService } from './authentication-service';

/**
 * Example: Basic auto-lock usage
 */
async function basicAutoLockExample() {
  const authService = createAuthenticationService();
  
  // Authenticate user
  const result = await authService.authenticate('1234');
  
  if (result.success) {
    console.log('Authenticated successfully');
    console.log('Auto-lock timer started - vault will lock after 5 minutes of inactivity');
    
    // Check remaining time until auto-lock
    const remaining = authService.getAutoLockTimeRemaining();
    console.log(`Time until auto-lock: ${Math.floor(remaining / 1000)} seconds`);
  }
}

/**
 * Example: Resetting the auto-lock timer on user activity
 */
async function resetTimerExample() {
  const authService = createAuthenticationService();
  
  // Authenticate user
  await authService.authenticate('1234');
  
  // Simulate user activity (e.g., viewing a password, editing an item)
  // This should be called whenever the user interacts with the app
  authService.resetAutoLockTimer();
  
  console.log('Auto-lock timer reset - vault will lock 5 minutes from now');
}

/**
 * Example: Handling background/foreground events
 */
async function backgroundForegroundExample() {
  const authService = createAuthenticationService();
  
  // Authenticate user
  await authService.authenticate('1234');
  
  // App goes to background (e.g., user switches to another app)
  authService.handleBackground();
  console.log('App went to background - auto-lock timer paused');
  
  // ... time passes while app is in background ...
  
  // App comes back to foreground
  authService.handleForeground();
  
  if (authService.isLocked()) {
    console.log('Vault was locked because more than 5 minutes passed in background');
  } else {
    console.log('Vault still unlocked - resuming auto-lock timer');
    const remaining = authService.getAutoLockTimeRemaining();
    console.log(`Time until auto-lock: ${Math.floor(remaining / 1000)} seconds`);
  }
}

/**
 * Example: Integration with a mobile app lifecycle
 */
class MobileAppExample {
  private authService = createAuthenticationService();
  
  async onAppStart() {
    // App starts - vault is locked
    console.log('App started - vault is locked');
  }
  
  async onUserLogin(pin: string) {
    const result = await this.authService.authenticate(pin);
    
    if (result.success) {
      console.log('Login successful - auto-lock timer started');
      return true;
    } else {
      console.log('Login failed');
      return false;
    }
  }
  
  onUserActivity() {
    // Called whenever user interacts with the app
    // (e.g., taps a button, scrolls, views a password)
    this.authService.resetAutoLockTimer();
  }
  
  onAppGoesToBackground() {
    // Called when app goes to background
    // (e.g., user presses home button, switches to another app)
    this.authService.handleBackground();
    console.log('App backgrounded - timer paused');
  }
  
  onAppComesToForeground() {
    // Called when app comes back to foreground
    this.authService.handleForeground();
    
    if (this.authService.isLocked()) {
      console.log('Vault locked - user needs to re-authenticate');
      // Show login screen
    } else {
      console.log('Vault still unlocked - resuming normal operation');
    }
  }
  
  onUserManualLock() {
    // User manually locks the vault
    this.authService.lockVault();
    console.log('Vault manually locked by user');
  }
}

/**
 * Example: Integration with a web app
 */
class WebAppExample {
  private authService = createAuthenticationService();
  
  constructor() {
    // Set up event listeners for user activity
    this.setupActivityListeners();
    
    // Set up visibility change listener for tab switching
    this.setupVisibilityListener();
  }
  
  private setupActivityListeners() {
    // Reset timer on any user interaction
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        if (!this.authService.isLocked()) {
          this.authService.resetAutoLockTimer();
        }
      });
    });
  }
  
  private setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab is hidden
        this.authService.handleBackground();
      } else {
        // Tab is visible again
        this.authService.handleForeground();
        
        if (this.authService.isLocked()) {
          // Show login modal
          this.showLoginModal();
        }
      }
    });
  }
  
  private showLoginModal() {
    console.log('Showing login modal - vault was locked');
    // Implementation would show a modal dialog for re-authentication
  }
  
  async onUserLogin(pin: string) {
    const result = await this.authService.authenticate(pin);
    
    if (result.success) {
      console.log('Login successful');
      return true;
    } else {
      console.log('Login failed');
      return false;
    }
  }
}

// Export examples for documentation
export {
  basicAutoLockExample,
  resetTimerExample,
  backgroundForegroundExample,
  MobileAppExample,
  WebAppExample,
};
