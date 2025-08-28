const host = process.env.MONGO_HOST || "localhost";
const port = process.env.MONGO_PORT || "27017";
const db_name = process.env.MONGO_DATABASE || "markup-inj-database";
const collection = process.env.MONGO_COL || "findings";
const collection_exploits = process.env.MONGO_COL_EXPLOITS || "findings-exploits";
const argv = require("minimist")(process.argv.slice(2));
const verbose = argv["verbose"] === undefined ? false : true;
const sqlName = argv["dbName"] === undefined ? "_snapshoter" : argv["dbName"];
const sqlHost = argv["dbHost"] === undefined ? "127.0.0.1" : argv["dbHost"];
const sqlPort = argv["dbPort"] === undefined ? "3306" : argv["dbPort"];
const sqlUser = argv["dbUser"] === undefined ? "crawler" : argv["dbUser"];
const sqlPass = argv["dbPass"] === undefined ? "CrawlTheNight" : argv["dbPass"];

module.exports = {
  argv,
  host,
  port,
  db_name,
  collection,
  collection_exploits,
  verbose,
  sqlName,
  sqlHost,
  sqlPort,
  sqlUser,
  sqlPass,
};