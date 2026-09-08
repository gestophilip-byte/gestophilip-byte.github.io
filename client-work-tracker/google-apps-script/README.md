# Google Sheets cloud sync setup

The private Google Sheet is already created. This Apps Script is the bridge between the GitHub Pages tracker and that Sheet.

## One-time Google deployment

1. Open **Philip Client Work & Payment Database** in Google Sheets.
2. Choose **Extensions → Apps Script**.
3. Delete the default code in `Code.gs`.
4. Copy the contents of this repository's `Code.gs` into Apps Script and save it.
5. Choose **Deploy → New deployment**.
6. Select **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone**.
9. Click **Deploy** and approve Google's permissions.
10. Copy the Web app URL ending in `/exec`.
11. Open the tracker, go to **Data Sync**, paste the Web app URL and the API token from the private Sheet's **Settings** tab, then click **Save Connection**.
12. Click **Push to Google Sheets** once to upload the current browser's tracker records.

After that, enable **Automatic cloud sync**. Opening the tracker on another device and entering the same Web app URL + token lets that device pull the same data.

## Security

- Never put the API token in GitHub source code.
- Keep the Google Sheet private.
- The web app is reachable publicly, but every read/write request is rejected unless the private token matches.
