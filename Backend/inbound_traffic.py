import scapy.all as scapy
import pandas as pd
import time
import threading
from collections import defaultdict
import warnings
import sys

warnings.filterwarnings("ignore")

# --- CONFIGURATION ---
if len(sys.argv) < 3:
    print("Usage: sudo python inbound_collector.py <output.csv> <ATTACKER_IP>")
    print("Example: sudo python inbound_collector.py attack_inbound.csv 192.168.1.20")
    exit()

OUTPUT_FILE = sys.argv[1]
ATTACKER_IP = sys.argv[2]  # The IP of your OTHER PC
CAPTURE_DURATION = 360      # 2 Minutes
INTERFACE = "wlan0"         # MUST be your physical WiFi/Ethernet card

print(f"🔥 RECORDING INBOUND ATTACK from {ATTACKER_IP}")
print(f"listening on {INTERFACE}...")

active_flows = defaultdict(lambda: {'start': time.time(), 'pkts': 0, 'bytes': 0, 'last_seen': time.time()})
dataset = []
start_time = time.time()
lock = threading.Lock()
stats = {"benign": 0, "malicious": 0}

def packet_callback(pkt):
    if not pkt.haslayer(scapy.IP): return

    src = pkt[scapy.IP].src
    dst = pkt[scapy.IP].dst
    proto = pkt[scapy.IP].proto
    dport = pkt.dport if (pkt.haslayer(scapy.TCP) or pkt.haslayer(scapy.UDP)) else 0

    key = (src, dst, dport, proto)

    with lock:
        active_flows[key]['pkts'] += 1
        active_flows[key]['bytes'] += len(pkt)
        active_flows[key]['last_seen'] = time.time()

        # --- INBOUND LOGIC ---
        # If packet comes FROM the Attacker, it is MALICIOUS (1)
        if src == ATTACKER_IP:
            stats["malicious"] += 1
        else:
            stats["benign"] += 1

def print_status():
    while (time.time() - start_time) < CAPTURE_DURATION:
        time.sleep(1)
        with lock:
            print(f"⏳ Recording... | 🛡️  Normal: {stats['benign']} | 🚨 INBOUND ATTACKS: {stats['malicious']}", end="\r")

# Start
t = threading.Thread(target=print_status, daemon=True)
t.start()

scapy.sniff(iface=INTERFACE, prn=packet_callback,
            stop_filter=lambda p: (time.time() - start_time) > CAPTURE_DURATION, store=0)

print("\n\nProcessing Data...")
with lock:
    for key, val in active_flows.items():
        src, dst, dport, proto = key
        duration = max(val['last_seen'] - val['start'], 0.001)

        # LABELING
        if src == ATTACKER_IP:
            label = 1
        else:
            label = 0

        dataset.append({
            'Dst Port': dport,
            'Protocol': proto,
            'Flow Duration': duration,
            'Tot Fwd Pkts': val['pkts'],
            'Rate': val['pkts'] / duration,
            'Byte Rate': val['bytes'] / duration,
            'Label': label
        })

pd.DataFrame(dataset).to_csv(OUTPUT_FILE, index=False)
print(f"✅ Saved to {OUTPUT_FILE}")
