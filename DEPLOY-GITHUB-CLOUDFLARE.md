# Deploy guide – GitHub + Cloudflare Pages

## Part 1: Create the GitHub repo
1. Log in to GitHub.
2. Click **New repository**.
3. Repository name suggestion: `shelter-driver-route`.
4. Set it to **Public** if you want an open link anyone can access.
5. Click **Create repository**.

## Part 2: Upload the files to GitHub
### Easiest way in the browser
1. Open the new repo.
2. Click **Add file** → **Upload files**.
3. Drag in **all files and folders from this package**.
4. Wait for upload to finish.
5. Scroll down and click **Commit changes**.

## Part 3: Deploy on Cloudflare Pages
1. Log in to Cloudflare.
2. Go to **Workers & Pages**.
3. Click **Create application**.
4. Choose **Pages**.
5. Click **Connect to Git**.
6. Authorize GitHub if needed.
7. Pick your repository.
8. For build settings use:
   - **Framework preset:** `None`
   - **Build command:** leave empty
   - **Build output directory:** `/`
9. Click **Save and Deploy**.

## Part 4: Optional environment variable
If you later have a trusted alerts feed:
1. Open the Pages project.
2. Go to **Settings** → **Environment variables**.
3. Add:
   - Key: `ALERTS_SOURCE_URL`
   - Value: your trusted alerts endpoint
4. Save.
5. Trigger a redeploy.

## Part 5: Your public link
Cloudflare will give you a URL like:
`https://your-project-name.pages.dev`

That is the link you send to the driver.

## Part 6: Good test flow on mobile
1. Open the link on the phone.
2. Approve location access.
3. Confirm the map shows the route.
4. Tap **התראה ידנית**.
5. Confirm the chosen target updates.
6. Tap Google Maps or Waze.

## Notes
- HTTPS is required for reliable geolocation on mobile browsers.
- Cloudflare Pages gives HTTPS automatically.
- GitHub Pages is fine for a static demo, but this project is better on Cloudflare Pages because of `/api/alerts`.
