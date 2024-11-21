const socket = io();
let username;
let room; // Ahora la variable room es global
let opponent = {};
let myStatuses = {};
let opponentStatuses = {};

// Confirmar conexión al servidor
socket.on('connect', () => {
  console.log('Conectado al servidor');
});

window.onload = () => {
  // Esconder inicialmente las estadísticas del oponente
  document.getElementById('opponentStats').classList.add('hidden');

  // Manejo del botón de ingreso de nombre
  document.getElementById('usernameButton').addEventListener('click', () => {
    username = document.getElementById('usernameInput').value;
    if (username) {
      document.getElementById('usernameSection').classList.add('hidden');
      document.getElementById('roomOptions').classList.remove('hidden');
      console.log(`Nombre de usuario ingresado: ${username}`);
    }
  });

  // Crear una sala
  document.getElementById('createRoomButton').addEventListener('click', () => {
    room = Math.floor(1000 + Math.random() * 9000).toString(); // Número aleatorio de 4 dígitos
    console.log(`Sala creada: ${room}`);
    socket.emit('joinRoom', { room, username });
    enterRoom(room);
  });

  // Unirse a una sala
  document.getElementById('joinRoomButton').addEventListener('click', () => {
    room = document.getElementById('roomInput').value;
    if (room) {
      console.log(`Uniéndose a la sala: ${room}`);
      socket.emit('joinRoom', { room, username });
      enterRoom(room);
    }
  });

  // Tirar el dado
  document.getElementById('rollDiceButton').addEventListener('click', () => {
    const diceResult = Math.floor(Math.random() * 10) + 1;
    console.log(`Resultado del dado: ${diceResult}`);
    document.getElementById('diceResult').textContent = diceResult;
    socket.emit('rollDice', { room, username, diceResult });
  });

  // Siguiente turno
  document.getElementById('nextTurnButton').addEventListener('click', () => {
    console.log('Botón de siguiente turno clickeado');
    socket.emit('nextTurn', { room, username });
  });

  // Eventos de socket.io
  socket.on('userList', (users) => {
    const userList = document.getElementById('userList');
    userList.innerHTML = ''; // Limpiar lista de usuarios
    users.forEach((user) => {
      const userItem = document.createElement('li');
      userItem.textContent = user;
      userList.appendChild(userItem);
      if (user !== username) {
        opponent.username = user;
        document.getElementById('opponentName').textContent = user;
        document.getElementById('opponentNameDefense').textContent = user;
        document.getElementById('opponentStats').classList.remove('hidden');
      }
    });
  });

  socket.on('updateStats', (data) => {
    if (data.username === username) {
      document.getElementById('myLife').textContent = data.life;
      document.getElementById('myDefense').textContent = data.defense;
    } else if (data.username === opponent.username) {
      document.getElementById('opponentLife').textContent = data.life;
      document.getElementById('opponentDefense').textContent = data.defense;
    }
  });

  socket.on('rollDice', (data) => {
    if (data.username !== username) {
      document.getElementById('diceResult').textContent = data.diceResult;
    }
  });

  socket.on('nextTurn', (data) => {
    document.getElementById('turnCounter').textContent =
      parseInt(document.getElementById('turnCounter').textContent) + 1;
    handleStatusEffects();
  });

  socket.on('applyStatus', (data) => {
    const { username, status, duration } = data;

    console.log(
      `Estado recibido para ${username}: ${status}, Duración: ${duration}`,
    );

    if (username === opponent.username) {
      opponentStatuses[status] = duration; // Asignar la duración inicial
      updateOpponentStatusList();
    } else if (username === username) {
      myStatuses[status] = duration; // Asignar la duración inicial
      updateMyStatusList();
    }
  });

  // Lógica para exportar la partida
  document.getElementById('exportButton').addEventListener('click', () => {
    const data = {
      username,
      opponent,
      myLife: document.getElementById('myLife').textContent,
      myDefense: document.getElementById('myDefense').textContent,
      myStatuses,
      opponentLife: document.getElementById('opponentLife').textContent,
      opponentDefense: document.getElementById('opponentDefense').textContent,
      opponentStatuses,
      turn: document.getElementById('turnCounter').textContent,
    };

    console.log('Exportando datos del juego:', data);
    socket.emit('exportGame', { room, data });
  });
};

