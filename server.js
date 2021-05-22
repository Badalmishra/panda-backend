const https = require("https");
const http = require("http");
const express = require("express");
const socketIO = require("socket.io");
const config = require("./config");
const { v4 } = require("uuid");
const { default: axios } = require("axios");
const fs = require("fs");
// Global variables
let webServer;
let socketServer;
let expressApp;
let rooms = {};
const words = 
(async () => {
  try {
    await runExpressApp()
    await runWebServer();
    await runSocketServer();
  } catch (err) {
    console.error(err);
  }
})();

async function runExpressApp() {
  expressApp = express();
  expressApp.use(express.json());
  expressApp.use(express.static(__dirname + "/build"));

  expressApp.use((error, req, res, next) => {
    if (error) {
      console.warn("Express app error,", error.message);

      error.status = error.status || (error.name === "TypeError" ? 400 : 500);

      res.statusMessage = error.message;
      res.status(error.status).send(String(error));
    } else {
      next();
    }
  });
}
async function runWebServer() {
  const { sslKey, sslCrt } = config;
  if (fs.existsSync(sslKey) && !fs.existsSync(sslCrt)) {
    // process.exit(0);
    console.log('SSL files are  found. https mode is on');
    const tls = {
      cert: fs.readFileSync(sslCrt),
      key: fs.readFileSync(sslKey),
    };
    
    webServer = https.createServer(tls,expressApp);
  } else {
    console.error('SSL files are not found. check your config.js file');
    webServer = http.createServer(expressApp);
  }
  webServer.on("error", (err) => {
    console.error("starting web server failed:", err.message);
  });

  await new Promise((resolve) => {
    const { listenIp, listenPort } = config;
    webServer.listen(listenPort, listenIp, () => {
      console.log("server is running");
      console.log(`open https://${listenIp}:${listenPort} in your web browser`);
      resolve();
    });
  });
}

async function runSocketServer() {
  const getWord = async ()=>{
    try {
      
      return await axios.get('https://random-word-api.herokuapp.com//word?number=1')
    } catch (error) {
      console.log('getWord error:::::::::: ', error);
      return []
    }
  }
  socketServer = socketIO(webServer, {
    serveClient: false,
    path: "/server",
    log: false,
  });

  socketServer.on("connection", (socket) => {
    socket.join(socket.handshake.query.id);

    socket.on("disconnect", () => {
      const currentRoomId = socket.handshake.query.roomId;
      rooms[currentRoomId].userList = rooms[currentRoomId].userList.filter(
        (user) => user.id != socket.handshake.query.id
      );
      const currentTurn = rooms[currentRoomId].turn
      let newTurn = {};
      if (rooms[currentRoomId].userList.length > 0) {
        if (currentTurn) {
          const indexOCurrentTurn = rooms[currentRoomId].userList.indexOf(currentTurn);
          const newIndex = indexOCurrentTurn + 1;
          if (newIndex > rooms[currentRoomId].userList.length - 1) {
            newTurn = rooms[currentRoomId].userList[0];
          } else {
            newTurn = rooms[currentRoomId].userList[newIndex];
          }
        } else {
          newTurn =false;
        }
      } else {
        newTurn = false
      }
      rooms[currentRoomId].turn = newTurn
      socketServer.in(currentRoomId).emit("turn", newTurn);
      if (newTurn) {
        socketServer.in(newTurn.id).emit("word", rooms[currentRoomId].word);
      }
      socketServer
        .in(currentRoomId)
        .emit("peerDisconnected", { user: socket.handshake.query });
    });


    socket.on("room", (data, callback) => {
      socket.join(data.roomId);
      socketServer
        .in(socket.handshake.query.roomId)
        .emit("newPeerConnected", { user: socket.handshake.query });
      const newUser = { ...socket.handshake.query, point: 0 };
      if (rooms[data.roomId]) {
        rooms[data.roomId].userList.push(newUser);
      } else {
        rooms = {
          ...rooms,
          [data.roomId]: {
            userList: [newUser],
          },
        };
      }
      const currentTurn = rooms[data.roomId].turn;
      socketServer.in(data.roomId).emit("turn", currentTurn);
      if (currentTurn) {
        socketServer.in(currentTurn.id).emit("word",  rooms[data.roomId].word);
      }
      socketServer
        .in(socket.handshake.query.id)
        .emit("joined", { ...rooms[data.roomId] });
    });
    
    socket.on("passTurn", async (data, callback) => {
      const roomId = socket.handshake.query.roomId;
      const currentTurn = rooms[roomId].turn;
      console.log("currentTurn: ", currentTurn);
      let newTurn = {};
      if (currentTurn) {
        const indexOCurrentTurn = rooms[roomId].userList.indexOf(currentTurn);
        const newIndex = indexOCurrentTurn + 1;
        if (newIndex > rooms[roomId].userList.length - 1) {
          newTurn = rooms[roomId].userList[0];
        } else {
          newTurn = rooms[roomId].userList[newIndex];
        }
      } else {
        newTurn = rooms[roomId].userList[0];
      }
      const word = await getWord()
      console.log('word: ', word.data);
      rooms[roomId].word = word.data[0]
      rooms[roomId].turn = newTurn;
      console.log("newTurn: ", newTurn);
      socketServer.in(socket.handshake.query.roomId).emit("turn", newTurn);
      socketServer.in(newTurn.id).emit("word", word.data[0]);
    });

    socket.on("message", (data, callback) => {
      try {
        const { message } = data;
        const roomId = socket.handshake.query.roomId;
        const currentUser = rooms[roomId].userList.find(e=>e.id===socket.handshake.query.id)
        const time = new Date().getTime();
        const payload = {
          ...socket.handshake.query,
          sender: socket.handshake.query.id,
          id: v4(),
          time: time,
          message,
        };
        if (message === rooms[roomId].word ) {
          payload.isAnswer = true
          payload.message = 'Got it!👍'
          if (currentUser.lastGuess !== message) {
            currentUser.point = currentUser.point+1
          }
          currentUser.lastGuess = message
          console.log('rooms[roomId: ', rooms[roomId]);
          socketServer.in(roomId).emit("joined", rooms[roomId]);
        }
        socketServer.in(roomId).emit("message", payload);
      } catch (error) {
        console.log("error in toroom", error);
      }
    });
    socket.on("canvas", (data, callback) => {
      try {
        const roomId = socket.handshake.query.roomId;
        socketServer.in(roomId).emit("canvas", data);
      } catch (error) {
        console.log("error in toroom", error);
      }
    });
  });
}
