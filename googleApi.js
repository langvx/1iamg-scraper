const { google } = require("googleapis");

let auth = {};

function setAuth(iAuth) {
  auth = iAuth;
}

function callAPI() {
  return google.gmail({ version: "v1", auth });
}

module.exports = {
  setAuth,
  callAPI,
};
