const Router = require("express").Router;
const { v4: uuidv4 } = require("uuid");

const db = require("../db");

const router = Router();


router.get('/test', (req, res, next) => {
  return res.status(200).json({message:"export service running" });
});

router.post("/finding", (req, res, next) => {
  // let io = req.app.get("socketio");
  let finding = req.body.finding;
  finding.uuid = uuidv4();
  //console.log(finding);
  console.log("Exporting result id: ", finding.uuid, "from", finding.loc);
  if (finding.loc === undefined) {
    console.log("Undefined finding location! Finding is: ", finding);
  }
  db.getDb()
    .db()
    .collection(db.col)
    .insertOne(finding)
    .then(result => {
      res.status(201).json({ message: "Inserted finding into the findings collection.", findingId: result._id});
      // io.emit("updated", "new finding added");
    })
    .catch(err => {
      console.log("Error occuring while exporting result!");
      console.log(err);
      res.status(500).json({ message: "An error occured." });
    });
});

module.exports = router;
