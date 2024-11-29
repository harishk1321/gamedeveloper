const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });

let players = []; // Matchmaking queue

server.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'joinQueue') {
      players.push(ws);
      if (players.length >= 2) {
        // Match found
        const [player1, player2] = players.splice(0, 2);
        player1.send(JSON.stringify({ type: 'startGame', opponent: 'Player 2' }));
        player2.send(JSON.stringify({ type: 'startGame', opponent: 'Player 1' }));
      }
    }
    // Handle game updates
    if (data.type === 'gameMove') {
      ws.send(JSON.stringify({ type: 'update', ...data }));
    }
  });
});
