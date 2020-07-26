//
const authorized = require("../auth/setOAuth2");
const data = require("../data");
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
} = require("../data");
//
const getIdList = () => {
  let idList = [];
  authorized.gmails.users.messages.list(
    {
      userId: id,
      maxResults: limit,
      q: filter,
    },
    (err, res) => {
      if (!err) {
        let results = Object.values(res.data.messages);
        results.forEach((v) => {
          delete v.threadId;
          idList.push(v);
        });
        console.log(idList);
        return idList;
      } else {
        console.log(err);
      }
    }
  );
};
getIdList();
