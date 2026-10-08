import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import DrawingCanvas from "./DrawingCanvas";
import logoGif from "./assets/logo.gif";
import "./App.css";

const socket = io("http://localhost:5000");
const PLAYER_LIMITS = Array.from({ length: 19 }, (_, index) => index + 2);
const ROUND_LIMITS = Array.from({ length: 9 }, (_, index) => index + 2);
const DRAW_TIME_OPTIONS = Array.from({ length: 46 }, (_, index) => 15 + index * 5);
const WORD_COUNT_OPTIONS = [1, 2, 3, 4, 5];
const HINT_OPTIONS = [0, 1, 2, 3, 4, 5];
const AVATARS = ["😀", "🐱", "🐸", "🐼", "🦊", "🐵", "🐯", "🐰", "🐨", "🐧", "🐙", "🦄"];
const LANGUAGES = [["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"]];

function App() {
  // BASIC

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");
  const [wordCategory, setWordCategory] = useState("all");
  const [wordMode, setWordMode] = useState("normal");
  const [customWordsDraft, setCustomWordsDraft] = useState("");
  const [customWordsOnly, setCustomWordsOnly] = useState(false);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [homeMode, setHomeMode] = useState(() =>
    new URLSearchParams(window.location.search).has("room") ? "join" : "idle"
  );
  const [roomCode, setRoomCode] = useState(() =>
    new URLSearchParams(window.location.search)
      .get("room")
      ?.toUpperCase() || ""
  );
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [isSpectator, setIsSpectator] = useState(false);
  const [spectateOnJoin, setSpectateOnJoin] = useState(false);
  const [canReplay, setCanReplay] = useState(false);
  const [chatMode, setChatMode] = useState("guess");

  // GAME

  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const [round, setRound] = useState(0);

  const [drawerId, setDrawerId] = useState(null);

  const [wordOptions, setWordOptions] = useState([]);
  const [selectedWord, setSelectedWord] = useState("");

  // TIMER

  const [timeLeft, setTimeLeft] = useState(0);
  const roundDurationRef = useRef(60);

  // GUESS

  const [guess, setGuess] = useState("");

  // CHAT

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);

  // SCORE

  const [scores, setScores] = useState([]);
  const [notification, setNotification] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [volume, setVolume] = useState(100);
  const [hotkeys, setHotkeys] = useState({ brush: "B", fill: "F", undo: "U", clear: "C", swap: "S" });
  const [miscSettings, setMiscSettings] = useState({ mobileKeyboard: "Disabled", keyboardLayout: "English", chatInputLayout: "Bottom", pressureSensitivity: "On", chatBubbles: "Enabled" });

  const [winner, setWinner] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  // LOBBY

  const [isReady, setIsReady] = useState(false);

  // ROOM SETTINGS

  const [maxPlayers, setMaxPlayers] = useState(8);
  const [totalRounds, setTotalRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(60);
  const [wordCount, setWordCount] = useState(3);
  const [hintCount, setHintCount] = useState(0);

  // HINT

  const [hint, setHint] = useState("");

  // socket k sb events

  useEffect(() => {
    // ROOM CREATED

    const handleRoomCreated = (data) => {
      setRoom(data);
      setIsSpectator(false);
      setCustomWordsDraft((data.customWords || []).join(", "));
      setCustomWordsOnly(Boolean(data.customWordsOnly));
      setIsReady(false);
      setError("");
      setGameOver(false);
      setGameStarted(false);
      setMessages([]);
      setScores([]);
    };

    socket.on("room_created", handleRoomCreated);

    // ROOM JOINED

    const handleRoomJoined = (data) => {
      setRoom(data);
      setIsSpectator(false);
      setCustomWordsDraft((data.customWords || []).join(", "));
      setCustomWordsOnly(Boolean(data.customWordsOnly));

      const me = data.players?.find(
        (player) => player.id === socket.id
      );

      setIsReady(Boolean(me?.ready));
      setError("");
      setGameOver(false);
      setMessages([]);
      setScores([]);
    };

    socket.on("room_joined", handleRoomJoined);

    const handleRoomSpectated = ({ room: roomData }) => {
      setRoom(roomData);
      setIsSpectator(true);
      setGameStarted(Boolean(roomData.gameStarted));
      setRound(roomData.round || 0);
      setDrawerId(roomData.drawerId || null);
      setTimeLeft(roomData.timeLeft || 0);
      setHint(roomData.currentHint || "");
      setCanReplay(Boolean(roomData.hasReplay));
      setError("");
    };
    socket.on("room_spectated", handleRoomSpectated);

    // PLAYER JOINED

    const handlePlayerJoined = (data) => {
      setRoom((prevRoom) => {
        if (!prevRoom) return prevRoom;

        return {
          ...prevRoom,
          players: data.players,
          hostId: data.hostId || prevRoom.hostId,
        };
      });
    };

    socket.on("player_joined", handlePlayerJoined);

    // PLAYER LEFT

    const handlePlayerLeft = (data) => {
      setRoom((prevRoom) => {
        if (!prevRoom) return prevRoom;

        return {
          ...prevRoom,
          players: data.players,
          hostId: data.hostId || prevRoom.hostId,
        };
      });
    };

    socket.on("player_left", handlePlayerLeft);

    // PLAYERS UPDATED

    const handlePlayersUpdated = (data) => {
      setRoom((prevRoom) => {
        if (!prevRoom) return prevRoom;

        return {
          ...prevRoom,
          players: data.players,
          hostId: data.hostId || prevRoom.hostId,
        };
      });

      const me = data.players?.find(
        (player) => player.id === socket.id
      );

      setIsReady(Boolean(me?.ready));
    };

    socket.on("players_updated", handlePlayersUpdated);

    const handleRoomSettingsUpdated = (settings) => {
      setRoom((previousRoom) => previousRoom ? { ...previousRoom, ...settings } : previousRoom);
      if (settings.customWords) setCustomWordsDraft(settings.customWords.join(", "));
      if (typeof settings.customWordsOnly === "boolean") setCustomWordsOnly(settings.customWordsOnly);
      if (settings.language) setLanguage(settings.language);
      if (settings.wordMode) setWordMode(settings.wordMode);
      if (settings.wordCategory) setWordCategory(settings.wordCategory);
      setError("");
    };

    socket.on("room_settings_updated", handleRoomSettingsUpdated);

    const handleSpectatorsUpdated = (spectators) => {
      setRoom((previousRoom) => previousRoom ? { ...previousRoom, spectators } : previousRoom);
    };
    socket.on("spectators_updated", handleSpectatorsUpdated);

    const handleRoomKicked = ({ reason }) => {
      setRoom(null);
      setGameStarted(false);
      setIsSpectator(false);
      setError(reason || "You were removed from the room.");
      setHomeMode("idle");
    };
    socket.on("room_kicked", handleRoomKicked);

    const handleModerationNotice = (message) => setNotification(message);
    socket.on("moderation_notice", handleModerationNotice);

    const handlePublicRoomFound = ({ roomId: publicRoomId }) => {
      setRoomCode(publicRoomId);
      setHomeMode("join");
      setError(`Open public room ${publicRoomId} found. Join to enter.`);
    };
    socket.on("public_room_found", handlePublicRoomFound);

    // ROUND START

    const handleRoundStart = (data) => {
      setGameStarted(true);

      setRound(data.round);

      roundDurationRef.current = data.time || 60;

      setDrawerId(data.drawerId);


      setWordOptions([]);

      setSelectedWord("");

      setHint("");

      setNotification("");

      // Timer word selection k baad start hoga
      setTimeLeft(0);
    };

    socket.on("round_start", handleRoundStart);

    // WORD OPTIONS

    const handleWordOptions = (data) => {
      setWordOptions(data.options || data.words || []);
    };

    socket.on("word_options", handleWordOptions);

    // =========================
    // WORD SELECTED
    // =========================

    const handleWordSelected = (data) => {
      setDrawerId(data.drawerId);


      setWordOptions([]);

      setTimeLeft(data.drawTime || roundDurationRef.current);
    };

    socket.on("word_selected", handleWordSelected);

    // =========================
    // YOUR WORD
    // =========================

    const handleYourWord = (data) => {
      setSelectedWord(data.word);
    };

    socket.on("your_word", handleYourWord);

    // =========================
    // WORD HINT
    // =========================

    const handleWordHint = (data) => {
      setHint(data.hint || "");
    };

    socket.on("word_hint", handleWordHint);

    // =========================
    // ROUND END
    // =========================

    const handleRoundEnd = (data) => {
  setCanReplay(Boolean(data.hasReplay));
  setSelectedWord("");

  setWordOptions([]);

  setScores(data.scores || []);

  setTimeLeft(0);

  // Correct guess notification ko overwrite mat karo
  setNotification((previous) => {
    if (
      previous &&
      previous.includes("guessed the word")
    ) {
      return previous;
    }

    return `Round ended! Word was: ${data.word}`;
  });
};

    socket.on("round_end", handleRoundEnd);

    // =========================
    // GUESS RESULT
    // =========================
   
    const handleGuessResult = (data) => {
  setScores(data.scores || []);

  if (data.correct) {
    setNotification(
      `🎉 ${data.playerName} guessed the word! +${data.points} points`
    );
  } else {
    setNotification(
      `${data.playerName} guessed incorrectly.`
    );
  }
};

    socket.on("guess_result", handleGuessResult);

    // =========================
    // CHAT MESSAGE
    // =========================

    const handleChatMessage = (data) => {
      setMessages((prev) => [
        ...prev,
        {
          playerName: data.playerName,
          text: data.text,
        },
      ]);
    };

    socket.on("chat_message", handleChatMessage);

    // =========================
    // ERROR
    // =========================

    const handleError = (message) => {
      setError(message);
    };

    socket.on("error_message", handleError);

    // =========================
    // GAME OVER
    // =========================

    const handleGameOver = (data) => {
      setGameOver(true);

      setWinner(data.winner);

      setLeaderboard(data.leaderboard || []);

      setGameStarted(false);

      setTimeLeft(0);
    };

    socket.on("game_over", handleGameOver);

    // =========================
    // CLEANUP
    // =========================

    return () => {
      socket.off("room_created", handleRoomCreated);
      socket.off("room_joined", handleRoomJoined);
      socket.off("room_spectated", handleRoomSpectated);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("players_updated", handlePlayersUpdated);
      socket.off("room_settings_updated", handleRoomSettingsUpdated);
      socket.off("spectators_updated", handleSpectatorsUpdated);
      socket.off("room_kicked", handleRoomKicked);
      socket.off("moderation_notice", handleModerationNotice);
      socket.off("public_room_found", handlePublicRoomFound);

      socket.off("round_start", handleRoundStart);
      socket.off("word_options", handleWordOptions);
      socket.off("word_selected", handleWordSelected);
      socket.off("your_word", handleYourWord);
      socket.off("word_hint", handleWordHint);

      socket.off("round_end", handleRoundEnd);
      socket.off("guess_result", handleGuessResult);

      socket.off("chat_message", handleChatMessage);

      socket.off("error_message", handleError);

      socket.off("game_over", handleGameOver);
    };
  }, []);

  // =========================================================
  // ROOM LINK
  // =========================================================

  // =========================================================
  // TIMER
  // =========================================================

  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, timeLeft]);

  // =========================================================
  // CREATE ROOM
  // =========================================================

  const createRoom = (visibility = "private") => {
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (customWordsOnly && !customWordsDraft.trim()) {
      setError("Add custom words before enabling custom words only.");
      return;
    }

    socket.emit("create_room", {
      playerName: name.trim(),
      avatar: avatarIndex,
      maxPlayers,
      totalRounds,
      drawTime,
      wordCount,
      hintCount,
      wordMode,
      language,
      wordCategory,
      customWords: customWordsDraft.split(/[\n,]/).map((word) => word.trim()).filter(Boolean),
      customWordsOnly,
      visibility,
    });
  };

  // =========================================================
  // JOIN ROOM
  // =========================================================

  const joinRoom = () => {
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter room code.");
      return;
    }

    socket.emit("join_room", {
      roomId: roomCode.trim().toUpperCase(),
      playerName: name.trim(),
      avatar: avatarIndex,
      spectate: spectateOnJoin,
    });
  };

  const findPublicRoom = () => {
    if (!name.trim()) {
      setError("Please enter your name first.");
      return;
    }
    setError("");
    socket.emit("find_public_room");
  };

  // =========================================================
  // START GAME
  // =========================================================

  const startGame = () => {
    if (!room) return;

    socket.emit("start_game", {
      roomId: room.roomId,
    });
  };

  // =========================================================
  // READY
  // =========================================================

  const toggleReady = () => {
    if (!room) return;

    socket.emit("toggle_ready", {
      roomId: room.roomId,
    });
  };

  const updateRoomSetting = (setting, value) => {
    if (!room || room.hostId !== socket.id) return;
    setError("");
    socket.emit("update_room_settings", {
      roomId: room.roomId,
      setting,
      value: ["wordMode", "language", "wordCategory", "customWords", "customWordsOnly"].includes(setting) ? value : Number(value),
    });
  };

  const moderatePlayer = (action, targetId) => {
    if (!room) return;
    socket.emit("moderate_player", { roomId: room.roomId, targetId, action });
  };

  const requestReplay = () => {
    if (!room || !canReplay) return;
    socket.emit("request_round_replay", { roomId: room.roomId });
  };

  // =========================================================
  // CHOOSE WORD
  // =========================================================

  const chooseWord = (word) => {
    if (!room) return;

    setSelectedWord(word);

    socket.emit("word_chosen", {
      roomId: room.roomId,
      word,
    });
  };

  // =========================================================
  // GUESS
  // =========================================================

  const sendGuess = () => {
    if (!guess.trim() || !room) {
      return;
    }

    socket.emit("guess", {
      roomId: room.roomId,
      text: guess.trim(),
    });

    setGuess("");
  };

  // =========================================================
  // CHAT
  // =========================================================

  const sendChat = () => {
    if (!chatInput.trim() || !room) {
      return;
    }

    socket.emit("chat", {
      roomId: room.roomId,
      text: chatInput.trim(),
    });

    setChatInput("");
  };

  // =========================================================
  // COPY ROOM LINK
  // =========================================================

  const copyRoomLink = async () => {
    if (!room) return;

    const link =
      `${window.location.origin}?room=${room.roomId}`;

    try {
      await navigator.clipboard.writeText(link);

      setNotification("Room link copied!");

      setTimeout(() => {
        setNotification("");
      }, 2000);
    } catch {
      setError("Could not copy room link.");
    }
  };

  const updateHotkey = (key, value) => {
    const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 1);
    setHotkeys((previous) => ({ ...previous, [key]: clean }));
  };

  const resetHotkeys = () => setHotkeys({ brush: "B", fill: "F", undo: "U", clear: "C", swap: "S" });

  if (gameOver) {
    return (
      <div className="page page-game game-classic">
        <div className="game-classic-wrap">
          <div className="game-logo-row"><h1 className="logo-word game-logo-small"><img src={logoGif} alt="Skribbl logo" /></h1></div>
          <section className="panel game-over-panel">
            <h1>Game Over!</h1>
            {winner && <h2>Winner: {winner.name}</h2>}
            <h3>Final leaderboard</h3>
            <ol className="score-list">
              {leaderboard.map((player) => <li key={player.id}><span>{player.name}</span><strong>{player.score} points</strong></li>)}
            </ol>
            <button className="btn btn-primary" onClick={() => window.location.assign("/")}>Play Again</button>
          </section>
        </div>
      </div>
    );
  }

  if (gameStarted && room) {
    const isDrawer = socket.id === drawerId;
    const displayedPlayers = (scores.length > 0 ? scores : room.players || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div className="page page-game game-classic">
        <div className="game-classic-wrap">
          <div className="game-logo-row"><h1 className="logo-word game-logo-small"><img src={logoGif} alt="Skribbl logo" /></h1></div>
          <header className="game-classic-topbar">
            <div className="classic-top-left"><span className="timer-badge">{timeLeft}</span><span>{isSpectator ? "Spectating · " : ""}Round {round} of {room.totalRounds}</span></div>
            <div className="classic-top-center">
              <div className="classic-word-label">{isDrawer ? (wordOptions.length ? "PICK A WORD" : "DRAW THIS") : "GUESS THE WORD"}</div>
              <div className="classic-word-value">{isDrawer ? (selectedWord || "...") : room.wordMode === "hidden" ? "HIDDEN WORD" : (hint || "...")}</div>
            </div>
            <button className="classic-top-right settings-btn" type="button" aria-label="Settings" onClick={() => setShowSettings(true)}>⚙</button>
          </header>

          <div className="game-classic-body">
            <aside className="game-classic-left">
              <ul className="classic-rank-list">
                {displayedPlayers.map((player, index) => (
                  <li key={player.id} className={player.id === drawerId ? "drawer-player" : ""}>
                    <span className="rank-no">#{index + 1}</span>
                    <div className="rank-meta"><strong><span className="player-avatar">{AVATARS[player.avatar || 0]}</span>{player.name}{player.id === socket.id ? " (You)" : ""}</strong><span>{player.id === drawerId ? "Drawing" : (player.score || 0) + " points"}</span></div>
                    {player.id !== socket.id && !isSpectator && <details className="player-actions"><summary aria-label={`Actions for ${player.name}`}>⋮</summary>{room.hostId === socket.id && <><button onClick={() => moderatePlayer("kick", player.id)}>Kick</button><button onClick={() => moderatePlayer("ban", player.id)}>Ban</button></>}<button onClick={() => moderatePlayer("vote", player.id)}>Vote kick</button><button onClick={() => moderatePlayer("report", player.id)}>Report</button></details>}
                  </li>
                ))}
              </ul>
            </aside>

            <main className="game-classic-center">
              <DrawingCanvas socket={socket} roomId={room.roomId} isDrawer={isDrawer} />
              {isDrawer && wordOptions.length > 0 && (
                <div className="choices-modal classic-choices-modal"><h3>Pick a word</h3><div className="choices-row">
                  {wordOptions.map((word) => <button key={word} className="btn" onClick={() => chooseWord(word)}>{word}</button>)}
                </div></div>
              )}
              {canReplay && <button className="btn replay-button" type="button" onClick={requestReplay}>Replay last drawing</button>}
              {notification && <div className="round-notice">{notification}</div>}
            </main>

            <aside className="game-classic-right">
              <div className="chat-box chat-box-classic">
                <div className="chat-feed">
                  {messages.slice(-60).map((message, index) => (
                    <p key={message.playerName + "-" + index} className={message.playerName === "System" ? "chat-system" : "chat-guess"}>
                      {message.playerName && <strong>{message.playerName}: </strong>}{message.text}
                    </p>
                  ))}
                </div>
                {!isSpectator && <form className="stack-form" onSubmit={(event) => {
                  event.preventDefault();
                  if (!isDrawer && chatMode === "guess") sendGuess();
                  else sendChat();
                }}>
                  {!isDrawer && <select aria-label="Message type" value={chatMode} onChange={(event) => setChatMode(event.target.value)}><option value="guess">Guess word</option><option value="chat">Chat message</option></select>}
                  <input type="text" value={isDrawer || chatMode === "chat" ? chatInput : guess}
                    onChange={(event) => isDrawer || chatMode === "chat" ? setChatInput(event.target.value) : setGuess(event.target.value)}
                    placeholder={isDrawer || chatMode === "chat" ? "Type your chat here..." : "Type your guess here..."} maxLength={200} />
                  <button className="btn btn-mini" type="submit">Send</button>
                </form>}
              </div>
            </aside>
          </div>
        </div>
        {showSettings && (
          <div className="settings-overlay" onClick={() => setShowSettings(false)}>
            <section className="settings-modal" onClick={(event) => event.stopPropagation()}>
              <div className="settings-header-row"><h3>Settings</h3><button className="settings-close" onClick={() => setShowSettings(false)} type="button">×</button></div>
              <div className="settings-section"><h4>Volume {volume}%</h4><input className="settings-range" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
              <div className="settings-section"><div className="settings-subheader"><h4>Hotkeys</h4><button className="btn btn-mini" onClick={resetHotkeys} type="button">Reset</button></div>
                <div className="hotkeys-grid">
                  {[["brush", "Brush"], ["fill", "Fill"], ["undo", "Undo"], ["clear", "Clear"], ["swap", "Swap"]].map(([key, label]) => <label key={key}>{label}<input value={hotkeys[key]} onChange={(event) => updateHotkey(key, event.target.value)} /></label>)}
                </div>
              </div>
              <div className="settings-section"><h4>Miscellaneous</h4><div className="misc-grid">
                {[["mobileKeyboard", "Mobile Keyboard (Experimental)", ["Disabled", "Enabled"]], ["keyboardLayout", "Mobile Keyboard Language Layout", ["English", "Spanish"]], ["chatInputLayout", "Mobile Chat Input Layout", ["Bottom", "Top"]], ["pressureSensitivity", "Brush Pressure Sensitivity", ["On", "Off"]], ["chatBubbles", "Mobile Chat Bubbles", ["Enabled", "Disabled"]]].map(([key, label, options]) => (
                  <label key={key}>{label}<select value={miscSettings[key]} onChange={(event) => setMiscSettings((previous) => ({ ...previous, [key]: event.target.value }))}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
                ))}
              </div></div>
            </section>
          </div>
        )}
        {notification && <div className="overlay"><div className="panel notification-card">{notification}</div></div>}
      </div>
    );
  }

  if (room) {
    const isHost = room.hostId === socket.id;
    const players = room.players || [];
    const settings = [
      { key: "maxPlayers", label: "Players", value: room.maxPlayers, options: PLAYER_LIMITS.filter((count) => count >= players.length || count === room.maxPlayers).map((count) => [count, String(count)]) },
      { key: "language", label: "Language", value: room.language, options: LANGUAGES },
      { key: "drawTime", label: "Drawtime", value: room.drawTime, suffix: " seconds", options: DRAW_TIME_OPTIONS.map((seconds) => [seconds, `${seconds} seconds`]) },
      { key: "totalRounds", label: "Rounds", value: room.totalRounds, options: ROUND_LIMITS.map((count) => [count, String(count)]) },
      { key: "wordMode", label: "Game Mode", value: room.wordMode, options: [["normal", "Normal"], ["hidden", "Hidden"], ["combination", "Combination"]] },
      { key: "wordCategory", label: "Word Category", value: room.wordCategory || "all", options: [["all", "All categories"], ["animals", "Animals"], ["objects", "Objects"], ["actions", "Actions"]] },
      { key: "wordCount", label: "Word Count", value: room.wordCount, options: WORD_COUNT_OPTIONS.map((count) => [count, String(count)]) },
      { key: "hintCount", label: "Hints", value: room.hintCount, options: HINT_OPTIONS.map((count) => [count, count === 0 ? "Disabled" : String(count)]) },
    ];

    return (
      <div className="page page-lobby lobby-classic">
        <div className="lobby-wrap">
          <div className="logo-word game-logo-small"><img src={logoGif} alt="Skribbl logo" /></div>
          <header className="lobby-topbar"><div className="top-left">Round 1 of {room.totalRounds}</div><div className="top-center">WAITING</div><div className="top-right">Room {room.roomId}</div></header>
          <div className="lobby-body">
            <aside className="lobby-left">
              <div className="lobby-player-title">Players</div>
              <div className="player-list">
                {players.map((player) => (
                  <div className="player-item" key={player.id}>
                    <div className="row-mini"><span className="player-avatar">{AVATARS[player.avatar || 0]}</span><strong>{player.name}</strong>{player.id === room.hostId && <span className="tag">Host</span>}{player.id === socket.id && <span className="tag">You</span>}</div>
                    <span className={player.ready ? "ready-text" : "muted"}>{player.ready ? "READY" : "Waiting"}</span>
                    {player.id !== socket.id && !isSpectator && <details className="player-actions"><summary aria-label={`Actions for ${player.name}`}>Player actions</summary>{isHost && <><button onClick={() => moderatePlayer("kick", player.id)}>Kick</button><button onClick={() => moderatePlayer("ban", player.id)}>Ban</button></>}<button onClick={() => moderatePlayer("vote", player.id)}>Vote kick</button><button onClick={() => moderatePlayer("report", player.id)}>Report</button></details>}
                  </div>
                ))}
                {players.length < room.maxPlayers && <div className="lobby-open-slot">{room.maxPlayers - players.length} open seats</div>}
              </div>
              {isSpectator ? <p className="muted">Watching as a spectator</p> : <button className="btn btn-mini ready-toggle" onClick={toggleReady}>{isReady ? "Not ready" : "Ready"}</button>}
              <div className="lobby-open-slot">{(room.spectators || []).length} spectators</div>
            </aside>

            <main className="lobby-center">
              {settings.map((setting) => (
                <div className="classic-settings-row" key={setting.key}>
                  <label htmlFor={`room-setting-${setting.key}`}>{setting.label}</label>
                  {isHost && setting.options ? (
                    <select
                      id={`room-setting-${setting.key}`}
                      value={setting.value}
                      onChange={(event) => updateRoomSetting(setting.key, event.target.value)}
                      aria-label={setting.label}
                    >
                      {setting.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : (
                    <div className="setting-value">{setting.key === "hintCount" && setting.value === 0 ? "Disabled" : setting.key === "wordMode" ? setting.value[0].toUpperCase() + setting.value.slice(1) : setting.key === "language" ? LANGUAGES.find(([code]) => code === setting.value)?.[1] || setting.value : setting.key === "wordCategory" ? setting.value[0].toUpperCase() + setting.value.slice(1) : `${setting.value}${setting.suffix || ""}`}</div>
                  )}
                </div>
              ))}
              <div className="classic-custom-label">Custom words</div>
              <textarea className="classic-custom-area" readOnly={!isHost} maxLength={3300} value={isHost ? customWordsDraft : (room.customWords || []).join(", ")} onChange={(event) => setCustomWordsDraft(event.target.value)} placeholder="Add words separated by commas (up to 100 words)." />
              <div className="custom-word-actions">
                <label className="custom-words-only"><input type="checkbox" checked={customWordsOnly} disabled={!isHost} onChange={(event) => {
                  const enabled = event.target.checked;
                  const words = customWordsDraft.split(/[\n,]/).map((word) => word.trim()).filter(Boolean);
                  if (enabled && words.length === 0) {
                    setError("Add custom words before enabling custom words only.");
                    return;
                  }
                  setCustomWordsOnly(enabled);
                  if (enabled) updateRoomSetting("customWords", words);
                  updateRoomSetting("customWordsOnly", enabled);
                }} /> Use custom words only</label>
                {isHost && <button className="btn btn-mini" type="button" onClick={() => updateRoomSetting("customWords", customWordsDraft.split(/[\n,]/).map((word) => word.trim()).filter(Boolean))}>Save words</button>}
              </div>
              <div className="classic-actions-row">
                {isHost ? <button className="btn classic-start-btn" onClick={startGame}>Start!</button> : <button className="btn classic-start-btn" disabled>Waiting for host...</button>}
                <button className="btn classic-invite-btn" onClick={copyRoomLink}>Invite</button>
              </div>
              {error && <p className="lobby-feed-error lobby-error-message">{error}</p>}
            </main>

            <aside className="lobby-right">
              <div className="lobby-feed">
                {messages.length > 0 ? messages.map((message, index) => <p className="lobby-feed-system" key={message.playerName + "-" + index}>{message.playerName}: {message.text}</p>) : <p className="lobby-feed-system">{name || "Player"} is now {isHost ? "the room owner" : "in the room"}.</p>}
              </div>
              <input className="lobby-guess-placeholder" disabled placeholder="Type your guess here..." />
            </aside>
          </div>
          {error && <p className="lobby-feed-error lobby-error-message">{error}</p>}
        </div>
        {notification && <div className="overlay"><div className="panel notification-card">{notification}</div></div>}
      </div>
    );
  }

  return (
    <div className="page page-home home-skribbl">
      <div className="home-pattern" />
      <section className="start-shell">
        <h1 className="logo-word"><img src={logoGif} alt="Skribbl logo" /></h1>
        <div className="avatar-pills" aria-hidden="true"><span className="p red" /><span className="p orange" /><span className="p yellow" /><span className="p green" /><span className="p cyan" /><span className="p blue" /><span className="p purple" /><span className="p pink" /></div>
        <div className="start-card">
          <div className="start-row">
            <input className="start-input" placeholder="Enter your name" autoComplete="off" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
            <select className="start-select" value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language">
              {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
          <div className="avatar-box" aria-label="Player avatar"><button className="arrow-btn" type="button" aria-label="Previous avatar" onClick={() => setAvatarIndex((index) => (index - 1 + AVATARS.length) % AVATARS.length)}>&lt;</button><div className="avatar-face">{AVATARS[avatarIndex]}</div><button className="arrow-btn" type="button" aria-label="Next avatar" onClick={() => setAvatarIndex((index) => (index + 1) % AVATARS.length)}>&gt;</button></div>
          <button className="btn btn-play" onClick={() => { if (!name.trim()) { setError("Please enter your name first."); return; } setError(""); setHomeMode("join"); }}>Play!</button>
          <button className="btn btn-room" onClick={() => createRoom()}>Create Private Room</button>
          <button className="btn public-room-btn" onClick={() => createRoom("public")}>Create Public Room</button>
          <button className="btn public-room-btn" onClick={findPublicRoom}>Find Public Room</button>
          <details className="room-options">
            <summary>Room settings <span>Customize your game</span></summary>
            <div className="room-options-grid">
              <label>Max players<select value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>{PLAYER_LIMITS.map((count) => <option key={count} value={count}>{count} players</option>)}</select></label>
              <label>Rounds<select value={totalRounds} onChange={(event) => setTotalRounds(Number(event.target.value))}>{ROUND_LIMITS.map((count) => <option key={count} value={count}>{count} rounds</option>)}</select></label>
              <label>Draw time<select value={drawTime} onChange={(event) => setDrawTime(Number(event.target.value))}>{DRAW_TIME_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label>
              <label>Word choices<select value={wordCount} onChange={(event) => setWordCount(Number(event.target.value))}>{WORD_COUNT_OPTIONS.map((count) => <option key={count} value={count}>{count} words</option>)}</select></label>
              <label>Hints<select value={hintCount} onChange={(event) => setHintCount(Number(event.target.value))}>{HINT_OPTIONS.map((count) => <option key={count} value={count}>{count === 0 ? "Disabled" : `${count} hints`}</option>)}</select></label>
              <label>Word mode<select value={wordMode} onChange={(event) => setWordMode(event.target.value)}><option value="normal">Normal</option><option value="hidden">Hidden</option><option value="combination">Combination</option></select></label>
              <label>Word category<select value={wordCategory} onChange={(event) => setWordCategory(event.target.value)}><option value="all">All categories</option><option value="animals">Animals</option><option value="objects">Objects</option><option value="actions">Actions</option></select></label>
            </div>
            <label className="home-custom-words">Custom words (comma separated)<textarea value={customWordsDraft} onChange={(event) => setCustomWordsDraft(event.target.value)} placeholder="Try: snowman, lighthouse, skateboard" /></label>
            <label className="custom-words-only"><input type="checkbox" checked={customWordsOnly} onChange={(event) => setCustomWordsOnly(event.target.checked)} /> Use only my custom words</label>
          </details>
          {homeMode === "join" && <div className="mode-box modern-box"><div className="mode-header"><strong>Join Room</strong><button className="btn btn-mini" onClick={() => setHomeMode("idle")}>Back</button></div><div className="mode-grid"><input className="modern-input" placeholder="Room code" value={roomCode} maxLength={8} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} /><button className="btn btn-primary skribbl-blue" onClick={joinRoom}>{spectateOnJoin ? "Watch Room" : "Join Room"}</button><label className="custom-words-only"><input type="checkbox" checked={spectateOnJoin} onChange={(event) => setSpectateOnJoin(event.target.checked)} /> Join as spectator</label></div></div>}
          {error && <p className="home-error">{error}</p>}
        </div>
      </section>
      <section className="home-info-strip">
        <article className="info-card"><h3>About</h3><p>Free online multiplayer drawing and guessing game with real-time rooms.</p></article>
        <article className="info-card"><h3>News</h3><p>Fresh paint update: a colorful place to draw, guess, and play together.</p></article>
        <article className="info-card"><h3>How to play</h3><p>Draw your chosen word while others race to guess it before time runs out.</p></article>
      </section>
    </div>
  );
}

export default App;
