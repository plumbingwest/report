# Plumbing West — Report Generator

Investigation report generator. Connects to CompanyCam, lets you select photos, fills in job details, and generates a professional PDF report in Plumbing West letterhead format.

---

## Deploy to Vercel (one-time setup)

### Step 1 — Push to GitHub
1. Create a new repository on GitHub (private)
2. Upload all files in this folder to it

### Step 2 — Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New → Project**
3. Import your GitHub repository
4. Click **Deploy** (settings are already configured in `vercel.json`)

### Step 3 — Add Environment Variables
In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `COMPANYCAM_TOKEN` | Your CompanyCam access token |
| `ANTHROPIC_API_KEY` | Your Claude API key (from console.anthropic.com) |

Click **Save** and then **Redeploy**.

### Step 4 — Share the URL
Vercel gives you a permanent URL like `plumbing-west-reports.vercel.app`.
Share that URL with MacKenzie and Cindy — no login needed, just open and use.

---

## How It Works

1. Search for a CompanyCam project by address or name
2. Check the boxes on the photos you want in the report
3. Add a caption to each photo (optional but recommended)
4. Fill in the job details — plain English is fine, Claude writes the professional language
5. Click Generate — download the PDF

---

## Updating

To update the app, edit the files and push to GitHub. Vercel redeploys automatically.

---

## Files

```
plumbing-west-reports/
├── vercel.json              # Vercel routing config
├── package.json             # Dependencies
├── public/
│   └── index.html           # The app UI
└── api/
    ├── projects.js          # CompanyCam project search
    ├── photos.js            # CompanyCam photo fetch
    └── generate-report.js   # Claude + PDF generation
```
