const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
// var createTextVersion = require("textversionjs");
var cheerio = require("cheerio");
var base64 = require("js-base64").Base64;

const {
  filter,
  limit,
  id,
  range,
  file,
  people,
  source,
  delivered,
  feedback,
  fillform,
  paydate,
  transferconfirm,
  wrote,
  hardbook,
  softbook,
} = require("./data");

// const filterWith = "from:ZIM Books <norep@zim.vn> is:unread";
// const orderLimitIn = 200;
// const userId = "me";

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
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
  const gmail = google.gmail({ version: "v1", auth }); // Declare Gmail api
  const sheet = google.sheets({ version: "v4", auth }); // Declare Sheets api

  // Query to get list of mail filter with filter variable
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

        // Mail Id gathered
        let scrapeID = msgArray.map((m) => m.id);
        scrapeID.forEach((m) => {
          // console.log(`ID returned: ${m}`);

          // Starting get mails list with Id
          gmail.users.messages.get(
            {
              userId: id,
              id: m,
              format: "full",
            },
            (err, res) => {
              if (!err) {
                // Get data from Gmail body
                const rawData = res.data.payload.body.data;

                // Decode raw data
                let dataEncoded = base64.decode(
                  rawData
                    .replace(/-/g, "+")
                    .replace(/_/g, "/")
                    .replace(/\s/g, "")
                );
                // const textVersion = createTextVersion(dataEncoded);

                // Apply Cheerio to DOM Object
                var $ = cheerio.load(dataEncoded, { decodeEntities: false });

                // get orderId to strip date ordered
                let orderId = $("td#header_wrapper")
                  .find("> h1")
                  .text()
                  .replace("New Order: ", "")
                  .replace("Order Failed: ", "")
                  .replace("Order Cancelled: ", "");
                let orderDate = orderId.split("/");
                let cloneDate = orderDate.slice();
                let getOrderDate = cloneDate[2].split("-");
                let dd = getOrderDate[2];
                let mm = getOrderDate[1];
                let yy = getOrderDate[0];
                let dateFormated = dd + "/" + mm + "/" + yy;
                // console.log(getOrderDate);
                // Collect address data
                let addressNodes = $("address.address").html().split("<br>");
                let addressArr = [];
                addressNodes.forEach((o) => {
                  addressArr.push(o.trim());
                });

                // Check address outside of Vietnam
                if (addressArr.length > 5) {
                  addressArr[1] = addressArr[1] + " | " + addressArr[2];
                  addressArr.splice(2, 1);
                }

                // Split phone number from a tag
                for (let i = 0; i < addressArr.length; i++) {
                  if (addressArr[i].includes("</a>")) {
                    addressArr[i] = addressArr[i]
                      .split("tel:")[1]
                      .split('"')[0];
                    // console.log("true, it's: " + addressArr[i]);
                  }
                  // console.log("address Data: " + addressArr[i]);
                }

                // Collect product, product quantity and cost
                let productList = [];
                let quantityList = [];
                let costList = [];

                // Product
                let getProduct = $("div#body_content_inner")
                  .find(
                    "> div > table > tbody > tr.order_item > td:nth-child(1)"
                  )
                  .each((index, e) => {
                    productList.push($(e).text().trim());
                  });
                // Strip material from product
                let material = [];
                for (let i = 0; i < productList.length; i++) {
                  if (productList[i].includes(hardbook)) {
                    material.push(hardbook);
                  }
                  if (productList[i].includes(softbook)) {
                    material.push(softbook);
                  }
                }
                // const cloneProduct = productList.slice();
                // console.log(cloneProduct);
                // Quantity
                let productQuantity = $("div#body_content_inner")
                  .find(
                    "> div > table > tbody > tr.order_item > td:nth-child(2)"
                  )
                  .each((index, e) => {
                    quantityList.push($(e).text().trim());
                  });
                let totalQuantity = quantityList.reduce(
                  (a, b) => parseInt(a) + parseInt(b),
                  0
                );
                // Cost
                let productCost = $("div#body_content_inner").find(
                  "> div > table > tbody > tr.order_item > td:nth-child(3) > span.amount"
                );
                productCost.each((index, e) => {
                  costList.push($(e).text().trim());
                });

                // Append all about product data
                let temporaryArray = [];
                for (var i in productList) {
                  let pistol =
                    productList[i] +
                    " | " +
                    "[quantity: " +
                    quantityList[i] +
                    " ]" +
                    " | " +
                    "[cost: " +
                    costList[i].replace("₫", "") +
                    "]";
                  temporaryArray.push(pistol);
                }
                //
                // Payment information
                //
                // keys
                let paymentKeys = $("div#body_content_inner")
                  .find("> div > table > tfoot > tr > th.td")
                  .text()
                  .replace(/\s/g, "")
                  .split(":");
                paymentKeys.pop();

                // values
                let valsList = [];
                let paymentVals = $("div#body_content_inner").find(
                  "> div > table > tfoot > tr > td:nth-child(2)"
                );
                paymentVals.each((i, e) => {
                  valsList.push($(e).text().trim());
                });

                // Push payment info to Object
                let paymentInfo = [];
                if (paymentKeys.length === valsList.length) {
                  for (let i = 0; i < paymentKeys.length; i++) {
                    let key = paymentKeys[i];
                    let value = valsList[i];
                    paymentInfo.push({ key, value });
                  }
                }

                let Subtotal = "";
                let totalCost = "";
                let Paymentmethod = "";
                let disCount = "";
                let shipPing = "";
                let note = "";

                // Strip data from payment Object info
                let paymentClone = Object.values(paymentInfo);
                paymentClone.forEach((m) => {
                  if (m.key === "Subtotal") Subtotal = m.value;
                  if (m.key === "Discount") disCount = m.value;
                  if (m.key === "Shipping") shipPing = m.value;
                  if (m.key === "Paymentmethod") Paymentmethod = m.value;
                  if (m.key === "Total") totalCost = m.value;
                  if (m.key === "Note") note = m.value;
                });

                //
                count++;
                console.log(
                  "=========================INDEX: " +
                    count +
                    "======================="
                );
                console.log("date order: " + dateFormated);
                console.log("order Id: " + orderId);
                console.log("name: " + addressArr[0]);
                console.log("address: " + addressArr[1]);
                console.log("country: " + addressArr[2]);
                console.log("phone: " + addressArr[3]);
                console.log("email: " + addressArr[4]);
                // console.log("product: " + temporaryArray);
                console.log("product: " + productList);
                console.log("material: " + material);
                console.log("total quantity: " + totalQuantity);
                console.log(`Subtotal: ${Subtotal}`);
                console.log(`Discount: ${disCount}`);
                console.log(`Shipping: ${shipPing}`);
                console.log(`Payment method: ${Paymentmethod}`);
                console.log(`Total: ${totalCost}`);
                console.log(`Note: ${note}`);
                // console.log(paymentClone);
                console.log(
                  "========================================================="
                );
                console.log(
                  "-                                                       -"
                );
                //Save DATA to Google Spreadsheets
                sheet.spreadsheets.values.append(
                  {
                    spreadsheetId: file,
                    range: range,
                    valueInputOption: "USER_ENTERED",
                    resource: {
                      values: [
                        [
                          dateFormated,
                          orderId,
                          addressArr[0],
                          addressArr[3],
                          addressArr[4],
                          material.toString(),
                          Paymentmethod,
                          people,
                          productList.toString(),
                          source,
                          totalCost,
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                          "",
                          addressArr[1] + " | " + addressArr[2] + "|" + note,
                        ],
                      ],
                    },
                  },
                  (err, res) => {
                    if (!err) {
                      // function
                      console.log(
                        "Data has been pushed to your Spreadsheets! "
                      );
                      // remove Unread Tag
                      gmail.users.threads.modify(
                        {
                          userId: id,
                          id: m,
                          removeLabelIds: ["UNREAD"],
                        },
                        (err, res) => {
                          if (!err) {
                            console.log("Mark as Read email: SUCESS");
                          } else {
                            console.log("An error caused! " + err);
                          }
                        }
                      );
                    } else {
                      console.log("An error caused! " + err);
                    }
                  }
                );
              } else {
                console.log(
                  "Something wrong with application, contact to Developer for information: " +
                    err
                );
              }
            }
          );
        });
      } else {
        console.log(
          "Something wrong with application, contact to Developer for information: " +
            err
        );
      }
    }
  );
}

function listMajors(auth) {
  const sheets = google.sheets({ version: "v4", auth });
  sheets.spreadsheets.values.get(
    {
      // spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      spreadsheetId: "1yl1D0YsMFoDIxSPVKfZptfMXvKaLgn0pzTijLUPmyvE",
      range: "DonDangKy!B2:C89",
    },
    (err, res) => {
      if (err) return console.log("The API returned an error: " + err);
      const rows = res.data.values;
      if (rows.length) {
        console.log("CustomerId, Customer name:");
        // Print columns A and E, which correspond to indices 0 and 4.
        rows.map((row) => {
          if (rows[0] === "\n") {
            console.log(`CustomerId: Unknown || Customer name: ${row[1]}`);
          }
          console.log(
            `CustomerId: ${JSON.stringify(row[0])} || Customer name: ${row[1]}`
          );
        });
      } else {
        console.log("No data found.");
      }
    }
  );
}
