const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

const rooms = {};

const WORD_BANKS = {
  en: {
    animals: ["lion", "tiger", "elephant", "rabbit", "monkey", "giraffe", "dolphin", "penguin", "turtle", "butterfly", "owl", "kangaroo"],
    objects: ["pizza", "phone", "computer", "apple", "banana", "car", "bicycle", "house", "tree", "moon", "book", "guitar", "camera", "robot", "rainbow", "airplane"],
    actions: ["dancing", "swimming", "running", "cooking", "sleeping", "reading", "painting", "jumping", "singing", "fishing", "cycling", "climbing"],
  },
  es: {
    animals: ["leon", "tigre", "elefante", "conejo", "mono", "jirafa", "delfin", "pingüino", "tortuga", "mariposa", "buho", "canguro"],
    objects: ["pizza", "telefono", "ordenador", "manzana", "platano", "coche", "bicicleta", "casa", "arbol", "luna", "libro", "guitarra", "camara", "robot", "arcoiris", "avion"],
    actions: ["bailar", "nadar", "correr", "cocinar", "dormir", "leer", "pintar", "saltar", "cantar", "pescar", "montar", "escalar"],
  },
  fr: {
    animals: ["lion", "tigre", "elephant", "lapin", "singe", "girafe", "dauphin", "pingouin", "tortue", "papillon", "hibou", "kangourou"],
    objects: ["pizza", "telephone", "ordinateur", "pomme", "banane", "voiture", "velo", "maison", "arbre", "lune", "livre", "guitare", "camera", "robot", "arc-en-ciel", "avion"],
    actions: ["danser", "nager", "courir", "cuisiner", "dormir", "lire", "peindre", "sauter", "chanter", "pecher", "faire du velo", "grimper"],
  },
  de: {
    animals: ["loewe", "tiger", "elefant", "kaninchen", "affe", "giraffe", "delfin", "pinguin", "schildkroete", "schmetterling", "eule", "kaenguru"],
    objects: ["pizza", "telefon", "computer", "apfel", "banane", "auto", "fahrrad", "haus", "baum", "mond", "buch", "gitarre", "kamera", "roboter", "regenbogen", "flugzeug"],
    actions: ["tanzen", "schwimmen", "rennen", "kochen", "schlafen", "lesen", "malen", "springen", "singen", "angeln", "radfahren", "klettern"],
  },
};

const ROOM_SETTING_OPTIONS = {
  maxPlayers: Array.from({ length: 19 }, (_, index) => index + 2),
  totalRounds: Array.from({ length: 9 }, (_, index) => index + 2),
  drawTime: Array.from({ length: 46 }, (_, index) => 15 + index * 5),
  wordCount: [1, 2, 3, 4, 5],
  hintCount: [0, 1, 2, 3, 4, 5],
  wordMode: ["normal", "hidden", "combination"],
  language: Object.keys(WORD_BANKS),
  wordCategory: ["all", "animals", "objects", "actions"],
  customWordsOnly: [true, false],
};

app.get("/", (req, res) => {
  res.send("Skribbl server is running");
});


// ======================================================
// HELPER FUNCTIONS
// ======================================================

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomWordBank(room) {
  const localeBank = WORD_BANKS[room.language] || WORD_BANKS.en;
  const categoryWords = room.wordCategory === "all"
    ? Object.values(localeBank).flat()
    : localeBank[room.wordCategory] || Object.values(localeBank).flat();
  const customWords = room.customWords || [];
  const baseWords = room.customWordsOnly ? customWords : [...categoryWords, ...customWords];
  return [...new Set(baseWords.map((word) => String(word).trim()).filter(Boolean))];
}

