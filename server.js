const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
    console.log('New user connected');

    socket.on('joinRoom', ({ room, username }) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = { users: [], currentTurn: {}, actions: [] };
        }
        rooms[room].users.push({ username, life: 15, defense: 0, statuses: {} });

        io.to(room).emit('userList', rooms[room].users.map(user => user.username));
        socket.to(room).emit('message', { username: 'System', message: `${username} has joined the room` });
    });

    socket.on('updateStats', ({ room, username, life, defense }) => {
        const user = rooms[room].users.find(user => user.username === username);
        if (user) {
            if (!rooms[room].currentTurn[username]) {
                rooms[room].currentTurn[username] = { initialLife: user.life, initialDefense: user.defense, statuses: {} };
            }
            user.life = life;
            user.defense = defense;

            rooms[room].currentTurn[username].finalLife = life;
            rooms[room].currentTurn[username].finalDefense = defense;

            io.to(room).emit('updateStats', { username, life, defense });
        }
    });

    socket.on('applyStatus', ({ room, username, status, duration }) => {
    const user = rooms[room].users.find(user => user.username === username);
    if (user) {
        if (!rooms[room].currentTurn[username]) {
            rooms[room].currentTurn[username] = { initialLife: user.life, initialDefense: user.defense, statuses: {} };
        }

        // Sumar solo la nueva duración (incremento), no el total
        if (!user.statuses[status]) {
            // Si el estado no existe, lo asignamos con la duración inicial
            user.statuses[status] = duration; 
            console.log(`Asignando estado nuevo: ${status}, Duración inicial: ${duration}`);
        } else {
            // Si el estado ya existe, sumamos solo la duración recibida
            user.statuses[status] += duration; 
            console.log(`Acumulando duración para ${status}. Nueva duración: ${user.statuses[status]}`);
        }

        // Actualizamos los estados en el turno actual
        rooms[room].currentTurn[username].statuses[status] = 'applied';

        // Enviamos el estado actualizado a todos los jugadores
        io.to(room).emit('applyStatus', { username, status, duration: user.statuses[status] });
    }
});





    socket.on('nextTurn', ({ room, username }) => {
        const currentTurnActions = Object.entries(rooms[room].currentTurn).map(([user, changes]) => {
            const action = {
                turn: rooms[room].actions.length + 1,
                username: user,
                action: `Vida: ${changes.initialLife} -> ${changes.finalLife}, Defensa: ${changes.initialDefense} -> ${changes.finalDefense}, Estados: ${JSON.stringify(changes.statuses)}`,
                life: changes.finalLife,
                defense: changes.finalDefense,
                statuses: changes.statuses
            };
            return action;
        });

        rooms[room].actions.push(...currentTurnActions);
        rooms[room].currentTurn = {}; // Reset para el siguiente turno

        io.to(room).emit('nextTurn', { username });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        for (let room in rooms) {
            rooms[room].users = rooms[room].users.filter(user => user.username !== socket.username);
            io.to(room).emit('userList', rooms[room].users.map(user => user.username));
        }
    });

    // Lógica para exportar la partida
    socket.on('exportGame', ({ room }) => {
        const csv = generateCSV(rooms[room].actions);
        const filePath = path.join(__dirname, 'exports', `partida_${room}.csv`);
        fs.writeFileSync(filePath, csv);
        socket.emit('downloadCSV', { url: `/exports/partida_${room}.csv` });
    });

    function generateCSV(actions) {
        const headers = ['Turno', 'Jugador', 'Acción', 'Vida', 'Defensa', 'Estados'];
        const rows = actions.map(action => [
            action.turn,
            action.username,
            action.action,
            action.life,
            action.defense,
            JSON.stringify(action.statuses)
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        return csv;
    }
});

app.get('/exports/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'exports', req.params.filename);
    res.download(filePath);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
