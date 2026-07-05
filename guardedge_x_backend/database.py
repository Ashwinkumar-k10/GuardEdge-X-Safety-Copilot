import sqlite3
import os
import random
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "guardedge_x.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    print(f"Initializing SQLite database at: {DB_PATH}")
    conn = get_db_connection()
    cursor = conn.cursor()

    # Table 1: System logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL, -- INFO, WARNING, ERROR, CRITICAL
            source TEXT NOT NULL, -- SYSTEM, CAMERA, RADAR, GPIO, AI
            message TEXT NOT NULL
        )
    """)

    # Table 2: Near-miss collisions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS near_misses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            machinery_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            worker_id TEXT NOT NULL,
            min_distance REAL NOT NULL, -- meters
            relative_speed REAL NOT NULL, -- m/s
            trajectory_intersection TEXT NOT NULL, -- TRUE/FALSE
            action_taken TEXT NOT NULL, -- NONE, WARNING_ALARM, E_STOP_ACTUATED
            video_replay_path TEXT -- path to mock replay file
        )
    """)

    # Table 3: Operator fatigue logs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fatigue_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            ear REAL NOT NULL,
            mar REAL NOT NULL,
            perclos REAL NOT NULL,
            yawn_count INTEGER NOT NULL,
            head_pitch REAL NOT NULL,
            fatigue_probability REAL NOT NULL,
            alert_level TEXT NOT NULL -- NORMAL, WARNING, CRITICAL
        )
    """)

    # Table 4: PPE Violations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ppe_violations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            worker_id TEXT NOT NULL,
            missing_helmet INTEGER NOT NULL, -- 1 or 0
            missing_vest INTEGER NOT NULL, -- 1 or 0
            missing_gloves INTEGER NOT NULL, -- 1 or 0
            missing_boots INTEGER NOT NULL, -- 1 or 0
            detection_confidence REAL NOT NULL
        )
    """)

    # Table 5: System Settings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    conn.commit()

    # Seed default settings if not exists
    default_settings = {
        "safety_bubble_base_radius": "3.0", # meters
        "collision_ttc_threshold": "2.0", # seconds
        "fatigue_ear_threshold": "0.20",
        "fatigue_yawn_threshold": "0.65",
        "radar_max_range": "15.0", # meters
        "buzzer_volume": "80", # %
        "estop_relay_enabled": "1" # TRUE
    }

    for key, value in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, value))

    # Check if data already seeded
    cursor.execute("SELECT COUNT(*) FROM system_logs")
    if cursor.fetchone()[0] == 0:
        seed_historical_data(cursor)

    conn.commit()
    conn.close()
    print("Database initialized and seeded successfully.")

