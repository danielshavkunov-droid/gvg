const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const GUILDS = [
  { id: 'red', name: 'Красный Дракон', color: '#ef4444' },
  { id: 'blue', name: 'Синий Авангард', color: '#3b82f6' },
  { id: 'green', name: 'Зеленый Лес', color: '#22c55e' },
  { id: 'yellow', name: 'Золотая Орда', color: '#eab308' }
];

let gameState = {
  round: 1,
  currentTurnIndex: 0,
  players: {}, // socketId -> guildId
  pois: [
    { id: 1, name: 'База Красных', q: -7, r: 7, type: 'base', owner: 'red', wpSec: 2, captureTimer: 0, deployedGirls: { red: [], blue: [], green: [], yellow: [] }, accumulatedInfluence: { red: 0, blue: 0, green: 0, yellow: 0 } },
    { id: 2, name: 'База Синих', q: 7, r: -7, type: 'base', owner: 'blue', wpSec: 2, captureTimer: 0, deployedGirls: { red: [], blue: [], green: [], yellow: [] }, accumulatedInfluence: { red: 0, blue: 0, green: 0, yellow: 0 } },
    { id: 3, name: 'База Зеленых', q: -7, r: 0, type: 'base', owner: 'green', wpSec: 2, captureTimer: 0, deployedGirls: { red: [], blue: [], green: [], yellow: [] }, accumulatedInfluence: { red: 0, blue: 0, green: 0, yellow: 0 } },
    { id: 4, name: 'База Желтых', q: 7, r: 0, type: 'base', owner: 'yellow', wpSec: 2, captureTimer: 0, deployedGirls: { red: [], blue: [], green: [], yellow: [] }, accumulatedInfluence: { red: 0, blue: 0, green: 0, yellow: 0 } },
    { id: 5, name: 'Алтарь Победы #1', q: 0, r: 0, type: 'wp', owner: null, wpSec: 5, captureTimer: 0, deployedGirls: { red: [], blue: [], green: [], yellow: [] }, accumulatedInfluence: { red: 0, blue: 0, green: 0, yellow: 0 } }
  ],
  scores: { red: 0, blue: 0, green: 0, yellow: 0 }
};

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Назначаем свободной гильдии
  const takenGuilds = Object.values(gameState.players);
  const assignedGuild = GUILDS.find(g => !takenGuilds.includes(g.id)) || GUILDS[0];
  gameState.players[socket.id] = assignedGuild.id;

  socket.emit('init', { guildId: assignedGuild.id, gameState });
  io.emit('stateUpdate', gameState);

  socket.on('deployGirl', ({ poiId, girl }) => {
    const guildId = gameState.players[socket.id];
    const poi = gameState.pois.find(p => p.id === poiId);

    if (poi && guildId) {
      poi.deployedGirls[guildId].push(girl);
      if (poi.captureTimer === 0) poi.captureTimer = 3;
      io.emit('stateUpdate', gameState);
    }
  });

  socket.on('endTurn', () => {
    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % GUILDS.length;

    // Если круг завершился — обсчитываем раунд
    if (gameState.currentTurnIndex === 0) {
      processRoundEnd();
    }

    io.emit('stateUpdate', gameState);
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    console.log('Игрок отключился:', socket.id);
  });
});

function processRoundEnd() {
  gameState.round++;
  gameState.pois.forEach(poi => {
    if (poi.captureTimer > 0) {
      GUILDS.forEach(g => {
        const activePow = poi.deployedGirls[g.id].reduce((sum, item) => sum + item.power, 0);
        poi.accumulatedInfluence[g.id] += activePow;
      });

      poi.captureTimer--;

      if (poi.captureTimer === 0) {
        // Подсчет победителя по Влиянию
        let maxInf = 0;
        let winner = poi.owner;
        GUILDS.forEach(g => {
          if (poi.accumulatedInfluence[g.id] > maxInf) {
            maxInf = poi.accumulatedInfluence[g.id];
            winner = g.id;
          }
        });
        poi.owner = winner;

        // Возврат девочек
        GUILDS.forEach(g => {
          poi.deployedGirls[g.id] = [];
          poi.accumulatedInfluence[g.id] = 0;
        });
      }
    }

    if (poi.owner) {
      gameState.scores[poi.owner] += poi.wpSec;
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Онлайн сервер запущен на порту ${PORT}`);
});