<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1uD-oa_ZY1uwR0bdsKpVjP7Hu12sho8HW

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Cloud Sync Setup (Optional)

To enable real-time sync across devices, you need to set up Firebase:

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" (or use an existing one)
3. Follow the setup wizard

### 2. Enable Firestore
1. In your Firebase project, go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for personal use) or configure security rules
4. Select a region close to you

### 3. Get Your Config
1. Go to **Project Settings** > **General**
2. Scroll down to **Your apps** and click the web icon (`</>`)
3. Register your app and copy the config values

### 4. Add Environment Variables
Create a `.env.local` file with these values:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 5. Using Cloud Sync
1. Open the app and go to **Settings**
2. Click **Enable Cloud Sync** to generate a sync code
3. On your other devices, enter the same sync code to connect
4. Your data will now sync in real-time across all connected devices!