def seed_historical_data(cursor):
    print("Seeding historical database entries...")
    now = datetime.now()
    
    # 1. Seed system logs (past 3 days)
    sources = ["SYSTEM", "CAMERA_OPTICAL", "CAMERA_OPERATOR", "RADAR_MMWAVE", "ULTRASONIC", "GPIO_CONTROLLER", "AI_PIPELINE"]
    for i in range(150):
        time_offset = random.randint(1, 4320) # up to 3 days ago in minutes
        log_time = (now - timedelta(minutes=time_offset)).isoformat()
        src = random.choice(sources)
        lvl = "INFO"
        if random.random() > 0.85:
            lvl = "WARNING"
        if random.random() > 0.98:
            lvl = "ERROR"

        msg = f"Diagnostics running on {src} - status OK."
        if lvl == "WARNING":
            msg = f"Minor latency jitter detected on {src} (>120ms)."
        elif lvl == "ERROR":
            msg = f"Connection timeout on {src}. Recovering interface..."

        cursor.execute("INSERT INTO system_logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)",
                       (log_time, lvl, src, msg))

    # 2. Seed Near Misses (past 7 days, ~15 incidents)
    operators = ["Rajesh Kumar", "Amit Sharma", "Suresh Patel", "Vikram Singh"]
    workers = ["W-002", "W-004", "W-005", "W-007", "W-012"]
    
    # We will seed specific structural near misses for Analytics dashboard
    near_miss_incidents = [
        ("W-004", 1.8, 2.1, "TRUE", "E_STOP_ACTUATED"),
        ("W-012", 2.2, 1.5, "TRUE", "WARNING_ALARM"),
        ("W-002", 2.9, 0.8, "FALSE", "WARNING_ALARM"),
        ("W-005", 1.2, 3.4, "TRUE", "E_STOP_ACTUATED"),
        ("W-007", 2.5, 1.1, "TRUE", "WARNING_ALARM"),
        ("W-004", 2.1, 1.9, "TRUE", "WARNING_ALARM"),
        ("W-012", 1.4, 2.7, "TRUE", "E_STOP_ACTUATED"),
        ("W-002", 3.2, 0.4, "FALSE", "NONE"),
        ("W-005", 2.7, 1.2, "FALSE", "WARNING_ALARM"),
        ("W-007", 1.9, 2.2, "TRUE", "E_STOP_ACTUATED"),
        ("W-004", 2.8, 1.0, "FALSE", "WARNING_ALARM"),
        ("W-012", 1.1, 3.1, "TRUE", "E_STOP_ACTUATED")
    ]

    for idx, (w_id, dist, speed, intersect, action) in enumerate(near_miss_incidents):
        day_offset = random.randint(0, 6)
        hour_offset = random.randint(8, 17) # daytime shift
        min_offset = random.randint(0, 59)
        inc_time = (now - timedelta(days=day_offset)).replace(hour=hour_offset, minute=min_offset).isoformat()
        
        op = random.choice(operators)
        cursor.execute("""
            INSERT INTO near_misses 
            (timestamp, machinery_id, operator_name, worker_id, min_distance, relative_speed, trajectory_intersection, action_taken, video_replay_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (inc_time, "CAT-320D-01", op, w_id, dist, speed, intersect, action, f"/replays/near_miss_{idx+1}.mp4"))

        # Log system event as well
        log_lvl = "WARNING" if action == "WARNING_ALARM" else "CRITICAL"
        log_msg = f"Near-miss detected with worker {w_id}. Distance: {dist}m. Action taken: {action}."
        cursor.execute("INSERT INTO system_logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)",
                       (inc_time, log_lvl, "AI_PIPELINE", log_msg))

    # 3. Seed Operator Fatigue Logs
    for i in range(120):
        day_offset = random.randint(0, 6)
        hour_offset = random.randint(6, 22) # full shift spans
        min_offset = random.randint(0, 59)
        fat_time = (now - timedelta(days=day_offset)).replace(hour=hour_offset, minute=min_offset).isoformat()
        
        op = random.choice(operators)
        
        # Most logs are normal
        prob = random.random()
        if prob > 0.95: # Critical fatigue
            ear = random.uniform(0.12, 0.16)
            mar = random.uniform(0.70, 0.90)
            perclos = random.uniform(0.15, 0.28)
            yawns = random.randint(3, 6)
            pitch = random.uniform(-25.0, -10.0) # head hanging down
            f_prob = random.uniform(0.80, 0.96)
            lvl = "CRITICAL"
            
            # Log critical event
            cursor.execute("INSERT INTO system_logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)",
                           (fat_time, "CRITICAL", "AI_PIPELINE", f"Operator Fatigue Alert for {op}! Fatigue Prob: {f_prob:.2f}"))
        elif prob > 0.80: # Warning fatigue
            ear = random.uniform(0.17, 0.21)
            mar = random.uniform(0.45, 0.68)
            perclos = random.uniform(0.08, 0.14)
            yawns = random.randint(1, 2)
            pitch = random.uniform(-15.0, 5.0)
            f_prob = random.uniform(0.40, 0.79)
            lvl = "WARNING"
        else: # Normal operator
            ear = random.uniform(0.24, 0.32)
            mar = random.uniform(0.10, 0.35)
            perclos = random.uniform(0.01, 0.07)
            yawns = 0
            pitch = random.uniform(-5.0, 10.0)
            f_prob = random.uniform(0.02, 0.35)
            lvl = "NORMAL"

        cursor.execute("""
            INSERT INTO fatigue_logs 
            (timestamp, operator_name, ear, mar, perclos, yawn_count, head_pitch, fatigue_probability, alert_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (fat_time, op, ear, mar, perclos, yawns, pitch, f_prob, lvl))

    # 4. Seed PPE Violations
    ppe_violations = [
        ("W-004", 1, 0, 0, 0), # missing helmet
        ("W-012", 0, 1, 0, 0), # missing vest
        ("W-005", 1, 1, 0, 0), # missing helmet & vest
        ("W-002", 0, 0, 1, 0), # missing gloves
        ("W-007", 1, 0, 0, 1), # missing helmet & boots
        ("W-004", 0, 1, 0, 0), # missing vest
        ("W-012", 1, 0, 0, 0), # missing helmet
        ("W-005", 0, 1, 0, 0)  # missing vest
    ]

    for w_id, h, v, g, b in ppe_violations:
        day_offset = random.randint(0, 6)
        hour_offset = random.randint(8, 17)
        min_offset = random.randint(0, 59)
        violation_time = (now - timedelta(days=day_offset)).replace(hour=hour_offset, minute=min_offset).isoformat()
        
        conf = random.uniform(0.85, 0.98)
        cursor.execute("""
            INSERT INTO ppe_violations 
            (timestamp, worker_id, missing_helmet, missing_vest, missing_gloves, missing_boots, detection_confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (violation_time, w_id, h, v, g, b, conf))

        # Log warning log
        missing_items = []
        if h: missing_items.append("Helmet")
        if v: missing_items.append("Vest")
        if g: missing_items.append("Gloves")
        if b: missing_items.append("Boots")
        
        log_msg = f"PPE Violation: Worker {w_id} missing {', '.join(missing_items)}."
        cursor.execute("INSERT INTO system_logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)",
                       (violation_time, "WARNING", "AI_PIPELINE", log_msg))

if __name__ == "__main__":
    init_db()
