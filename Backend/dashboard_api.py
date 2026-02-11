from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app) # Allow React to talk to this

# Store the latest alert
current_alert = {
    "status": "SAFE",
    "timestamp": time.time()
}

@app.route('/api/alert', methods=['POST'])
def receive_alert():
    """Receives alerts from sentrix_live.py"""
    global current_alert
    data = request.json

    current_alert = {
        "status": "ATTACK",
        "type": data.get("attack_type", "Unknown"),
        "confidence": data.get("confidence", "0%"),
        "source": data.get("attacker_ip", "Unknown"),
        "target": f"{data.get('target_ip')}:{data.get('target_port')}",
        "timestamp": time.time()
    }
    print(f" DASHBOARD UPDATED: {current_alert['type']} from {current_alert['source']}")
    return jsonify({"msg": "Alert Received"}), 200

@app.route('/api/status', methods=['GET'])
def get_status():
    """React polls this to see if we are under attack"""
    global current_alert

    # Auto-clear alert if it's older than 5 seconds
    if time.time() - current_alert["timestamp"] > 5:
        current_alert["status"] = "SAFE"

    return jsonify(current_alert)

if __name__ == '__main__':
    print(" Dashboard Bridge Running on Port 5050...")
    app.run(port=5050)
