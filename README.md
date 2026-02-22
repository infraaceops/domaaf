# 🚀 DOMAAF App - Serious Setup

Welcome to your new robust application architecture! This project is now **decoupled**, meaning the different parts (Database, Logic, and Display) are separated. This makes it faster, safer, and easier to grow.

---

## 🧐 Layman's Terms: What are these?

If you aren't a coder, here is what we just built for you:

1.  **Docker (The Container)**: Imagine a lunchbox that contains everything a specific part of your app needs to run. No matter whose computer it's on, it works the same way because it's in its "container."
2.  **Postgres (The Database)**: This is your digital filing cabinet. Instead of a messy spreadsheet, this is a professional system meant to hold millions of records safely.
3.  **Worker / API (The Brain)**: This is the "manager." When a user clicks a button on your app, the Brain (API) decides what to do, talks to the Database, and sends back the result.
4.  **Frontend / PWA (The Face)**: This is what you see on your phone or computer. A **PWA** (Progressive Web App) means it can be "Installed" on your Android home screen just like a regular app, but it's built with web technology.
5.  **Google Drive (The Warehouse)**: Since images and videos are "heavy," we keep them in Google Drive. Our "Brain" (API) handles the heavy lifting of moving files there.
6.  **Decoupling**: This is like having a car where you can swap the engine without changing the seats. If you want to change your database later, you can do it without rebuilding the whole app.

---

## 🛠️ How to Start (The "Magic" Command)

You only need **Docker Desktop** installed.

1.  Open your terminal (PowerShell or Command Prompt).
2.  Navigate to this folder.
3.  Run this command:
    ```bash
    docker-compose up --build -d
    ```
4.  **Your app is now live!**
    -   **Website**: [http://localhost](http://localhost)
    -   **Brain (API)**: [http://localhost:5000](http://localhost:5000)
    -   **Database**: Port 5432

---

## 📂 Project Structure

-   `/backend`: The "Brain" (Node.js API).
-   `/frontend`: The "Face" (HTML/CSS/JS/PWA).
-   `/docker-compose.yml`: The "Conductor" that starts everything.

---

## ☁️ Integrating Google Drive & Login

To make Google Drive and Google Login work, follow these steps:

### 1. Google Drive (Storage)
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a Project and enable **Google Drive API**.
3.  Create a **Service Account** and download the `JSON` key.
4.  Rename it to `google-credentials.json` and put it inside the `/backend` folder.
5.  Share your Google Drive Folder with the email address of that Service Account.

### 2. Google Login (Authentication)
1.  In Cloud Console, go to **APIs & Services > Credentials**.
2.  Create an **OAuth 2.0 Client ID**.
3.  Set the **Authorized Redirect URIs** to `http://localhost:5000/auth/google/callback`.
4.  Add the Client ID to your `.env` file (see below).

---

## 🔑 Environment Variables
Create a file named `.env` in the root folder to customize your passwords:
```env
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=domaaf
```

---

## 📱 Mobile Installation (Android)
1.  Open Chrome on your Android phone.
2.  Type in your computer's IP address (e.g., `http://192.168.1.10`).
3.  Tap the **Three Dots (Menu)** and select **"Install App"** or **"Add to Home Screen"**.
4.  Boom! You have a native-feeling app on your phone.
