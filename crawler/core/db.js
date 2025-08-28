const common = rootRequire("core/common");
const config = rootRequire("config");
let db;

module.exports = {
    initialize,
    use,
    create,
    query,
};

async function initialize(dbName) {
    //For debugging only, will ignore all DB commands
    if (config.url) {
        db = {query: function() {}};
        return;
    }

    let mysql = require("mysql2/promise");
    db = await mysql.createConnection({
        host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.pass, charset : "utf8mb4"
    });

    //Config can overwrite default names
    if (config.db.name) {
        dbName = config.db.name;
    }
    await use(dbName);
}

async function use(dbName) {
    await db.query(
        "CREATE DATABASE IF NOT EXISTS " + dbName + " CHARACTER SET " + config.db.charset + " COLLATE " +
        config.db.collation
    );
    await db.query("USE " + dbName);
}

async function create(table) {
    return db.query("CREATE TABLE IF NOT EXISTS " + table + " ENGINE=" + config.db.engine);
}

async function query() {
    return db.query(...arguments);
}