// Funciones globales

function enterRoom(room) {
  document.getElementById('roomOptions').classList.add('hidden');
  document.getElementById('gameArea').classList.remove('hidden');
  document.getElementById('roomName').textContent = room;
}

function attack(type) {
  let damage;
  switch (type) {
    case 'light':
      damage = 2;
      break;
    case 'normal':
      damage = 3;
      break;
    case 'critical':
      damage = 4;
      break;
  }

  if (parseInt(document.getElementById('opponentDefense').textContent) > 0) {
    updateDefense(-damage, 'opponent');
  } else {
    updateLife(-damage, 'opponent');
  }
}

function buff(type) {
  let amount;
  let target = 'my';
  switch (type) {
    case 'smallDefense':
      amount = 1;
      updateDefense(amount, target);
      break;
    case 'mediumDefense':
      amount = 2;
      updateDefense(amount, target);
      break;
    case 'largeDefense':
      amount = 3;
      updateDefense(amount, target);
      break;
    case 'smallLife':
      amount = 1;
      updateLife(amount, target);
      break;
    case 'mediumLife':
      amount = 2;
      updateLife(amount, target);
      break;
    case 'largeLife':
      amount = 3;
      updateLife(amount, target);
      break;
  }
}

function applyStatus(status) {
  let duration = 3; // Duración por defecto

  // Definir duraciones específicas para ciertos estados
  if (status === 'freeze') {
    duration = 2;
  } else if (status === 'paralyze') {
    duration = 4;
  }

  // Manejar el estado propio (si es 'luck') o del oponente
  if (status === 'luck') {
    if (myStatuses[status] && myStatuses[status] > 0) {
      myStatuses[status] = duration; // Reiniciar la duración si el estado ya existía
      console.log(
        `Reiniciando duración para mi estado: ${status}. Duración reiniciada: ${myStatuses[status]}`,
      );
    } else {
      myStatuses[status] = duration; // Asignar la duración inicial
      console.log(
        `Asignando duración inicial para mi estado: ${status}. Duración inicial: ${myStatuses[status]}`,
      );
    }
    updateMyStatusList();
    socket.emit('applyStatus', {
      room,
      username,
      status,
      duration: myStatuses[status],
    });
  } else {
    if (opponentStatuses[status] && opponentStatuses[status] > 0) {
      opponentStatuses[status] = duration; // Reiniciar la duración si el estado ya existía
      console.log(
        `Reiniciando duración para el estado del oponente: ${status}. Duración reiniciada: ${opponentStatuses[status]}`,
      );
    } else {
      opponentStatuses[status] = duration; // Asignar la duración inicial
      console.log(
        `Asignando duración inicial para el estado del oponente: ${status}. Duración inicial: ${opponentStatuses[status]}`,
      );
    }
    updateOpponentStatusList();
    socket.emit('applyStatus', {
      room,
      username: opponent.username,
      status,
      duration: opponentStatuses[status],
    });
  }
}

function updateLife(change, target) {
  if (target === 'my') {
    const myLife = document.getElementById('myLife');
    let currentLife = parseInt(myLife.textContent);
    currentLife += change;
    if (currentLife < 0) currentLife = 0; // Asegura que la vida no sea menor que 0
    myLife.textContent = currentLife;
    socket.emit('updateStats', {
      room,
      username,
      life: currentLife,
      defense: parseInt(document.getElementById('myDefense').textContent),
    });
  } else if (target === 'opponent') {
    const opponentLife = document.getElementById('opponentLife');
    let currentLife = parseInt(opponentLife.textContent);
    currentLife += change;
    if (currentLife < 0) currentLife = 0; // Asegura que la vida del oponente no sea menor que 0
    opponentLife.textContent = currentLife;
    socket.emit('updateStats', {
      room,
      username: opponent.username,
      life: currentLife,
      defense: parseInt(document.getElementById('opponentDefense').textContent),
    });
  }
}

