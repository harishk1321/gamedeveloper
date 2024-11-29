const express = require("express");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = 3000;
const wss = new WebSocket.Server({ noServer: true });
const secretKey = "your_secret_key";

// Database setup
const db = new sqlite3.Database(":memory:");
db.serialize(() => {
  db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0)");
  db.run("CREATE TABLE games (id INTEGER PRIMARY KEY, player1 TEXT, player2 TEXT, winner TEXT)");
});

// Middleware for JSON
app.use(express.json());

// Routes
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "Invalid input" });
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword], function (err) {
    if (err) return res.status(500).json({ message: "Error registering user" });
    res.status(201).json({ message: "User registered" });
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, secretKey);
    res.json({ token });
  });
});

// WebSocket matchmaking and game logic
let queue = [];
let games = {};

wss.on("connection", (ws, req) => {
  ws.on("message", (message) => {
    const data = JSON.parse(message);
    if (data.type === "joinQueue") {
      queue.push(ws);
      if (queue.length >= 2) {
        const [player1, player2] = queue.splice(0, 2);
        const gameId = Date.now();
        games[gameId] = { player1, player2, state: {} };
        player1.send(JSON.stringify({ type: "startGame", gameId, player: "Player 1" }));
        player2.send(JSON.stringify({ type: "startGame", gameId, player: "Player 2" }));
      }
    } else if (data.type === "gameMove") {
      const game = games[data.gameId];
      const opponent = game.player1 === ws ? game.player2 : game.player1;
      opponent.send(JSON.stringify({ type: "gameMove", move: data.move }));
    }
  });
});

// Upgrade HTTP to WebSocket
const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
