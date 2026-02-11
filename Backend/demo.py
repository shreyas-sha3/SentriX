import scapy.all as scapy
import joblib
import time
import threading
from collections import defaultdict
import warnings
import requests # Move import to top

warnings.filterwarnings("ignore")

# --- CONFIGURATION ---
INTERFACE = "wlan0"       # CHECK YOUR INTERFACE
CONFIDENCE_THRESHOLD = 0.90
CHECK_INTERVAL = 2
# FIX 1: Match the port to dashboard_api.py (5050)
DASHBOARD_URL = "http://localhost:5050/api/alert"

print("SENTRIX Live Engine Starting...")
try:
    model = joblib.load('nids_custom_model.pkl')
    features_list = joblib.load('nids_features.pkl')
except:
    exit("❌ Error: Run train_final.py first!")

active_flows = defaultdict(lambda: {'start': time.time(), 'pkts': 0, 'bytes': 0, 'last_seen': time.time()})
lock = threading.Lock()

# --- HELPER FUNCTION ---
def send_dashboard_alert(src, dst, dport, type_attack, confidence):
    try:
        payload = {
            "attacker_ip": src,
            "target_ip": dst,
            "target_port": dport,
            "attack_type": type_attack,
            "confidence": f"{confidence:.0f}"
        }
        requests.post(DASHBOARD_URL, json=payload, timeout=0.1)
    except Exception as e:
        pass # Fail silently if dashboard is offline

def packet_callback(pkt):
    if not pkt.haslayer(scapy.IP): return
    src, dst, proto = pkt[scapy.IP].src, pkt[scapy.IP].dst, pkt[scapy.IP].proto
    dport = pkt.dport if (pkt.haslayer(scapy.TCP) or pkt.haslayer(scapy.UDP)) else 0

    key = (src, dst, dport, proto)
    with lock:
        active_flows[key]['pkts'] += 1
        active_flows[key]['bytes'] += len(pkt)
        active_flows[key]['last_seen'] = time.time()

def analyzer_loop():
    print(f" NIDS ACTIVE. Monitoring {INTERFACE}...")
    print(f"Strict Mode: ON (Threshold: {CONFIDENCE_THRESHOLD*100}%)")

    while True:
        time.sleep(CHECK_INTERVAL)
        with lock:
            snapshot = active_flows.copy()
            active_flows.clear()

        if not snapshot:
            print(f"System Heartbeat: Network Clear", end="\r")
            continue

        for key, stats in snapshot.items():
            src, dst, dport, proto = key
            duration = max(stats['last_seen'] - stats['start'], 0.001)

            data = {
                'Dst Port': dport,
                'Protocol': proto,
                'Flow Duration': duration,
                'Tot Fwd Pkts': stats['pkts'],
                'Rate': stats['pkts'] / duration,
                'Byte Rate': stats['bytes'] / duration
            }

            # AI PREDICTION
            input_vector = [[data[f] for f in features_list]]
            probs = model.predict_proba(input_vector)[0]
            malicious_confidence = probs[1]

            if malicious_confidence > CONFIDENCE_THRESHOLD:
                if data['Rate'] > 1000: attack_type = "VOLUMETRIC FLOOD"
                elif dport == 22 or dport == 21: attack_type = "BRUTE FORCE"
                else: attack_type = "SCAN / DDOS"

                print(f"\033[91mATTACK DETECTED [{malicious_confidence*100:.0f}%]\033[0m {attack_type}")
                print(f"   ➤ {src} -> {dst}:{dport} | Rate: {data['Rate']:.1f} pps")


                send_dashboard_alert(src, dst, dport, attack_type, malicious_confidence*100)

if __name__ == "__main__":
    t = threading.Thread(target=analyzer_loop)
    t.daemon = True
    t.start()
    scapy.sniff(iface=INTERFACE, prn=packet_callback, store=0)
