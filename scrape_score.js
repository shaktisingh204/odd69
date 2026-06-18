const io = require("socket.io-client");

// The room ID taken from the live score URL (?room=35317902)
const ROOM_ID = 35317902;
// The Websocket Server URL found in the source code
const url = "https://sportsscore24.com";

console.log(`[*] Connecting to live score server at ${url}...`);

// Important: The server uses Socket.IO v2, so you MUST use socket.io-client v2.x
// Install with: npm install socket.io-client@2
const socket = io(url, {
    path: "/socket.io/",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 3000,
    timeout: 20000,
    forceNew: true,
});

socket.on("connect", () => {
    console.log("[SUCCESS] Connected to server!");

    // The server requires this exact 'subscribe' emit format to join the room
    socket.emit("subscribe", {
        type: 1,
        rooms: [ROOM_ID],
    });

    console.log(`[*] Subscribed to room ${ROOM_ID}. Waiting for real-time updates...\n`);
});

socket.on("update", (msg) => {
    try {
        // Message can be a JSON string or an object directly
        const data = typeof msg === "string" ? JSON.parse(msg) : msg;

        // We only care about type 1 messages which contain the scorecard
        if (data.type === 1 && data.data) {
            const scoreData = data.data;

            console.log("========================================");
            console.log("           LIVE MATCH UPDATE            ");
            console.log("========================================");

            const team1 = scoreData.spnnation1 || "Team 1";
            const team2 = scoreData.spnnation2 || "Team 2";
            const score1 = scoreData.score1 || "Yet to bat";
            const score2 = scoreData.score2 || "Yet to bat";

            console.log(`${team1.padEnd(20)} : ${score1}`);
            console.log(`${team2.padEnd(20)} : ${score2}`);
            console.log("----------------------------------------");

            const status = scoreData.spnballrunningstatus || scoreData.spnmessage;
            if (status) {
                console.log(`Status: ${status}`);
            }

            if (scoreData.balls && scoreData.balls.length > 0) {
                console.log(`Recent Balls: ${scoreData.balls.join(', ')}`);
            }

            console.log("========================================\n");
        }
    } catch (err) {
        console.error("[ERROR] Parse error:", err.message);
    }
});

socket.on("connect_error", (err) => {
    console.error("[ERROR] Connection error:", err.message);
});

socket.on("disconnect", (reason) => {
    console.log("[!] Disconnected from server:", reason);
});
