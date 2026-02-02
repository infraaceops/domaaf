# 🏠 Domaaf - Premium Cameroon Rentals

Domaaf is a high-performance, $0-cost property rental platform. It uses a serverless architecture with Google Sheets as the database and Google Drive as media storage.

## 🚀 Key Features
- **Modern Premium Design:** Built with Outfit font, glassmorphism, and smooth animations.
- **Smart Compression:**
  - Pictures are auto-shrunk to **~10-15 KB** using HTML5 Canvas.
  - Videos are limited to **5 seconds** and **5 MB**.
- **Serverless Backend:** No hosting costs (GitHub Pages + Google Apps Script).
- **Android Ready:** Valid PWA (Progressive Web App) that can be installed on Android.
- **Monetization Support:** Built-in business tiers (Gold, Silver, Platinum, Diamond) that prioritize listings.

---

## 🛠️ Setup Instructions (Crucial)

To make the "Post Property" feature work, follow these steps:

### 1. Google Drive & Sheet Setup
1. Create a new **Google Sheet**. 
2. Add these headers to the first row of a tab named `Properties`:
   `Timestamp | ID | Title | Description | Price | Type | Plan | ImageURL | VideoURL | Email | Status`
3. Create a folder in your **Google Drive** named `Domaaf_Media`.
4. Copy the **Folder ID** (the long string in the URL when you are inside the folder).

### 2. Apps Script Deployment
1. In your Google Sheet, go to **Extensions > Apps Script**.
2. Delete any code there and paste the contents of `backend.gs` (provided in this repo).
3. Replace `YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE` with the Folder ID from step 1.4.
4. Click **Deploy > New Deployment**.
5. Select type: **Web App**.
6. Set "Execute as": **Me**.
7. Set "Who has access": **Anyone**.
8. Click **Deploy**, authorize permissions, and **COPY the Web App URL**.

### 3. Connect Frontend
1. Open `script.js`.
2. Replace `YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE` (line 2) with the URL you copied in the previous step.

---

## 📦 Deployment to GitHub Pages
1. Push this code to a GitHub repository.
2. Go to **Settings > Pages**.
3. Select the `main` branch and `/root` folder.
4. Your site will be live at `https://your-username.github.io/domaaf/`.

## 📱 How to Install on Android
1. Open the URL on Chrome (Android).
2. Tap the three dots (menu).
3. Tap **"Install App"** or **"Add to Home Screen"**.
4. Domaaf will now look and behave like a native Android app!
