const cheerio = require("cheerio");
const { google } = require("googleapis");
var base64 = require("js-base64").Base64;
var open = require("open");
var Mailparser = require("mailparser").MailParser;

module.exports = class Check {
  constructor(auth) {
    this.me = "Enter your email id: ";
    this.gmail = google.gmail({ version: "v1", auth });
    this.auth = auth;
  }

  checkMailFromSpotify() {
    var query = "from:no-reply@spotify.com is:unread";
    this.gmail.users.messages.list(
      {
        userId: this.me,
        q: query,
      },
      (err, res) => {
        if (!err) {
          let mails = res.data.messages;
          this.getMail(mails[0].id);
        } else {
          console.log("something wrong: " + err);
        }
      }
    );
  }

  //getMail function retrieves the mail body and parses it for useful content.
  //In our case it will parse for all the links in the mail.
  getMail(msgId) {
    //This api call will fetch the mailbody.
    this.gmail.users.messages.get(
      {
        userId: "me",
        id: msgId,
      },
      (err, res) => {
        if (!err) {
          var body = res.data.payload.parts[0].body.data;
          var htmlBody = base64.decode(
            body.replace(/-/g, "+").replace(/_/g, "/")
          );
          var mailparser = new Mailparser();

          mailparser.on("end", (err, res) => {
            console.log(res);
          });

          mailparser.on("data", (dat) => {
            if (dat.type === "text") {
              const $ = cheerio.load(dat.textAsHtml);
              var links = [];
              var modLinks = [];
              $("a").each(function (i) {
                links[i] = $(this).attr("href");
              });

              //Regular Expression to filter out an array of urls.
              var pat = /------[0-9]-[0-9][0-9]/;

              //A new array modLinks is created which stores the urls.
              modLinks = links.filter((li) => {
                if (li.match(pat) !== null) {
                  return true;
                } else {
                  return false;
                }
              });
              console.log(modLinks);

              //This function is called to open all links in the array.
              this.openAllLinks(modLinks);
            }
          });

          mailparser.write(htmlBody);
          mailparser.end();
        }
      }
    );
  }

  openAllLinks(arr) {
    arr.forEach((e) => {
      open(e);
    });
  }
};
