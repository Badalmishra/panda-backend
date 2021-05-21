const http = require("http");
const express = require("express");
const socketIO = require("socket.io");
const config = require("./config");
const { v4 } = require("uuid");

// Global variables
let webServer;
let socketServer;
let expressApp;
let rooms ={};
(async () => {
  try {
    await runWebServer();
    await runSocketServer();
  } catch (err) {
    console.error(err);
  }
})();

async function runWebServer() {
  webServer = http.createServer( expressApp);
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
  socketServer = socketIO(webServer, {
    serveClient: false,
    path: "/server",
    log: false,
  });

  socketServer.on("connection", (socket) => {
    console.log(' socket.handshake.query: ',  socket.handshake.query.id);
    socket.on("disconnect", () => {
        rooms[socket.handshake.query.roomId].userList =
        rooms[socket.handshake.query.roomId].userList.filter(user=>user.id !=socket.handshake.query.id)
        socketServer
          .in(socket.handshake.query.roomId)
          .emit("peerDisconnected", { user:socket.handshake.query });
      })
  

    socket.on("connect_error", (err) => {
      console.error("client connection error", err);
    });

    socket.on("room", (data, callback) => {
      socket.join(data.roomId);
      socketServer
          .in(socket.handshake.query.roomId)
          .emit("newPeerConnected", { user:socket.handshake.query });
      if (rooms[data.roomId]) {
        rooms[data.roomId].userList.push(socket.handshake.query)
      } else {
        rooms = {...rooms,
            [data.roomId]:{
            userList:[socket.handshake.query]
          }
      }
    }
    const currentTurn = rooms[data.roomId].turn
    socketServer
        .in(data.roomId)
        .emit("turn", currentTurn);
      callback("joined",{...rooms[data.roomId] });
    });
    socket.on("passTurn", (data, callback) => {
      const roomId = socket.handshake.query.roomId
      const currentTurn = rooms[roomId].turn
      console.log('currentTurn: ', currentTurn);
      let newTurn = {}
      if (currentTurn) {
        const indexOCurrentTurn = rooms[roomId].userList.indexOf(currentTurn)
        const newIndex = indexOCurrentTurn+1
        if (newIndex>  (rooms[roomId].userList.length-1)) {
          newTurn =  rooms[roomId].userList[0]
        } else {
          newTurn =   rooms[roomId].userList[newIndex]
        }
      } else {
        newTurn =  rooms[roomId].userList[0]
      }
      rooms[roomId].turn = newTurn
      console.log('newTurn: ', newTurn);
      socketServer
          .in(socket.handshake.query.roomId)
          .emit("turn", newTurn);
    
    });

    socket.on("message", (data, callback) => {
      try {
        const {message} = data
        const roomId = socket.handshake.query.roomId
        const time= new Date().getTime()
        const payload = {
          ...socket.handshake.query,
          sender:socket.handshake.query.id,
          id:v4(),
          time:time,
          message,
        }
        socketServer.in(roomId).emit("message",payload);
      } catch (error) {
        console.log('error in toroom',error)
      }
    });
    socket.on("canvas", (data, callback) => {
      try {
        const roomId = socket.handshake.query.roomId
        socketServer.in(roomId).emit("canvas",data);
      } catch (error) {
        console.log('error in toroom',error)
      }
    });
  });
}

