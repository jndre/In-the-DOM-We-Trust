const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const findingsRoute = require('./lib/findings');

const port_string = process.env.COOKIE_EXPORT_PORT || "3000";
const port = parseInt(port_string);

let connections = [];

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
app.set("socketio", io);

//Use BodyParser to fill req.body
app.use(bodyParser.json({
  limit: "100mb"
}));
//and to support URL-encoded bodies
app.use(bodyParser.urlencoded({
  limit: '100mb',  extended: true, parameterLimit: 50000
}));

app.use('/', findingsRoute);

const dbname = db.dbname;

db.initDb((err, db) => {
  if (err) {
    console.log(err);
  } else {
    io.on("connection", function(socket){
      console.log("a user connected");
      socket.on("disconnect", function(){
        console.log("user disconnected");
      });
    });

    http.listen(port, function () {
      console.log("---------------------------------------------------------------");
      console.log(`Export Server running at 127.0.0.1:${port} and ${dbname}!`);
      console.log("---------------------------------------------------------------");
    });

  }
});
