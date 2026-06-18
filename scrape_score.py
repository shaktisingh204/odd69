import sys
import json
import time

try:
    import socketio
except ImportError:
    print("Error: The 'python-socketio' package is not installed.")
    print("Please install it using: pip install \"python-socketio[client]<5.0.0\"")
    sys.exit(1)

# Check version because the server is Socket.IO v2
# We need python-socketio version 4.x
sio_version = getattr(socketio, "__version__", "")
if sio_version.startswith("5."):
    print(f"Warning: You are using python-socketio v{sio_version}.")
    print("The target server uses Socket.IO v2, which may not be compatible with v5+ clients.")
    print("If connection fails, please downgrade: pip install \"python-socketio[client]<5.0.0\"")

sio = socketio.Client(logger=False, engineio_logger=False)

ROOM_ID = 35317902
URL_ENDPOINT = "https://sportsscore24.com"

@sio.event
def connect():
    print("[SUCCESS] Connected to live score server!")
    # Send subscription message just like the website does
    sio.emit('subscribe', {
        'type': 1,
        'rooms': [ROOM_ID]
    })
    print(f"[*] Subscribed to room {ROOM_ID}. Waiting for live data...\n")

@sio.event
def update(msg):
    # Depending on the server/client, data might come as a JSON string or dict
    if isinstance(msg, str):
        try:
            data = json.loads(msg)
        except json.JSONDecodeError:
            print("[ERROR] Failed to parse message:", msg)
            return
    else:
        data = msg
        
    if isinstance(data, dict) and data.get("type") == 1 and "data" in data:
        score_data = data["data"]
        
        # Extract properties
        team1 = score_data.get("spnnation1", "Team 1")
        score1 = score_data.get("score1", "Yet to bat")
        team2 = score_data.get("spnnation2", "Team 2")
        score2 = score_data.get("score2", "Yet to bat")
        status = score_data.get("spnballrunningstatus") or score_data.get("spnmessage")
        balls = score_data.get("balls", [])
        
        print("="*40)
        print("         LIVE MATCH UPDATE")
        print("="*40)
        print(f"{team1: <20} : {score1}")
        print(f"{team2: <20} : {score2}")
        print("-"*40)
        
        if status:
            print(f"Status: {status}")
            
        if balls:
            print(f"Recent Balls: {', '.join(map(str, balls))}")
            
        print("="*40)
        print("\n")

@sio.event
def connect_error(err):
    print("[ERROR] Connection error:", err)

@sio.event
def disconnect():
    print("[!] Disconnected from server.")

def main():
    print(f"[*] Attempting to connect to {URL_ENDPOINT} for room {ROOM_ID}...")
    try:
        # The site specifies polling and websocket transports with standard socket.io path
        sio.connect(
            URL_ENDPOINT, 
            socketio_path="/socket.io/", 
            transports=['websocket', 'polling']
        )
        sio.wait()
    except Exception as e:
        print("[ERROR] Could not connect:", e)
        print("Make sure you are using python-socketio version 4.x.")

if __name__ == '__main__':
    main()