function updateDefense(change, target) {
  if (target === 'my') {
    const myDefense = document.getElementById('myDefense');
    let currentDefense = parseInt(myDefense.textContent);
    currentDefense += change;
    if (currentDefense < 0) currentDefense = 0; // Asegura que la defensa no sea menor que 0
    myDefense.textContent = currentDefense;
    socket.emit('updateStats', {
      room,
      username,
      life: parseInt(document.getElementById('myLife').textContent),
      defense: currentDefense,
    });
  } else if (target === 'opponent') {
    const opponentDefense = document.getElementById('opponentDefense');
    let currentDefense = parseInt(opponentDefense.textContent);
    currentDefense += change;
    if (currentDefense < 0) currentDefense = 0; // Asegura que la defensa del oponente no sea menor que 0
    opponentDefense.textContent = currentDefense;
    socket.emit('updateStats', {
      room,
      username: opponent.username,
      life: parseInt(document.getElementById('opponentLife').textContent),
      defense: currentDefense,
    });
  }
}

function handleStatusEffects() {
  console.log(
    '--- Comenzando manejo de efectos de estado en un nuevo turno ---',
  );

  // Manejar los efectos en el jugador
  for (let status in myStatuses) {
    if (myStatuses[status] > 0) {
      console.log(
        `Estado actual para mi: ${status}, Duración restante: ${myStatuses[status]}`,
      );
      if (status === 'bleed') {
        updateLife(-1, 'my'); // Aplica daño si estoy sangrando
      }
      if (status === 'fire') {
        applyFireEffect('my'); // Aplica el efecto de fuego
      }
      myStatuses[status]--;
    }
    if (myStatuses[status] === 0) {
      console.log(myStatuses);
      console.log(`Estado ${status} terminó y ha sido eliminado.`);
      console.log(myStatuses[status]);
      delete myStatuses[status];
    }
  }

  // Manejar los efectos en el oponente
  for (let status in opponentStatuses) {
    if (opponentStatuses[status] > 0) {
      console.log(
        `Estado actual para el oponente: ${status}, Duración restante: ${opponentStatuses[status]}`,
      );
      if (status === 'bleed') {
        updateLife(-1, 'opponent'); // Aplica daño si el oponente está sangrando
      }
      if (status === 'fire') {
        applyFireEffect('opponent'); // Aplica el efecto de fuego
      }
      opponentStatuses[status]--;
      if (opponentStatuses[status] === 0) {
        console.log(
          `Estado ${status} en el oponente terminó y ha sido eliminado.`,
        );
        delete opponentStatuses[status];
      }
    }
  }

  updateMyStatusList();
  updateOpponentStatusList();
  console.log('--- Fin del manejo de efectos de estado para este turno ---');
}

function updateMyStatusList() {
  const statusList = document.getElementById('myStatusList');
  statusList.innerHTML = '';
  for (let status in myStatuses) {
    if (myStatuses[status] > 0) {
      const statusItem = document.createElement('li');
      const img = document.createElement('img');
      img.src = `imagen/${status}.png`;
      img.alt = status;
      img.style.width = '20px';
      statusItem.appendChild(img);
      statusItem.appendChild(
        document.createTextNode(` : ${myStatuses[status]} turnos`),
      );
      statusList.appendChild(statusItem);
    }
  }
}

function updateOpponentStatusList() {
  const statusList = document.getElementById('opponentStatusList');
  statusList.innerHTML = '';
  for (let status in opponentStatuses) {
    if (opponentStatuses[status] > 0) {
      const statusItem = document.createElement('li');
      const img = document.createElement('img');
      img.src = `imagen/${status}.png`;
      img.alt = status;
      img.style.width = '20px';
      statusItem.appendChild(img);
      statusItem.appendChild(
        document.createTextNode(` : ${opponentStatuses[status]} turnos`),
      );
      statusList.appendChild(statusItem);
    }
  }
}

function applyFireEffect(target) {
  if (target === 'my') {
    let currentDefense = parseInt(
      document.getElementById('myDefense').textContent,
    );
    if (currentDefense > 0) {
      updateDefense(-1, 'my');
    } else {
      updateLife(-1, 'my');
    }
  } else if (target === 'opponent') {
    let currentDefense = parseInt(
      document.getElementById('opponentDefense').textContent,
    );
    if (currentDefense > 0) {
      updateDefense(-1, 'opponent');
    } else {
      updateLife(-1, 'opponent');
    }
  }
}
