const mongodb = require("mongodb");

const MongoClient = mongodb.MongoClient;

const host = process.env.COOKIE_EXPORT_MONGO_HOST || "mongo";
const port = process.env.COOKIE_EXPORT_MONGO_PORT || "27017";
const dbname = process.env.COOKIE_EXPORT_MONGO_DBNAME || "markup-inj-database";
const col = process.env.COOKIE_EXPORT_MONGO_COL || "findings";
var mongoDbUrl = "mongodb://" + host + ":" + port + "/" + dbname;

const poolSize = process.env.COOKIE_EXPORT_MONGO_POOLSIZE || 10;

let _db;

const initDb = (callback) => {
    if (_db) {
        console.log("Database is already initialized!");
        return callback(null, _db);
    }
    MongoClient.connect(mongoDbUrl, {
        poolSize: poolSize,
    })
        .then((client) => {
            _db = client;
            _db.db().collection(col).createIndex({ ts: 1, id: 1 });
            callback(null, _db);
        })
        .catch((err) => {
            callback(err);
        });
};

const getDb = () => {
    if (!_db) {
        throw Error("Database not initialized");
    }
    return _db;
};

module.exports = {
    initDb,
    getDb,
    col,
    dbname,
};
