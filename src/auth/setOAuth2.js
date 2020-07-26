const { google } = require("googleapis");
const credentials = require("./zim.json").installed;
const fs = require("fs");
const path = require("path");

// scopes
const SCOPES = require("./scopes").scopes;

// set authorize
const setAuth = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

// set Token if exist
const tokenPath = path.join("./token.json");
if (fs.existsSync(tokenPath)) {
  console.log("Found the token file!");
  setAuth.setCredentials(JSON.parse(tokenPath));
}

// gmail api services
const gmails = google.gmail({
  version: "v1",
  auth: setAuth,
});

// spreadsheets api services
const sheets = google.sheets({
  version: "v4",
  auth: setAuth,
});

module.exports = {
  setAuth,
  SCOPES,
  gmails,
  sheets,
};
