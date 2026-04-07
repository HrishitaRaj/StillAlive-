# 🚀 Still Alive – Decentralized CLI Communication System

> A next-gen CLI + Web-based real-time communication platform simulating **P2P networking**, **zone-based routing**, and **decentralized connectivity** using WebSockets, TCP, and mDNS-inspired discovery.

---

## 📌 Overview

**Still Alive** is a next-generation real-time communication system that combines a **CLI-based chat platform** with a **modern web dashboard (Escuar UI)**. It simulates **decentralized, peer-to-peer (P2P) networking** across dynamic location zones.

Inspired by real-world distributed systems, it integrates:

- 🔗 Peer-to-Peer (P2P) Networking  
- 🌐 TCP/IP Communication  
- 📡 mDNS-inspired Local Discovery  
- 🛰️ WebRTC-style Signaling  
- ⚡ WebSocket-based real-time messaging  

This makes it ideal for experimenting with **low-latency communication**, **distributed architectures**, and **network simulation systems**.

---

## ✨ Features

### 💻 CLI System
- 💬 Real-time terminal-based chat  
- 🌐 Zone-based communication  
- ⚡ Lightweight and fast  

### 🌐 Web App (Escuar Dashboard)
- 📊 Live network monitoring  
- 👥 Rescuer authentication system  
- 🧭 Join/Create rooms  
- 📡 Real-time updates  
- 🚨 Rescue coordination interface  

### 🔥 Core Capabilities
- ⚡ Low-latency messaging (Socket.IO)  
- 🔗 P2P-inspired architecture  
- 📡 Dynamic zone routing  
- 🛰️ WebRTC-inspired signaling  
- 🌍 Future-ready automatic network detection  

---

## 🏗️ Tech Stack

### ⚙️ Backend
- **Node.js**  
- **Express.js**  
- **Socket.IO**  

### 🌐 Frontend
- **React (Vite + TypeScript)**  
- **Tailwind CSS**  

### 🔌 Networking
- **WebSockets**  
- **TCP/IP Model**  
- **P2P Architecture (conceptual)**  
- **WebRTC (planned)**  
- **mDNS-inspired discovery**  

### 🗄️ Backend-as-a-Service
- **Supabase (Auth + Database)**  

### 🛠️ Tools
- **Git & GitHub**  
- **NPM**  



- ## 🏗️ Technologies : 

### ⚙️ Core Technologies
- **Node.js** – Backend runtime for handling asynchronous, event-driven communication  
- **Express.js** – Lightweight server framework for handling HTTP and socket connections  

### 🔌 Real-Time Communication
- **Socket.IO** – Enables real-time, bidirectional communication over WebSockets  
- **WebSockets** – Low-latency, persistent connection for instant message exchange  

### 💻 CLI & Runtime
- **Node.js CLI (process.argv / custom scripts)** – Interactive command-line chat interface  
- **JavaScript (ES6+)** – Core programming language used across the project  

### 🌐 Networking Concepts Implemented
- **TCP/IP Model** – Underlying transport for reliable communication  
- **Zone-based Routing Logic** – Custom algorithm for grouping users by location  
- **P2P-inspired Architecture** – Simulated peer-to-peer communication within zones  
- **mDNS-inspired Discovery (Conceptual)** – Localized grouping and discovery mechanism  
- **WebRTC-inspired Signaling (Conceptual)** – Mimics decentralized connection patterns  

### 🛠️ Development Tools
- **Git & GitHub** – Version control and collaboration  
- **NPM** – Dependency management  


---


## ⚙️ Installation

```bash
# Clone the repository
git clone https://github.com/shasmithareddy/Still_Alive-.git

# Navigate into the project
cd Still_Alive-

# Install dependencies
npm install



▶️ Usage
1️⃣ Start Backend Server
node server.js
2️⃣ Run CLI Client
ZONE=<zone-id> node cli-chat.js <username>
✅ Example
ZONE=zone-641-4007 node cli-chat.js bobby
3️⃣ Run Frontend (Dashboard)
npm run dev
🧠 How It Works
Users connect via CLI or Web UI
Each user is assigned a zone / room
Messages are broadcast within that zone
Socket.IO enables real-time communication
Supabase manages authentication & backend services
System simulates localized P2P clusters


📸 CLI Example Output
═══════════════════════════════════════
  STILLALIVE CLI v2.8.1
═══════════════════════════════════════
👤 Username: bobby
🔧 Mode: server
🌐 Connected to zone: zone-641-4007
📊 Escuar Dashboard

The Escaper Dashboard provides:

📡 Live network visualization
👥 Active users tracking
🌐 Zone/room management
📊 Real-time analytics
🚨 Rescue coordination system
🚧 Future Improvements
🌍 Automatic network detection (mDNS-based)
🔗 True P2P via WebRTC
📱 Mobile-friendly UI
🔐 End-to-end encryption
🤖 AI-based routing
🌐 Cross-zone communication
