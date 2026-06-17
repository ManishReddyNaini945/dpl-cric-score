# Firebase Setup (5 minutes, 100% Free)

Firebase Spark plan is completely free — no credit card needed for this scale.

---

## Step 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Name it `crickbuxx-score` (or anything you like)
4. Disable Google Analytics (not needed) → **Create project**

---

## Step 2 — Enable Firestore Database

1. In the left sidebar → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** → Next
4. Pick any location near you (e.g., `asia-south1` for India) → **Enable**

---

## Step 3 — Get Your Config

1. In the left sidebar → click the ⚙️ gear icon → **Project settings**
2. Scroll down to **Your apps** → click the `</>` web icon
3. Register the app (name it anything) — **no** Firebase Hosting needed
4. Copy the `firebaseConfig` object shown

---

## Step 4 — Paste Config Into the App

Open `src/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",           // ← paste your values here
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234...",
};
```

---

## Step 5 — Set Firestore Security Rules (important!)

In Firebase Console → Firestore → **Rules** tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /matches/{matchId} {
      allow read, write: if true;
    }
  }
}
```

Click **Publish**. This lets everyone with the link read/write scores.
For production, add authentication later — for a private team this is fine.

---

## Step 6 — Run the App

```bash
cd "dpl cric score"
npm install
npm run dev
```

Open http://localhost:3000 on your phone (connect to same WiFi) or deploy free to Vercel.

---

## Deploy Free on Vercel (optional, so anyone can access via internet)

1. Push this folder to GitHub
2. Go to https://vercel.com → Import project from GitHub
3. Click Deploy — done! You get a free `*.vercel.app` URL

---

## Free Tier Limits (Spark Plan)

| Resource      | Free Limit      | Your usage (est.) |
|---------------|-----------------|-------------------|
| Reads/day     | 50,000          | ~500/match        |
| Writes/day    | 20,000          | ~200/match        |
| Storage       | 1 GB            | < 1 MB/year       |

You're safe for weekly matches forever.
