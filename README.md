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

## Cloud Sync

This app supports real-time sync across devices using Firebase Firestore.

### Using Cloud Sync
1. Open the app and go to **Settings**
2. Click **Enable Cloud Sync** to generate a sync code (e.g., `STAR-7X9K`)
3. On your other devices, enter the same sync code to connect
4. Your data will now sync in real-time across all connected devices!

Your local data is preserved even when offline — it syncs automatically when you reconnect.
