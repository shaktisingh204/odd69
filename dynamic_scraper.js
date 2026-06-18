const axios = require('axios');
const io = require('socket.io-client');
const https = require('https');
const { URL } = require('url');

// Configuration
const API_URL = 'http://cloud.turnkeyxgaming.com:8086/sports/betfairscorecardandtv';
const API_KEY = '6a9d10424b039000ab1caa11';

// Important: The server might use self-signed certificates for their dynamic score URLs
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class DynamicScoreScraper {
    constructor(eventId, sportsId) {
        this.eventId = eventId;
        this.sportsId = sportsId;
        this.socket = null;
        this.reconnectTimer = null;
        this.isConnecting = false;
    }

    // 1. Fetch fresh Turnkey API data -> Get Score URL
    async start() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            console.log('\n----------------------------------------');
            console.log(`[*] 1. Fetching fresh Turnkey API URL for Event ID: ${this.eventId}...`);

            const response = await axios.get(API_URL, {
                params: {
                    diamondeventid: this.eventId,
                    diamondsportsid: this.sportsId
                },
                headers: {
                    'x-turnkeyxgaming-key': API_KEY
                },
                timeout: 15000
            });

            if (!response.data || !response.data.status || !response.data.data) {
                throw new Error("Invalid or empty Turnkey API response.");
            }

            const scoreUrl = response.data.data.diamond_score_one;
            console.log(`[+] Received Dynamic Score URL: ${scoreUrl}`);

            if (!scoreUrl) {
                throw new Error("diamond_score_one parameter is missing.");
            }

            // 2. Fetch the HTML of the new score page to extract the latest WebSocket server
            console.log(`[*] 2. Parsing WebSocket settings from the new URL HTML...`);
            const scoreHtmlResponse = await axios.get(scoreUrl, { httpsAgent, timeout: 15000 });
            const html = scoreHtmlResponse.data;

            // Extract socket.io server using regex (e.g. io('https://sportsscore24.com'))
            const wsMatch = html.match(/io\(['"](.*?)['"]/);
            let wsUrl = wsMatch ? wsMatch[1] : 'https://sportsscore24.com'; // fallback if regex fails

            // Extract exact room ID from the URL params
            const parsedUrl = new URL(scoreUrl);
            const roomIdStr = parsedUrl.searchParams.get('room');
            const roomId = parseInt(roomIdStr, 10);

            if (!roomId || isNaN(roomId)) {
                throw new Error("Could not parse valid room ID from URL");
            }

            console.log(`[+] Resolved WebSocket URL: ${wsUrl}, Room ID: ${roomId}`);
            this.connectSocket(wsUrl, roomId);

        } catch (error) {
            console.error(`[!] Error in fetch flow: ${error.message}`);
            this.scheduleApiReFetch();
        } finally {
            this.isConnecting = false;
        }
    }

    // 3. Connect to the WebSocket API
    connectSocket(wsUrl, roomId) {
        if (this.socket) {
            this.socket.disconnect();
        }

        console.log(`[*] 3. Establishing WebSocket Connection to ${wsUrl}...`);

        this.socket = io(wsUrl, {
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 4, // If socket natively drops, try to reconnect up to 4 times
            reconnectionDelay: 2000,
            timeout: 15000,
            forceNew: true
        });

        this.socket.on("connect", () => {
            console.log(`[SUCCESS] Connected! Subscribing to Room ${roomId} for real-time scores...`);
            this.socket.emit("subscribe", {
                type: 1,
                rooms: [roomId],
            });
        });

        this.socket.on("update", (msg) => {
            try {
                const data = typeof msg === "string" ? JSON.parse(msg) : msg;
                if (data.type === 1 && data.data) {
                    this.printUpdate(data.data);
                }
            } catch (err) {
                console.error("[ERROR] Parse error processing update:", err.message);
            }
        });

        this.socket.on("connect_error", (err) => {
            console.error(`[WARNING] Socket connection error: ${err.message}`);
        });

        this.socket.on("disconnect", (reason) => {
            console.log(`\n[!] Socket disconnected: ${reason}`);
            // Server actively disconnected us (e.g., room expired) -> Re-fetch API
            if (reason === "io server disconnect") {
                this.scheduleApiReFetch();
            }
        });

        // If socket.io's built-in reconnection maxes out (e.g., Server changed IP or shutdown)
        // We assume the URL is completely expired and restart the whole flow from the start.
        this.socket.on("reconnect_failed", () => {
            console.log(`\n[!] Socket completely failed to reconnect. The WebSocket server/URL may have expired.`);
            this.scheduleApiReFetch();
        });
    }

    printUpdate(scoreData) {
        const team1 = scoreData.spnnation1 || "Team 1";
        const team2 = scoreData.spnnation2 || "Team 2";
        const score1 = scoreData.score1 || "Yet to bat";
        const score2 = scoreData.score2 || "Yet to bat";
        const status = scoreData.spnballrunningstatus || scoreData.spnmessage || "";
        const balls = scoreData.balls && scoreData.balls.length > 0 ? scoreData.balls.join(', ') : "";

        console.log(`\n============ LIVE SCORE [${new Date().toLocaleTimeString()}] ============`);
        console.log(`${team1.padEnd(20)} : ${score1}`);
        console.log(`${team2.padEnd(20)} : ${score2}`);
        if (status) console.log(`[Status] ${status}`);
        if (balls) console.log(`[Recent] ${balls}`);
        console.log("========================================================\n");
    }

    // 4. Safely retry the main API call when the match dynamically switches URLs
    scheduleApiReFetch() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        // Clean up current socket bindings to prevent memory leaks
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        console.log("[*] Scheduling a FULL reboot (Generating new dynamic URL) in 10 seconds...");
        this.reconnectTimer = setTimeout(() => {
            this.start();
        }, 10000);
    }
}

// Ensure you run this script passing eventId and sportsId parameters dynamically
const EVENT_ID = '508972693';
const SPORTS_ID = '4';

console.log(`Initializing Dynamic Live Scraper...`);
const scraper = new DynamicScoreScraper(EVENT_ID, SPORTS_ID);
scraper.start();
