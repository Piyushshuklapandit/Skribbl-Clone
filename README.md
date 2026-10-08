# 🖍️ Skribbl Clone

A real-time multiplayer drawing and guessing game inspired by
skribbl.io. Players can create or join rooms, take turns drawing
a selected word, and guess the drawing in real time.

The application uses React and Vite for the frontend, Node.js and
Express for the backend, and Socket.IO for real-time communication
between players.

---

## 🌐 Live Demo

### 🎮 Play the Game
https://skribbl-clone-rho.vercel.app/

### ⚙️ Backend
https://skribbl-server-39gs.onrender.com

### 💻 Source Code
https://github.com/Piyushshuklapandit/Skribbl-Clone

---

## 👨‍💻 Author

**Piyush Shukla**

GitHub:  
https://github.com/Piyushshuklapandit

---

## ✨ Features

- Create and join multiplayer rooms
- Room-based multiplayer gameplay
- Turn-based drawing system
- Real-time drawing synchronization
- Word selection for the drawer
- Guessing system
- Real-time chat
- Score tracking
- Leaderboard
- Round timer
- Automatic turn rotation
- Game-end winner screen
- Interactive drawing canvas
- Multiple drawing colors
- Adjustable brush size
- Undo drawing
- Clear canvas

---

## 🎮 Game Flow

```text
Home
  │
  ▼
Create / Join Room
  │
  ▼
Lobby
  │
  ▼
Host Starts Game
  │
  ▼
Word Selection
  │
  ▼
Drawing Round
  │
  ├── Drawer draws the selected word
  │
  └── Other players submit guesses
  │
  ▼
Correct Guess
  │
  ▼
Score Update
  │
  ▼
Round Ends
  │
  ▼
Next Player Draws
  │
  ▼
Next Round
  │
  ▼
Final Leaderboard
  │
  ▼
Winner
```

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

### Deployment

- Frontend: Vercel
- Backend: Render
- Real-time communication: Socket.IO

---

## 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │      Players        │
                    │  Browser / Client   │
                    └──────────┬──────────┘
                               │
                               │ Socket.IO
                               ▼
                    ┌─────────────────────┐
                    │    Node.js Server   │
                    │   Express + Socket  │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
              Rooms         Game State     Scores
                 │             │             │
                 └─────────────┼─────────────┘
                               │
                               ▼
                    Real-Time Updates
                               │
                               ▼
                    All Connected Players
```

The frontend handles the user interface, drawing canvas, player
interaction, chat, and game screens.

The backend manages rooms, players, game state, turns, guesses,
scores, and real-time communication.

Socket.IO synchronizes game events between the server and all
connected clients.

---

## 🔄 Real-Time Communication

Socket.IO is used to synchronize important game events in real
time.

### Room & Lobby Events

```text
create_room
join_room
player_joined
player_left
start_game
```

### Game Events

```text
game_state
round_start
word_chosen
round_end
game_over
```

### Drawing Events

```text
draw_start
draw_move
draw_end
draw_data
canvas_clear
draw_undo
```

### Chat & Guessing Events

```text
guess
guess_result
chat
chat_message
```

---

## 🖌️ Drawing System

The game uses the HTML5 Canvas API for drawing.

When the drawer draws something, the drawing data is sent through
Socket.IO to the backend and then broadcast to the other players.

```text
Mouse / Pointer
      │
      ▼
Canvas Drawing
      │
      ▼
Drawing Stroke
      │
      ▼
Socket.IO
      │
      ▼
Node.js Server
      │
      ▼
Other Connected Players
      │
      ▼
Canvas Updated
```

This allows players in the same room to see drawing updates in
real time.

---

## 🏆 Scoring System

Players receive points for correctly guessing the selected word.

The game maintains player scores and updates the leaderboard
during the game.

At the end of the configured game rounds, the final leaderboard
determines the winner.

---

## 💬 Chat & Guessing

Players can send guesses through the chat interface.

The guess is sent to the server, where it is checked against the
selected word.

```text
Player Guess
     │
     ▼
Socket.IO
     │
     ▼
Server
     │
     ▼
Word Matching
     │
     ├── Correct → Score Update
     │
     └── Incorrect → Continue Guessing
```

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
```

---

## ⚙️ Run Locally

### 1. Clone the Repository

```bash
git clone https://github.com/Piyushshuklapandit/Skribbl-Clone.git
cd Skribbl-Clone
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Start Backend

```bash
node server.js
```

The backend runs on the configured server port.

### 4. Install Frontend Dependencies

Open another terminal:

```bash
cd client
npm install
```

### 5. Start Frontend

```bash
npm run dev
```

The Vite development server normally runs at:

```text
http://localhost:5173
```

---

## 🚀 Deployment

The project is deployed using a separate frontend and backend
architecture.

```text
GitHub Repository
       │
       ├──────────────► Vercel
       │                  │
       │                  ▼
       │             React Frontend
       │
       └──────────────► Render
                          │
                          ▼
                   Node.js + Socket.IO
```

### Frontend

The React/Vite frontend is deployed on Vercel.

Live URL:

https://skribbl-clone-rho.vercel.app/

### Backend

The Node.js + Express + Socket.IO backend is deployed on Render.

Backend URL:

https://skribbl-server-39gs.onrender.com

This architecture keeps the WebSocket server on a platform that
supports persistent WebSocket connections while serving the
frontend through Vercel.

---

## 🧪 Core Game Requirements

The project is designed around the core requirements of the
Skribbl.io clone assignment:

- Multiplayer rooms
- Turn-based drawing
- Real-time drawing synchronization
- Word selection
- Guessing
- Scoring
- Leaderboard
- Game-end winner
- WebSocket-based communication
- Drawing tools
- Chat and guessing

The primary production flow is:

```text
Create Room
     ↓
Join Room
     ↓
Lobby
     ↓
Start Game
     ↓
Choose Word
     ↓
Draw
     ↓
Guess
     ↓
Score
     ↓
Next Round
     ↓
Winner
```

---

## 🔐 WebSocket Architecture

The backend acts as the central source of truth for the multiplayer
game state.

It manages:

- Connected players
- Rooms
- Current drawer
- Current round
- Selected word
- Drawing events
- Player guesses
- Scores
- Game progression

Socket.IO broadcasts relevant events to players connected to the
same room.

---

## 📌 Future Improvements

- Public room browser
- Private invite-only rooms
- Custom word lists
- Word categories
- Eraser tool
- Player avatars
- Kick / ban functionality
- Vote kick
- Multiple language support
- Spectator mode
- Drawing replay
- Improved mobile responsiveness
- Enhanced game moderation

---

## 📄 License

This project was developed for educational and internship
assignment purposes.

---

## 🔗 Important Links

**Live Demo:**  
https://skribbl-clone-rho.vercel.app/

**Backend:**  
https://skribbl-server-39gs.onrender.com

**GitHub:**  
https://github.com/Piyushshuklapandit/Skribbl-Clone