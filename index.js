"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const opn = require("open");
const destroyer = require("server-destroy");
const { google } = require("googleapis");
const e = require("express");
const { getMaxListeners } = require("process");

const { callAPI } = require("./googleApi");

const scopes = ["https://www.googleapis.com/auth/gmail.readonly"];

/**
 * To use OAuth2 authentication, we need access to a a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI.  To get these credentials for your application, visit https://console.cloud.google.com/apis/credentials.
 */
const keyPath = path.join(__dirname, "credentials.json");
let keys = { redirect_uris: [""] };
if (fs.existsSync(keyPath)) {
  keys = require(keyPath).installed;
}

/**
 * Create a new OAuth2 client with the configured keys.
 */
const oauth2Client = new google.auth.OAuth2(
  keys.client_id,
  keys.client_secret,
  keys.redirect_uris[0]
);

/**
 * This is one of the many ways you can configure googleapis to use authentication credentials.  In this method, we're setting a global reference for all APIs.  Any other API you use here, like google.drive('v3'), will now use this auth client. You can also override the auth client at the service and method call levels.
 */
google.options({ auth: oauth2Client });

/**
 * Open an http server to accept the oauth callback. In this simple example, the only request to our webserver is to /callback?code=<code>
 */
async function authenticate(scopes) {
  return new Promise((resolve, reject) => {
    // grab the url that will be used for authorization
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes.join(" "),
    });
    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url.indexOf("/oauth2callback") > -1) {
            const qs = new url.URL(req.url, "http://localhost:3000")
              .searchParams;
            res.end("Authentication successful! Please return to the console.");
            server.destroy();
            const { tokens } = await oauth2Client.getToken(qs.get("code"));
            oauth2Client.credentials = tokens; // eslint-disable-line require-atomic-updates
            resolve(oauth2Client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        // open the browser to the authorize url to start the workflow
        opn(authorizeUrl, { wait: false }).then((cp) => cp.unref());
      });
    destroyer(server);
  });
}

// export function callAPI(auth) {
//   return google.gmail({ version: "v1", auth });
// }

function checkMailFromSpotify(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  var query = "from:no-reply@spotify.com is:unread";
  gmail.users.messages.list(
    {
      userId: "me",
      q: query,
    },
    (err, res) => {
      if (!err) {
        console.log(`Data: ${res.data.messages}`);
      } else {
        console.log("something wrong: " + err);
      }
    }
  );
}

function listMessages(userId, query, callback) {
  // const gmail = callAPI(auth);
  console.log(callAPI());
  var getPageOfMessages = function (request, result) {
    request.execute(function (resp) {
      result = result.concat(resp.messages);
      var nextPageToken = resp.nextPageToken;
      if (nextPageToken) {
        request = gapi.users.messages.list({
          userId: userId,
          pageToken: nextPageToken,
          q: query,
        });
        getPageOfMessages(request, result);
      } else {
        callback(result);
      }
    });
  };
  var initialRequest = gapi.users.messages.list({
    userId: userId,
    q: query,
  });
  getPageOfMessages(initialRequest, []);
}

authenticate(scopes)
  .then((client) => listMessages(client))
  .catch(console.error);
