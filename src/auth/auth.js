const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
// var createTextVersion = require("textversionjs");
var cheerio = require("cheerio");
var base64 = require("js-base64").Base64;

const { filter, limit, id } = require("./data");

// const filterWith = "from:ZIM Books <norep@zim.vn> is:unread";
// const orderLimitIn = 200;
// const userId = "me";

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

// Load client secrets from a local file.
fs.readFile("zim2.json", (err, content) => {
  if (err) return console.log("Error loading client secret file:", err);
  // Authorize a client with credentials, then call the Gmail API.
  authorize(JSON.parse(content), scrapingMails);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log("Token stored to", TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

var count = 0;

function scrapingMails(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  gmail.users.messages.list(
    {
      userId: id,
      q: filter,
      maxResults: limit,
    },
    (err, res) => {
      if (!err) {
        let msgArray = Object.values(res.data.messages);
        msgArray.forEach((m) => {
          delete m.threadId;
        });
        let scrapeID = msgArray.map((m) => m.id);
        scrapeID.forEach((m) => {
          // console.log(`ID returned: ${m}`);
          gmail.users.messages.get(
            {
              userId: id,
              id: m,
              format: "full",
            },
            (err, res) => {
              if (!err) {
                const rawData = res.data.payload.body.data;
                let dataEncoded = base64.decode(
                  rawData
                    .replace(/-/g, "+")
                    .replace(/_/g, "/")
                    .replace(/\s/g, "")
                );
                // const textVersion = createTextVersion(dataEncoded);
                var $ = cheerio.load(dataEncoded, { decodeEntities: false });
                let orderId = $("td#header_wrapper")
                  .find("> h1")
                  .text()
                  .replace("New Order: ", "")
                  .replace("Order Failed: ", "")
                  .replace("Order Cancelled: ", "");
                let addressNodes = $("address.address").html().split("<br>");
                let addressArr = [];
                addressNodes.forEach((o) => {
                  addressArr.push(o.trim());
                });
                // change_alias(addressArr[0]);
                // console.log(textVersion);
                // console.log(addressArr);
                if (addressArr.length > 5) {
                  addressArr[1] = addressArr[1] + " | " + addressArr[2];
                  // console.log("duplicated here: " + addressArr[2]);
                  addressArr.splice(2, 1);
                }
                for (let i = 0; i < addressArr.length; i++) {
                  if (addressArr[i].includes("</a>")) {
                    addressArr[i] = addressArr[i]
                      .split("tel:")[1]
                      .split('"')[0];
                    // console.log("true, it's: " + addressArr[i]);
                  }
                  // console.log("address Data: " + addressArr[i]);
                }
                count++;
                console.log(
                  "=========================INDEX: " +
                    count +
                    "======================="
                );
                console.log("Order ID: " + orderId);
                console.log("name: " + addressArr[0]);
                console.log("address: " + addressArr[1]);
                console.log("country: " + addressArr[2]);
                console.log("phone: " + addressArr[3]);
                console.log("email: " + addressArr[4]);
                console.log(
                  "========================================================="
                );
                console.log(
                  "-                                                       -"
                );
              } else {
                console.log("Wrong! " + err);
              }
            }
          );
        });
      } else {
        console.log("Wrong! " + err);
      }
    }
  );
}
