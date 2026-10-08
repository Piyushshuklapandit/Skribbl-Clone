# 🎨 Skribbl Clone

A real-time multiplayer drawing and guessing game inspired by
skribbl.io.

Players can create or join a room, take turns drawing words,
and guess the drawing in real time. The game uses WebSockets
through Socket.IO to synchronize players, drawings, guesses,
chat, turns, and scores.

---

## 👨‍💻 Author

**Piyush Shukla**

GitHub:  
https://github.com/Piyushshuklapandit

---

## 🚀 Features

- Create and join multiplayer rooms
- Real-time multiplayer gameplay
- Turn-based drawing system
- Real-time canvas synchronization
- Word selection for the drawer
- Guessing system
- Real-time chat
- Score tracking
- Leaderboard
- Round timer
- Automatic turn rotation
- Game-end winner screen
- Drawing tools
  - Brush
  - Multiple colors
  - Brush size
  - Undo
  - Clear canvas

---

## 🛠️ Tech Stack

### Frontend

- React.js
- JavaScript
- Vite
- HTML5 Canvas
- CSS3
- Socket.IO Client

### Backend

- Node.js
- Express.js
- Socket.IO

---

## 📁 Project Structure

```text
Skribbl-Clone/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── DrawingCanvas.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── server/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md