function generateWordOptions(count = 3, room) {
  const bank = getRoomWordBank(room);
  const selected = [...bank].sort(() => Math.random() - 0.5);
  const options = [];

  while (options.length < Math.max(1, Math.min(count, 5))) {
    if (room.wordMode === "combination") {
      const first = selected[Math.floor(Math.random() * selected.length)] || "sun";
      const second = selected[Math.floor(Math.random() * selected.length)] || "moon";
      const combination = first === second ? `${first} ${room.language === "es" ? "y" : room.language === "fr" ? "et" : room.language === "de" ? "und" : "and"} ${second}` : `${first} ${second}`;
      if (!options.includes(combination)) options.push(combination);
    } else {
      const word = selected.shift();
      if (!word) break;
      options.push(word);
    }
  }

  return options;
}

function getPlayers(room) {
  return room.players.map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    ready: player.ready,
    avatar: player.avatar || 0,
  }));
}

function clearRoomTimers(room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  if (room.hintTimer) {
    clearTimeout(room.hintTimer);
    room.hintTimer = null;
  }

  for (const timer of room.hintTimers || []) clearTimeout(timer);
  room.hintTimers = [];

  if (room.nextRoundTimer) {
    clearTimeout(room.nextRoundTimer);
    room.nextRoundTimer = null;
  }
}

function generateHint(word, revealedLetters = []) {
  if (!word) return "";

  return word
    .split("")
    .map((char, index) => {
      if (/\s/.test(char)) return char;
      return revealedLetters.includes(index) ? char : "_";
    })
    .join(" ");
}

function getPublicRoomList() {
  return Object.values(rooms)
    .filter((room) => room.visibility === "public" && !room.gameStarted && room.players.length < room.maxPlayers)
    .map((room) => ({ roomId: room.roomId, playerCount: room.players.length, maxPlayers: room.maxPlayers, language: room.language, wordMode: room.wordMode }));
}

// START ROUND

function startRound(roomId) {
  const room = rooms[roomId];

  if (!room) return;

  clearRoomTimers(room);

  room.roundEnded = false;
  room.currentWord = null;
  room.revealedLetters = [];
  room.currentHint = "";
  room.currentDrawing = [];
  room.wordOptions = generateWordOptions(room.wordCount, room);

  // Clear canvas
  io.to(roomId).emit("canvas_clear");

  const drawer = room.players[room.currentDrawerIndex];

  if (!drawer) {
    return;
  }

  io.to(roomId).emit("round_start", {
    round: room.round,
    drawerId: drawer.id,
    drawerName: drawer.name,
    time: room.drawTime,
  });

  // Only drawer receives word options
  io.to(drawer.id).emit("word_options", {
    options: room.wordOptions,
  });

  console.log(
    `Round ${room.round} started in room ${roomId}`
  );

  console.log(
    `Drawer: ${drawer.name}`
  );

  console.log(
    `Word options: ${room.wordOptions.join(", ")}`
  );
}


// ======================================================
// FINISH ROUND
// ======================================================

function finishRound(roomId, reason = "time") {
  const room = rooms[roomId];

  if (!room) return;

  // Prevent finishRound from running twice
  if (room.roundEnded) {
    return;
  }

  room.roundEnded = true;

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  if (room.hintTimer) {
    clearTimeout(room.hintTimer);
    room.hintTimer = null;
  }

  const answer = room.currentWord || "Unknown";

  console.log(
    `Round ${room.round} ended in ${roomId}`
  );

  console.log(
    `Reason: ${reason}`
  );

  console.log(
    `Answer: ${answer}`
  );

  io.to(roomId).emit("round_end", {
    word: answer,
    reason,
    scores: getPlayers(room),
    hasReplay: room.currentDrawing.length > 0,
  });

  room.lastReplay = room.currentDrawing.slice();

  // Stop current word
  room.currentWord = null;

  // Wait 3 seconds before next round
  room.nextRoundTimer = setTimeout(() => {
    const currentRoom = rooms[roomId];

    if (!currentRoom) return;

    if (!currentRoom.gameStarted) {
      return;
    }

    currentRoom.turnNumber += 1;

    // Each player draws once per round, so a round is complete only
    // after the drawer has rotated through the full player list.
    if (currentRoom.turnNumber >= currentRoom.totalTurns) {
      finishGame(roomId);
      return;
    }

    const previousDrawerIndex = currentRoom.currentDrawerIndex;
    currentRoom.currentDrawerIndex = (previousDrawerIndex + 1) % currentRoom.players.length;
    if (currentRoom.currentDrawerIndex <= previousDrawerIndex) currentRoom.round += 1;

    currentRoom.roundEnded = false;

    startRound(roomId);
  }, 3000);
}


