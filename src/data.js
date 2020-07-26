const userId = "me";
//
//
//
// ======================================================
//              DECALRE YOUR INPUT DATA HERE
// ======================================================
// Find list of emails from Filter
const filterWith = "from:ZIM Books <norep@zim.vn> is:unread";
// How many emails you want to collect ?
const orderLimitIn = 50;
// Put the id of Spreadsheet file here, plz
const toFileWithId = "1yl1D0YsMFoDIxSPVKfZptfMXvKaLgn0pzTijLUPmyvE";
// Input range, sheets name here to pass data collected
const range = "DonDangKy!A2:U";
// Who are you?
const whoIsThere = "Huong Lan";
// ======================================================
// ------------------------------------------------------
// ======================================================
//
//
//
const sourceFrom = "";
let payDate = "";
let fillForm = "";
let transferConfirm = "";
let isDelivered = "";
let isFeedback = "";
let isWriting = "";

let hardBook = "Sách in";
let softBook = "Ebook";
let toDay = new Date();
let dd = String(toDay.getDate()).padStart(2, "0");
let mm = String(toDay.getMonth() + 1).padStart(2, "0"); //January is 0!
let yyyy = toDay.getFullYear();

toDay = mm + "/" + dd + "/" + yyyy;

module.exports = {
  filter: filterWith,
  limit: orderLimitIn,
  id: userId,
  file: toFileWithId,
  range: range,
  people: whoIsThere,
  source: sourceFrom,
  paydate: payDate,
  fillform: fillForm,
  transferconfirm: transferConfirm,
  delivered: isDelivered,
  feedback: isFeedback,
  wrote: isWriting,
  hardbook: hardBook,
  softbook: softBook,
};
