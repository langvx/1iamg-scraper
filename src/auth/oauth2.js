// Copyright 2012 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const url = require("url");
const opn = require("open");
const destroyer = require("server-destroy");

const { google } = require("googleapis");

const scopes = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  // "https://www.googleapis.com/auth/gmail.metadata",
];

let FILTER = "from:books@zim.vn";

/**
 * To use OAuth2 authentication, we need access to a a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI.  To get these credentials for your application, visit https://console.cloud.google.com/apis/credentials.
 */
const keyPath = path.join(__dirname, "credentials.json");
let keys = { redirect_uris: [""] };
if (fs.existsSync(keyPath)) {
  keys = require(keyPath).web;
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

async function getMailByFilter(auth, filter, token = "", result = []) {
  const gmail = google.gmail({ version: "v1", auth });
  let res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 300,
    options: {},
    pageToken: token,
    q: filter,
  });

  if (res && res.data) {
    let msg = res.data.messages;
    if (msg && msg.length) {
      msg.forEach((message) => {
        result.push(message.id);
      });
      if (res.data.nextPageToken) {
        result = await getMailByFilter(
          auth,
          filter,
          res.data.nextPageToken,
          result
        );
      }
    }
  }
  return result;
}

function filteredMails(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  gmail.users.messages.list(
    {
      userId: "me",
      q: FILTER,
    },
    async (err, res) => {
      if (!err) {
        // console.log(res.data.messages[0].id);
        const x = await Promise.all(
          res.data.messages.map((m) => {
            console.log(res.data.messages?.id);
          })
        );
      } else {
        console.log("Wrong! " + err);
      }
    }
  );
}

function getFirstMail(auth) {
  const gmail = google.gmail({ version: "v1", auth });

  gmail.users.messages.get(
    {
      userId: "me",
      q: FILTER, // filter xong khong co ket qua naso
    },
    async (err, res) => {
      if (!err) {
        // const x = await Promise.all(
        //   res.data.messages.map((m) => {
        //     console.log(m.id);
        //     return gmail.users.messages[m.id].get({ userId: "me" });
        //   })
        // );
        // console.log(x);
        // return x;
      } else {
        console.log(err);
      }
    }
  );
}

// ham nay la example chuan cua Google, chua biet sao de chay duoc
function listMessages(userId, query, callback) {
  // const gmail = google.gmail({ version: "v1", auth });
  var getPageOfMessages = function (req, result) {
    req.execute(function (response) {
      result = result.concat(response.messages);
      var nextPageToken = response.nextPageToken;
      if (nextPageToken) {
        req = gmail.users.messages.list({
          userId: userId,
          pageToken: nextPageToken,
          q: query,
        });
        getPageOfMessages(req, result);
      } else {
        callback(result);
      }
    });
  };
  var initialRequest = gmail.users.messages.list({
    userId: userId,
    q: query,
  });
  getPageOfMessages(initialRequest, []);
}

function listLabels(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  gmail.users.labels.list(
    {
      userId: "me",
    },
    (err, res) => {
      if (err) return console.log("The API returned an error: " + err);
      const labels = res.data.labels;
      if (labels.length) {
        console.log("Labels:");
        labels.forEach((label) => {
          console.log(`- ${label.name}`);
        });
      } else {
        console.log("No labels found.");
      }
    }
  );
}

authenticate(scopes)
  .then((client) => filteredMails(client))
  .catch(console.error);