// FINISH GAME

function finishGame(roomId) {
  const room = rooms[roomId];

  if (!room) return;

  clearRoomTimers(room);

  room.gameStarted = false;

  room.roundEnded = true;

  const leaderboard = [...room.players].sort(
    (a, b) => b.score - a.score
  );

  const winner = leaderboard[0] || null;

  console.log(
    `Game over in room ${roomId}`
  );

  io.to(roomId).emit("game_over", {
    winner: winner
      ? {
          id: winner.id,
          name: winner.name,
          score: winner.score,
        }
      : null,

    leaderboard: leaderboard.map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
    })),
  });
}


// SOCKET CONNECTION

io.on("connection", (socket) => {
  console.log(
    `Socket connected: ${socket.id}`
  );

  // CREATE ROOM

  socket.on("create_room", (data) => {
    const {
      playerName,
      maxPlayers = 8,
      totalRounds = 3,
      drawTime = 60,
      wordCount = 3,
      hintCount = 1,
      wordMode = "normal",
      language = "en",
      wordCategory = "all",
      customWords = [],
      customWordsOnly = false,
      avatar = 0,
      visibility = "private",
    } = data || {};

    if (!playerName || !playerName.trim()) {
      socket.emit(
        "error_message",
        "Please enter your name"
      );

      return;
    }

    const settings = { maxPlayers, totalRounds, drawTime, wordCount, hintCount, wordMode, language, wordCategory };
    const invalidSetting = Object.entries(settings).find(([key, value]) => !ROOM_SETTING_OPTIONS[key]?.includes(key in ROOM_SETTING_OPTIONS && typeof ROOM_SETTING_OPTIONS[key][0] === "number" ? Number(value) : value));
    if (invalidSetting) {
      socket.emit("error_message", `Invalid room setting: ${invalidSetting[0]}`);
      return;
    }

    const cleanCustomWords = [...new Set((Array.isArray(customWords) ? customWords : [])
      .map((word) => String(word).trim().slice(0, 32))
      .filter(Boolean))].slice(0, 100);
    if (customWordsOnly && cleanCustomWords.length === 0) {
      socket.emit("error_message", "Add at least one custom word or turn off custom words only");
      return;
    }
    if (!["private", "public"].includes(visibility)) {
      socket.emit("error_message", "Invalid room visibility");
      return;
    }

    const roomId = generateRoomId();

    const player = {
      id: socket.id,
      name: playerName.trim(),
      score: 0,
      ready: false,
      avatar: Number(avatar) || 0,
    };

    rooms[roomId] = {
      roomId,

      hostId: socket.id,

      players: [player],

      spectators: [],

      visibility,

      bannedNames: [],

      votes: {},

      maxPlayers: Number(maxPlayers),

      totalRounds: Number(totalRounds),

      drawTime: Number(drawTime),

      wordCount: Number(wordCount),

      hintCount: Number(hintCount),

      wordMode,

      language,

      wordCategory,

      customWords: cleanCustomWords,

      customWordsOnly: Boolean(customWordsOnly),

      hintTimers: [],

      revealedLetters: [],

      gameStarted: false,

      round: 0,

      currentDrawerIndex: 0,

      currentWord: null,

      currentHint: "",

      currentDrawing: [],

      lastReplay: [],

      wordOptions: [],

      roundTimer: null,

      hintTimer: null,

      nextRoundTimer: null,

      roundEnded: false,
    };

    socket.join(roomId);

    socket.emit(
      "room_created",
      rooms[roomId]
    );

    console.log(
      `${player.name} created room ${roomId}`
    );
  });

  socket.on("list_public_rooms", () => {
    socket.emit("public_rooms", getPublicRoomList());
  });

  socket.on("find_public_room", () => {
    const availableRooms = getPublicRoomList();
    const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    if (!room) {
      socket.emit("error_message", "No public rooms are open right now. Create one or try again soon.");
      return;
    }
    socket.emit("public_room_found", room);
  });

  // JOIN ROOM

  socket.on("join_room", ({ roomId, playerName, avatar = 0, spectate = false }) => {
    if (!roomId || !playerName) {
      socket.emit(
        "error_message",
        "Room code and name are required"
      );

      return;
    }

    const id = roomId.trim().toUpperCase();

    const room = rooms[id];

    if (!room) {
      socket.emit(
        "error_message",
        "Room not found"
      );

      return;
    }

    const cleanName = String(playerName || "").trim().slice(0, 24);
    if (room.bannedNames.includes(cleanName.toLowerCase())) {
      socket.emit("error_message", "You are banned from this room");
      return;
    }

    if (spectate) {
      socket.join(id);
      room.spectators.push({ id: socket.id, name: cleanName || "Spectator", avatar: Number(avatar) || 0 });
      socket.emit("room_spectated", {
        room: {
          roomId: room.roomId,
          hostId: room.hostId,
          players: getPlayers(room),
          spectators: room.spectators,
          maxPlayers: room.maxPlayers,
          totalRounds: room.totalRounds,
          drawTime: room.drawTime,
          wordCount: room.wordCount,
          hintCount: room.hintCount,
          wordMode: room.wordMode,
          language: room.language,
          wordCategory: room.wordCategory,
          customWords: room.customWords,
          customWordsOnly: room.customWordsOnly,
          visibility: room.visibility,
          gameStarted: room.gameStarted,
          round: room.round,
          drawerId: room.players[room.currentDrawerIndex]?.id || null,
          timeLeft: room.roundTimer ? Math.max(0, Math.ceil((room.roundEndsAt - Date.now()) / 1000)) : 0,
          currentHint: room.currentHint,
          hasReplay: room.lastReplay.length > 0,
        },
      });
      if (room.currentDrawing.length) socket.emit("draw_replay", room.currentDrawing);
      io.to(id).emit("spectators_updated", room.spectators);
      return;
    }

    if (room.gameStarted) {
      socket.emit(
        "error_message",
        "Game has already started"
      );

      return;
    }

    if (
      room.players.length >=
      room.maxPlayers
    ) {
      socket.emit(
        "error_message",
        "Room is full"
      );

      return;
    }

    const duplicateName =
      room.players.some(
        (player) =>
          player.name.toLowerCase() ===
          cleanName.toLowerCase()
      );

    if (duplicateName) {
      socket.emit(
        "error_message",
        "Name already exists in this room"
      );

      return;
    }

    const player = {
      id: socket.id,
      name: cleanName,
      score: 0,
      ready: false,
      avatar: Number(avatar) || 0,
    };

    room.players.push(player);

    socket.join(id);

    socket.emit(
      "room_joined",
      room
    );

    io.to(id).emit(
      "players_updated",
      {
        players: getPlayers(room),
      }
    );

    io.to(id).emit(
      "player_joined",
      {
        player,
        players: getPlayers(room),
      }
    );

    console.log(
      `${cleanName} joined room ${id}`
    );
  });

  // READY

  socket.on("toggle_ready", ({ roomId }) => {
    const room = rooms[roomId];

    if (!room || room.gameStarted) {
      return;
    }

    const player = room.players.find(
      (p) => p.id === socket.id
    );

    if (!player) {
      return;
    }

    player.ready = !player.ready;

    io.to(roomId).emit(
      "players_updated",
      {
        players: getPlayers(room),
      }
    );
  });

  // UPDATE ROOM SETTINGS (HOST, LOBBY ONLY)

  socket.on("update_room_settings", ({ roomId, setting, value } = {}) => {
    const room = rooms[roomId];

    if (!room || room.gameStarted) {
      socket.emit("error_message", "Room settings can only be changed in the lobby");
      return;
    }

    if (room.hostId !== socket.id) {
      socket.emit("error_message", "Only the host can change room settings");
      return;
    }

    if (setting === "customWords") {
      if (!Array.isArray(value)) {
        socket.emit("error_message", "Custom words must be sent as a list");
        return;
      }
      const customWords = [...new Set(value.map((word) => String(word).trim().slice(0, 32)).filter(Boolean))].slice(0, 100);
      if (room.customWordsOnly && customWords.length === 0) {
        socket.emit("error_message", "Add at least one custom word or turn off custom words only");
        return;
      }
      room.customWords = customWords;
    } else {
      const allowedValues = ROOM_SETTING_OPTIONS[setting];
      const numericValue = Number(value);
      const normalizedValue = allowedValues?.some((option) => typeof option === "number") ? numericValue : value;

      if (!allowedValues?.includes(normalizedValue)) {
        socket.emit("error_message", "Invalid room setting");
        return;
      }

      if (setting === "maxPlayers" && normalizedValue < room.players.length) {
        socket.emit("error_message", "Max players cannot be lower than players already in the room");
        return;
      }

      if (setting === "customWordsOnly" && normalizedValue && room.customWords.length === 0) {
        socket.emit("error_message", "Add custom words before enabling custom words only");
        return;
      }

      room[setting] = normalizedValue;
    }

    io.to(roomId).emit("room_settings_updated", {
      maxPlayers: room.maxPlayers,
      totalRounds: room.totalRounds,
      drawTime: room.drawTime,
      wordCount: room.wordCount,
      hintCount: room.hintCount,
      wordMode: room.wordMode,
      language: room.language,
      wordCategory: room.wordCategory,
      customWords: room.customWords,
      customWordsOnly: room.customWordsOnly,
    });
  });

  // START GAME

  socket.on("start_game", ({ roomId }) => {
    const room = rooms[roomId];

    if (!room) {
      return;
    }

    if (room.hostId !== socket.id) {
      socket.emit(
        "error_message",
        "Only host can start the game"
      );

      return;
    }

    if (room.players.length < 2) {
      socket.emit(
        "error_message",
        "At least 2 players are required"
      );

      return;
    }

    const allReady = room.players.every(
      (player) => player.ready
    );

    if (!allReady) {
      socket.emit(
        "error_message",
        "All players must be ready"
      );

      return;
    }

    room.gameStarted = true;

    room.round = 1;
    room.turnNumber = 0;
    room.totalTurns = room.totalRounds * room.players.length;

    room.currentDrawerIndex = 0;

    room.roundEnded = false;

    room.players.forEach((player) => {
      player.score = 0;
    });

    startRound(roomId);

    console.log(
      `Game started in room ${roomId}`
    );
  });

  // WORD CHOSEN

  socket.on(
    "word_chosen",
    ({ roomId, word }) => {
      const room = rooms[roomId];

      if (!room) {
        return;
      }

      if (room.roundEnded) {
        return;
      }

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      if (!drawer) {
        return;
      }

      // Only drawer can choose
      if (drawer.id !== socket.id) {
        console.log(
          "Unauthorized word selection"
        );

        return;
      }

      // Word must be from options
      if (!room.wordOptions.includes(word)) {
        console.log(
          "Invalid word selection"
        );

        return;
      }

      room.currentWord = word;
      room.revealedLetters = [];

      console.log(
        `${drawer.name} selected: ${word}`
      );

      // Tell everyone that drawer selected word
      io.to(roomId).emit(
        "word_selected",
        {
          drawerId: drawer.id,
          drawerName: drawer.name,
        }
      );

      // Send actual word ONLY to drawer
      socket.emit(
        "your_word",
        {
          word,
        }
      );

      io.to(roomId).emit("word_hint", {
        hint: room.wordMode === "hidden" ? "" : generateHint(word),
      });
      room.currentHint = room.wordMode === "hidden" ? "" : generateHint(word);

      // Start timer ONLY after word selection
      room.roundTimer = setTimeout(() => {
        finishRound(
          roomId,
          "time"
        );
      }, room.drawTime * 1000);
      room.roundEndsAt = Date.now() + room.drawTime * 1000;

      // Hints
  if (room.hintCount > 0 && room.wordMode !== "hidden") {
        const interval =
          (room.drawTime * 1000) /
          (room.hintCount + 1);

        for (
          let i = 1;
          i <= room.hintCount;
          i++
        ) {
          const hintTimer = setTimeout(() => {
            const currentRoom =
              rooms[roomId];

            if (
              !currentRoom ||
              currentRoom.roundEnded ||
              !currentRoom.currentWord
            ) {
              return;
            }

            const nextLetter = currentRoom.currentWord.split("").findIndex((char, index) => !/\s/.test(char) && !currentRoom.revealedLetters.includes(index));
            if (nextLetter >= 0) currentRoom.revealedLetters.push(nextLetter);

            const hint = generateHint(currentRoom.currentWord, currentRoom.revealedLetters);
            currentRoom.currentHint = hint;

            io.to(roomId).emit(
              "word_hint",
              {
                hint,
              }
            );
            currentRoom.hintTimers = currentRoom.hintTimers.filter((timer) => timer !== hintTimer);
          }, interval * i);
          room.hintTimers.push(hintTimer);
        }
      }
    }
  );

  // GUESSING

  socket.on(
    "guess",
    ({ roomId, text }) => {
      const room = rooms[roomId];

      if (!room) {
        console.log(
          "GUESS ERROR: room not found"
        );

        return;
      }

      if (!room.currentWord) {
        console.log(
          "GUESS ERROR: no current word"
        );

        return;
      }

      if (room.roundEnded) {
        console.log(
          "GUESS ERROR: round already ended"
        );

        return;
      }

      const player = room.players.find(
        (p) => p.id === socket.id
      );

      if (!player) {
        console.log(
          "GUESS ERROR: player not found"
        );

        return;
      }

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      // Drawer cannot guess
      if (
        drawer &&
        drawer.id === socket.id
      ) {
        console.log(
          "Drawer cannot guess"
        );

        return;
      }

      const normalizeAnswer = (value) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .toLowerCase();
      const userGuess = normalizeAnswer(text);
      const correctAnswer = normalizeAnswer(room.currentWord);

      console.log(
        "================================"
      );

      console.log(
        "PLAYER:",
        player.name
      );

      console.log(
        "GUESS:",
        userGuess
      );

      console.log(
        "ANSWER:",
        correctAnswer
      );

      console.log(
        "================================"
      );

      if (!userGuess) {
        return;
      }

      // CORRECT

      if (
        userGuess === correctAnswer
      ) {
        player.score += 10;

        const scores =
          getPlayers(room);

        console.log(
          `CORRECT -> ${player.name} +10`
        );

        // Send correct result
        io.to(roomId).emit(
          "guess_result",
          {
            correct: true,

            playerId: player.id,

            playerName: player.name,

            points: 10,

            scores,
          }
        );

        // Update leaderboard immediately
        io.to(roomId).emit(
          "players_updated",
          {
            players: scores,
          }
        );

        // Correct answer message
        io.to(roomId).emit(
          "chat_message",
          {
            playerId: "system",

            playerName: "System",

            text:
              `${player.name} guessed the word correctly! +10 points`,
          }
        );

        // End round
        finishRound(
          roomId,
          "correct_guess"
        );

        return;
      }

      // ================================================
      // WRONG

      socket.emit(
        "guess_result",
        {
          correct: false,

          playerId: player.id,

          playerName: player.name,

          points: 0,

          scores: getPlayers(room),
        }
      );

      // Show wrong guess in chat
      io.to(roomId).emit(
        "chat_message",
        {
          playerId: player.id,

          playerName: player.name,

          text: text,
        }
      );
    }
  );


  // ====================================================
  // CHAT
  // ====================================================

  socket.on(
    "chat",
    ({ roomId, text }) => {
      const room = rooms[roomId];

      if (!room) return;

      const player = room.players.find(
        (p) => p.id === socket.id
      );

      if (!player) return;

      if (!text || !text.trim()) {
        return;
      }

      io.to(roomId).emit(
        "chat_message",
        {
          playerId: player.id,

          playerName: player.name,

          text: text.trim(),
        }
      );
    }
  );

  socket.on("request_round_replay", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || (!room.players.some((player) => player.id === socket.id) && !room.spectators.some((player) => player.id === socket.id))) return;
    socket.emit("round_replay_data", room.lastReplay);
  });

  socket.on("moderate_player", ({ roomId, targetId, action }) => {
    const room = rooms[roomId];
    if (!room || !["kick", "ban", "vote", "report"].includes(action)) return;
    const target = room.players.find((player) => player.id === targetId);
    const actor = room.players.find((player) => player.id === socket.id);
    if (!target || !actor || target.id === actor.id) return;

    if (action === "report") {
      io.to(room.hostId).emit("moderation_notice", `${actor.name} reported ${target.name}.`);
      return;
    }

    if (action === "kick" || action === "ban") {
      if (room.hostId !== socket.id || target.id === room.hostId) return;
      if (action === "ban") room.bannedNames.push(target.name.toLowerCase());
    } else {
      room.votes[targetId] ||= [];
      if (room.votes[targetId].includes(socket.id)) return;
      room.votes[targetId].push(socket.id);
      io.to(roomId).emit("chat_message", { playerName: "System", text: `${actor.name} voted to kick ${target.name} (${room.votes[targetId].length} votes).` });
      const eligibleVoters = room.players.length - 1;
      if (room.votes[targetId].length < Math.ceil(eligibleVoters / 2)) return;
    }

    const targetSocket = io.sockets.sockets.get(targetId);
    targetSocket?.emit("room_kicked", { roomId, reason: action === "ban" ? "You were banned from this room" : "You were removed from this room" });
    targetSocket?.leave(roomId);
    const playerIndex = room.players.findIndex((player) => player.id === targetId);
    const wasDrawer = playerIndex === room.currentDrawerIndex;
    const wasHost = targetId === room.hostId;
    room.players.splice(playerIndex, 1);
    delete room.votes[targetId];
    if (wasHost && room.players.length) room.hostId = room.players[0].id;
    if (playerIndex < room.currentDrawerIndex) room.currentDrawerIndex -= 1;
    if (room.currentDrawerIndex >= room.players.length) room.currentDrawerIndex = 0;
    io.to(roomId).emit("player_left", { playerId: targetId, playerName: target.name, players: getPlayers(room) });
    io.to(roomId).emit("players_updated", { players: getPlayers(room), hostId: room.hostId });
    if (room.gameStarted && wasDrawer && room.players.length) finishRound(roomId, "drawer_removed");
  });


  // ====================================================
  // DRAW START
  // ====================================================

  socket.on(
    "draw_start",
    (data) => {
      const room =
        rooms[data.roomId];

      if (!room) return;

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      if (!drawer) return;

      if (drawer.id !== socket.id) {
        return;
      }

      const segment = { x0: data.x, y0: data.y, x1: data.x, y1: data.y, color: data.color, size: data.size, tool: data.tool };
      room.currentDrawing.push([segment]);

      io.to(data.roomId).emit(
        "draw_data",
        segment
      );
    }
  );


  // ====================================================
  // DRAW MOVE
  // ====================================================

  socket.on(
    "draw_move",
    (data) => {
      const room =
        rooms[data.roomId];

      if (!room) return;

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      if (!drawer) return;

      if (drawer.id !== socket.id) {
        return;
      }

      const segment = { x0: data.x0, y0: data.y0, x1: data.x1, y1: data.y1, color: data.color, size: data.size, tool: data.tool };
      if (room.currentDrawing.length) room.currentDrawing[room.currentDrawing.length - 1].push(segment);

      io.to(data.roomId).emit(
        "draw_data",
        segment
      );
    }
  );


  // ====================================================
  // DRAW END
  // ====================================================

  socket.on(
    "draw_end",
    (data) => {
      const room =
        rooms[data.roomId];

      if (!room) return;

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      if (!drawer) return;

      if (drawer.id !== socket.id) {
        return;
      }

      io.to(data.roomId).emit(
        "draw_end"
      );
    }
  );


  // ====================================================
  // CLEAR CANVAS
  // ====================================================

  socket.on(
    "canvas_clear",
    ({ roomId }) => {
      const room = rooms[roomId];

      if (!room) return;

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      if (!drawer) return;

      if (drawer.id !== socket.id) {
        return;
      }

      room.currentDrawing = [];

      io.to(roomId).emit(
        "canvas_clear"
      );
    }
  );


  // ====================================================
  // UNDO
  // ====================================================

  socket.on(
    "draw_undo",
    ({ roomId }) => {
      const room = rooms[roomId];

      if (!room) return;

      const drawer =
        room.players[
          room.currentDrawerIndex
        ];

      if (!drawer) return;

      if (drawer.id !== socket.id) {
        return;
      }

      room.currentDrawing.pop();

      io.to(roomId).emit(
        "draw_undo"
      );
    }
  );


  // DISCONNECT

  socket.on(
    "disconnect",
    () => {
      console.log(
        `Socket disconnected: ${socket.id}`
      );

      for (const roomId in rooms) {
        const room = rooms[roomId];

        const playerIndex =
          room.players.findIndex(
            (p) => p.id === socket.id
          );

        if (playerIndex === -1) {
          const spectatorIndex = room.spectators.findIndex((p) => p.id === socket.id);
          if (spectatorIndex !== -1) {
            room.spectators.splice(spectatorIndex, 1);
            io.to(roomId).emit("spectators_updated", room.spectators);
          }
          continue;
        }

        const wasDrawer =
          playerIndex ===
          room.currentDrawerIndex;

        const wasHost =
          room.hostId === socket.id;

        const player =
          room.players[playerIndex];

        room.players.splice(
          playerIndex,
          1
        );

        // Room empty
        if (room.players.length === 0) {
          clearRoomTimers(room);

          delete rooms[roomId];

          console.log(
            `Room ${roomId} deleted`
          );

          continue;
        }

        // If host leaves, assign new host
        if (wasHost) {
          room.hostId =
            room.players[0].id;
        }

        // Adjust drawer index
        if (
          playerIndex <
          room.currentDrawerIndex
        ) {
          room.currentDrawerIndex--;
        }

        if (
          room.currentDrawerIndex >=
          room.players.length
        ) {
          room.currentDrawerIndex = 0;
        }

        io.to(roomId).emit(
          "player_left",
          {
            playerId: socket.id,

            playerName: player.name,

            players:
              getPlayers(room),
            hostId: room.hostId,
          }
        );

        io.to(roomId).emit(
          "players_updated",
          {
            players:
              getPlayers(room),
            hostId: room.hostId,
          }
        );

        // If current drawer left during game
        if (
          room.gameStarted &&
          wasDrawer
        ) {
          finishRound(
            roomId,
            "drawer_left"
          );
        }

        break;
      }
    }
  );
});


// START SERVER

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(`Server running on port ${PORT}`);
  }
);