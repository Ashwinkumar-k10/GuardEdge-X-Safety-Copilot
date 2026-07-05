import os
import time
import math
import random
import json
import sqlite3
import threading
import numpy as np
import cv2
from datetime import datetime
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS

from database import init_db, get_db_connection, DB_PATH
from ai_pipeline import (
    GuardEdgeTracker, OperatorFatiguePredictor, GestureRecognizer,
    calculate_safety_bubble, CollisionPredictor
)
from hardware_interface import HardwareController

app = Flask(__name__)
CORS(app) # Enable CORS for React frontend

# Initialize hardware & components
hardware = HardwareController()
tracker = GuardEdgeTracker()
fatigue_predictor = OperatorFatiguePredictor()
gesture_rec = GestureRecognizer()
collision_predictor = CollisionPredictor()

# State variables (Global simulation state)
state_lock = threading.Lock()
grace_period_until = 0.0
telemetry_data = {
    "machinery_id": "CAT-320D-01",
    "machinery_type": "Hydraulic Excavator",
    "operator_name": "Rajesh Kumar",
    "safety_score": 98.0,
    "fatigue_score": 0.05,
    "worker_count": 0,
    "rpm": 1850,
    "speed": 1.2, # m/s
    "boom_angle": 42.0, # degrees
    "bucket_height": 1.8, # meters
    "current_task": "Trenching and Excavation",
    "collision_countdown": 99.0,
    "near_miss_counter": 12,
    "estop_active": False,
    "ppe_compliance_rate": 100.0,
    "active_gesture": "NO_HAND",
    "weather_temp": 32.5,
    "weather_condition": "Dusty / Dry",
    
    # System health
    "gpu_usage": 14.5, # Emulated NPU/GPU
    "cpu_usage": 42.0,
    "ram_usage": 3.1, # GB
    "system_temp": 52.0, # Celsius (Raspberry Pi 5 CPU temp)
    "storage_free": 18.2, # GB
    "radar_status": "ACTIVE_TRACK",
    "ultrasonic_status": "ONLINE",
    
    # Safety zones
    "safety_bubble_radius": 3.0,
    "alert_level": "NORMAL" # NORMAL, WARNING, CRITICAL
}

# Worker trajectory simulation variables
sim_workers = [
    {"id": "W-004", "x": 0.0, "y": 10.0, "vx": 0.0, "vy": -0.8, "helmet": True, "vest": True, "active": True}, # walks straight towards machine
    {"id": "W-012", "x": -6.0, "y": 7.0, "vx": 0.6, "vy": -0.2, "helmet": True, "vest": False, "active": True}, # walks left-to-right, missing vest
    {"id": "W-005", "x": 5.0, "y": 12.0, "vx": -0.3, "vy": -0.4, "helmet": False, "vest": True, "active": True} # walks diagonal, missing helmet
]

operator_face_state = {
    "eye_closed": False,
    "yawn_active": False,
    "head_down": False,
    "ear": 0.28,
    "mar": 0.15,
    "pitch": 0.0
}

# Webcam capture variables
webcam_frame = None
webcam_lock = threading.Lock()
webcam_active = False

def camera_capture_loop():
    global webcam_frame, webcam_active
    print("Starting webcam capture loop...")
    cap = cv2.VideoCapture(0)
    if cap.isOpened():
        webcam_active = True
        print("[CAMERA] Live webcam detected and bound successfully.")
    else:
        print("[CAMERA] No live webcam detected. Operating in simulated mode.")
        webcam_active = False
        return

    while True:
        ret, frame = cap.read()
        if ret:
            with webcam_lock:
                webcam_frame = frame.copy()
        time.sleep(0.033) # cap at ~30 FPS

# =====================================================================
# Telemetry and Tracking Simulation Loop
# =====================================================================
def run_simulation_loop():
    global telemetry_data, sim_workers, operator_face_state, grace_period_until
    
    # Init DB on startup
    init_db()
    
    # Time constants
    dt = 0.1
    tick = 0
    
    while True:
        time.sleep(dt)
        tick += 1
        
        with state_lock:
            # 1. Skip simulation updates if E-Stop is active
            if telemetry_data["estop_active"]:
                telemetry_data["speed"] = 0.0
                telemetry_data["rpm"] = 800 # Idle speed
                telemetry_data["alert_level"] = "CRITICAL"
                hardware.set_relay(True)
                hardware.set_led("red", True)
                # Sound buzzer in fast alarm pulses
                hardware.set_buzzer(tick % 2 == 0)
                continue
            
            # Reset hardware triggers
            hardware.set_relay(False)
            
            # 2. Simulate operator fatigue states (cyclical logic every 60s)
            cycle_phase = (tick % 600) / 10.0 # 0 to 60 seconds
            
            if 40.0 <= cycle_phase < 48.0:
                # Yawning phase
                operator_face_state["yawn_active"] = True
                operator_face_state["mar"] = 0.75 + 0.1 * math.sin(cycle_phase)
                operator_face_state["pitch"] = -5.0
            else:
                operator_face_state["yawn_active"] = False
                operator_face_state["mar"] = 0.15 + 0.05 * math.sin(cycle_phase)

            if 50.0 <= cycle_phase < 55.0:
                # Microsleep phase
                operator_face_state["eye_closed"] = True
                operator_face_state["ear"] = 0.10 + 0.03 * math.sin(cycle_phase)
                operator_face_state["pitch"] = -25.0 - 5.0 * (cycle_phase - 50.0) # head drop
            else:
                operator_face_state["eye_closed"] = False
                operator_face_state["ear"] = 0.28 + 0.02 * math.cos(cycle_phase)
                operator_face_state["pitch"] = 2.0 + 3.0 * math.sin(cycle_phase * 0.5)

            # Process fatigue ML engine
            fat_res = fatigue_predictor.process_telemetry(
                operator_face_state["ear"],
                operator_face_state["mar"],
                operator_face_state["pitch"]
            )
            telemetry_data["fatigue_score"] = fat_res["fatigue_probability"]
            
            # If critical fatigue is predicted, trigger alarm but not physical engine cut-off unless collision is imminent
            if fat_res["alert_level"] == "CRITICAL":
                telemetry_data["alert_level"] = "WARNING"
                hardware.set_led("orange", True)
                hardware.set_buzzer(tick % 4 == 0)
                # Log to DB periodically
                if tick % 50 == 0:
                    log_event("CRITICAL", "AI_PIPELINE", f"Operator Fatigue Alert! Fatigue Score: {fat_res['fatigue_probability']:.2f}")

            # 3. Simulate Ground Worker Trajectories
            detections = []
            ppe_statuses = []
            for w in sim_workers:
                if not w["active"]:
                    continue
                # Update positions
                w["x"] += w["vx"] * dt
                w["y"] += w["vy"] * dt
                
                # Bounding boxes simulated in pixel coordinates mapping:
                # We map worksite coordinates (x, y) meters to pixel coords (W=640, H=480)
                # Machine is centered at (x=0, y=0) which corresponds to bottom center (320, 480)
                # Ground scale: 1 meter = 40 pixels
                px = int(320 + w["x"] * 40)
                py = int(400 - w["y"] * 40)
                
                # Bounding box size gets larger as worker gets closer (lower y)
                box_w = int(240 / max(w["y"], 1.0))
                box_h = int(480 / max(w["y"], 1.0))
                
                x1 = px - box_w // 2
                y1 = py - box_h
                x2 = px + box_w // 2
                y2 = py
                
                detections.append([x1, y1, x2, y2])
                ppe_statuses.append({"helmet": w["helmet"], "vest": w["vest"]})

            # Update Tracker (DeepSORT Centroid Filter)
            tracks = tracker.update(detections, ppe_statuses)
            telemetry_data["worker_count"] = len(tracks)
            
            # Compile active worker coordinate list for Digital Twin
            workers_coords = []
            for w in sim_workers:
                if w["active"]:
                    workers_coords.append({
                        "id": w["id"],
                        "x": round(w["x"], 2),
                        "y": round(w["y"], 2),
                        "helmet": w["helmet"],
                        "vest": w["vest"]
                    })
            telemetry_data["workers"] = workers_coords
            telemetry_data["worker_distance"] = round(sim_workers[0]["y"], 1)
            
            # Read telemetry parameters (RPM, boom angles) with small jitter
            telemetry_data["rpm"] = int(1850 + 40 * math.sin(tick * 0.1) + random.randint(-10, 10))
            telemetry_data["boom_angle"] = round(42.0 + 1.5 * math.sin(tick * 0.05), 1)
            telemetry_data["bucket_height"] = round(1.8 + 0.3 * math.cos(tick * 0.07), 2)
            
            # Fetch Safety Bubble limits
            bubble = calculate_safety_bubble(telemetry_data["speed"])
            telemetry_data["safety_bubble_radius"] = bubble["warning_radius"]
            
            # 4. Predict Collision Trajectories
            coll_res = collision_predictor.predict_collision(
                machine_speed=telemetry_data["speed"],
                machine_pos=(0, 0),
                machine_heading=90.0, # machinery moving straight up along y-axis
                worker_tracks=tracks,
                safety_bubble_radius=bubble["warning_radius"]
            )
            
            # 5. Process E-Stop Intervention
            if time.time() < grace_period_until:
                telemetry_data["collision_countdown"] = 99.0
                if fat_res["alert_level"] != "CRITICAL":
                    telemetry_data["alert_level"] = "NORMAL"
                    hardware.set_led("red", False)
                    hardware.set_led("orange", False)
                    hardware.set_buzzer(False)
            elif coll_res["collision_warning"]:
                telemetry_data["collision_countdown"] = round(coll_res["time_to_collision"], 1)
                
                # Check impact limits
                if coll_res["time_to_collision"] <= 1.0: # Impact imminent!
                    telemetry_data["estop_active"] = True
                    telemetry_data["alert_level"] = "CRITICAL"
                    log_collision_incident(coll_res["colliding_worker_id"], tracks)
                elif coll_res["time_to_collision"] <= 2.2: # High Warning
                    telemetry_data["alert_level"] = "CRITICAL"
                    hardware.set_led("red", True)
                    hardware.set_buzzer(True)
                else: # Low Warning
                    telemetry_data["alert_level"] = "WARNING"
                    hardware.set_led("orange", True)
                    hardware.set_buzzer(tick % 4 == 0)
            else:
                telemetry_data["collision_countdown"] = 99.0
                if fat_res["alert_level"] != "CRITICAL":
                    telemetry_data["alert_level"] = "NORMAL"
                    hardware.set_led("red", False)
                    hardware.set_led("orange", False)
                    hardware.set_buzzer(False)
            
            # Reset worker position when they wander too close and trigger E-Stop, or reset manually
            # We handle reset in the reset endpoint.
            
            # Update safety score dynamically based on active alerts and PPE compliance
            violations = sum(1 for w in sim_workers if w["active"] and (not w["helmet"] or not w["vest"]))
            active_workers = sum(1 for w in sim_workers if w["active"])
            compliance = 100.0
            if active_workers > 0:
                compliance = round((1.0 - (violations / (active_workers * 2.0))) * 100.0, 1)
            telemetry_data["ppe_compliance_rate"] = compliance
            
            # Calculate rolling safety score
            score_deduction = 0
            if telemetry_data["alert_level"] == "CRITICAL":
                score_deduction += 15
            elif telemetry_data["alert_level"] == "WARNING":
                score_deduction += 5
            score_deduction += (100.0 - compliance) * 0.1
            
            telemetry_data["safety_score"] = max(round(100.0 - score_deduction, 1), 50.0)

            # System resource metrics jitter
            telemetry_data["cpu_usage"] = round(42.0 + 3.0 * math.sin(tick * 0.2) + random.uniform(-1, 1), 1)
            telemetry_data["ram_usage"] = round(3.1 + 0.05 * math.cos(tick * 0.02), 2)
            telemetry_data["system_temp"] = round(52.0 + 0.8 * math.sin(tick * 0.05) + random.uniform(-0.2, 0.2), 1)

# Helper function to write logs to SQLite
def log_event(level, source, message):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO system_logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)",
                       (datetime.now().isoformat(), level, source, message))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging to DB: {e}")

# Helper to log collision near-misses
def log_collision_incident(worker_track_id, tracks):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Increment near miss counter in state
        telemetry_data["near_miss_counter"] += 1
        
        # Get colliding track details
        t = tracks.get(worker_track_id)
        min_dist = 1.1
        rel_speed = 0.8
        if t:
            # Estimate coordinates distance
            tx = t.kf.x[0, 0]
            ty = t.kf.x[1, 0]
            min_dist = float(np.sqrt(tx**2 + ty**2))
            rel_speed = float(t.velocity)

        cursor.execute("""
            INSERT INTO near_misses 
            (timestamp, machinery_id, operator_name, worker_id, min_distance, relative_speed, trajectory_intersection, action_taken, video_replay_path) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            telemetry_data["machinery_id"],
            telemetry_data["operator_name"],
            f"W-00{worker_track_id}",
            min_dist,
            rel_speed,
            "TRUE",
            "E_STOP_ACTUATED",
            f"/replays/critical_near_miss_{telemetry_data['near_miss_counter']}.mp4"
        ))
        
        # Log to system log as well
        cursor.execute("INSERT INTO system_logs (timestamp, level, source, message) VALUES (?, ?, ?, ?)",
                       (datetime.now().isoformat(), "CRITICAL", "AI_PIPELINE", 
                        f"EMERGENCY INTERVENTION: Physical ignition relay triggered. Worker W-00{worker_track_id} trajectory collision predicted in <1.0s."))
        
        conn.commit()
        conn.close()
        print("Logged near-miss incident to SQLite database.")
    except Exception as e:
        print(f"Error logging incident: {e}")

# =====================================================================
# Video Overlay Renderer (OpenCV Frame Generators)
# =====================================================================

def generate_worksite_feed():
    """Generates OpenCV worksite camera frames with live webcam OR tracking overlays."""
    warning_color = (0, 165, 255) # Orange (BGR)
    danger_color = (0, 0, 255) # Red
    safe_color = (0, 255, 0) # Green
    grid_color = (33, 43, 56) # Deep Slate Grey
    
    # Load Haar cascade for person/face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    tick = 0
    while True:
        tick += 1
        
        global webcam_frame, webcam_active
        live_frame = None
        if webcam_active:
            with webcam_lock:
                if webcam_frame is not None:
                    live_frame = webcam_frame.copy()
                    
        if live_frame is not None:
            # Resize for consistent display
            live_frame = cv2.resize(live_frame, (640, 480))
            gray = cv2.cvtColor(live_frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            # Hand Gesture Detection (Skin Color Segmentation & Contour Analysis)
            hsv = cv2.cvtColor(live_frame, cv2.COLOR_BGR2HSV)
            # Standard skin color range in HSV
            lower_skin = np.array([0, 15, 60], dtype=np.uint8)
            upper_skin = np.array([20, 150, 255], dtype=np.uint8)
            skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
            
            kernel = np.ones((3, 3), np.uint8)
            skin_mask = cv2.dilate(skin_mask, kernel, iterations=2)
            skin_mask = cv2.GaussianBlur(skin_mask, (5, 5), 100)
            
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            
            gesture = "NO_HAND"
            if len(contours) > 0:
                contours = sorted(contours, key=cv2.contourArea, reverse=True)
                hand_contour = None
                for cnt in contours:
                    area = cv2.contourArea(cnt)
                    if area < 3000 or area > 60000:
                        continue
                    
                    x, y, w, h = cv2.boundingRect(cnt)
                    is_face = False
                    for (fx, fy, fw, fh) in faces:
                        if not (x + w < fx or x > fx + fw or y + h < fy or y > fy + fh):
                            is_face = True
                            break
                    if not is_face:
                        hand_contour = cnt
                        break
                
                if hand_contour is not None:
                    x, y, w, h = cv2.boundingRect(hand_contour)
                    cv2.rectangle(live_frame, (x, y), (x + w, y + h), (0, 242, 254), 1)
                    
                    hull = cv2.convexHull(hand_contour, returnPoints=False)
                    defects = cv2.convexityDefects(hand_contour, hull)
                    
                    finger_count = 0
                    if defects is not None:
                        for i in range(defects.shape[0]):
                            s, e, f, d = defects[i, 0]
                            start = tuple(hand_contour[s][0])
                            end = tuple(hand_contour[e][0])
                            far = tuple(hand_contour[f][0])
                            
                            a = math.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
                            b = math.sqrt((far[0] - start[0])**2 + (far[1] - start[1])**2)
                            c = math.sqrt((end[0] - far[0])**2 + (end[1] - far[1])**2)
                            
                            angle = math.acos(max(min((b**2 + c**2 - a**2) / (2 * b * c + 1e-6), 1.0), -1.0)) * 57.29
                            
                            if angle < 85 and d > 3000:
                                finger_count += 1
                                cv2.circle(live_frame, far, 4, (0, 0, 255), -1)
                    
                    if finger_count >= 3:
                        gesture = "STOP"
                    elif finger_count == 0 or finger_count == 1:
                        if h > w * 1.1:
                            gesture = "THUMBS_UP"
                        else:
                            gesture = "NO_HAND"
                    
                    cv2.putText(live_frame, f"GESTURE: {gesture}", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 242, 254), 1, cv2.LINE_AA)
            
            with state_lock:
                telemetry_data["active_gesture"] = gesture
                if gesture == "STOP":
                    telemetry_data["estop_active"] = True
                    telemetry_data["alert_level"] = "CRITICAL"
            
            with state_lock:
                estop = telemetry_data["estop_active"]
                alert = telemetry_data["alert_level"]
                speed = telemetry_data["speed"]
                bubble = calculate_safety_bubble(speed)
                
                # Map bubble radius from meters to pixels (1m = 40px)
                r_warn = int(bubble["warning_radius"] * 40)
                r_dang = int(bubble["danger_radius"] * 40)
                
                # Draw Safety zones as AR overlays on webcam feed
                cv2.ellipse(live_frame, (320, 480), (r_warn, r_warn), 0, 180, 360, warning_color if alert != "NORMAL" else safe_color, 2)
                cv2.ellipse(live_frame, (320, 480), (r_dang, r_dang), 0, 180, 360, danger_color, 2)
                
                # Machinery representation overlay at bottom
                cv2.rectangle(live_frame, (280, 440), (360, 480), (12, 107, 255), -1)
                cv2.rectangle(live_frame, (280, 440), (360, 480), (255, 255, 255), 1)
                cv2.putText(live_frame, "CAT MACHINE", (286, 465), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)

            if len(faces) > 0:
                # Sort by bounding box size (closest person first)
                faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
                (x, y, w, h) = faces[0]
                
                # Estimate distance: height of 100 pixels is ~2 meters
                dist_est = min(max(200.0 / h, 0.5), 15.0)
                
                # Update simulated worker W-004 coordinates to mirror the webcam detection!
                with state_lock:
                    sim_workers[0]["active"] = True
                    sim_workers[0]["x"] = (x + w/2 - 320) / 40.0
                    sim_workers[0]["y"] = dist_est
                    sim_workers[0]["vx"] = 0.0
                    sim_workers[0]["vy"] = -0.4 if dist_est > 1.2 else 0.0
                
                # Choose color based on safety zones
                box_color = safe_color
                if dist_est < bubble["danger_radius"]:
                    box_color = danger_color
                elif dist_est < bubble["warning_radius"]:
                    box_color = warning_color
                    
                # Draw bounding box representing YOLOv8 Person detection
                cv2.rectangle(live_frame, (x, y), (x + w, y + h), box_color, 2)
                
                # Labels
                cv2.putText(live_frame, f"Worker: W-004 | Dist: {dist_est:.1f}m", (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.45, box_color, 1, cv2.LINE_AA)
                cv2.putText(live_frame, "[H: OK]", (x + 5, y + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.35, safe_color, 1)
                cv2.putText(live_frame, "[V: OK]", (x + 5, y + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.35, safe_color, 1)
                
                # Draw Kalman velocity vectors
                cv2.line(live_frame, (x + w//2, y + h), (320, 480), (100, 100, 100), 1, cv2.LINE_AA)
            else:
                # If no one is in front of the camera, let the simulator run naturally
                pass

            # HUD text overlays
            cv2.putText(live_frame, "WORKSITE LIVE CAMERA - YOLOv8 + RADAR FUSION", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(live_frame, f"BUBBLE LIMIT: {bubble['warning_radius']:.1f}m", (15, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.4, warning_color if alert != "NORMAL" else safe_color, 1)
            cv2.putText(live_frame, "SYSTEM STATUS: CAMERA ONLINE", (15, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 242, 254), 1)

            # Flashing alarm overlay on E-Stop
            with state_lock:
                estop_active = telemetry_data["estop_active"]
            if estop_active:
                overlay = live_frame.copy()
                cv2.rectangle(overlay, (0, 0), (640, 480), (0, 0, 255), -1)
                alpha = 0.25 + 0.15 * math.sin(tick * 0.8)
                cv2.addWeighted(overlay, alpha, live_frame, 1 - alpha, 0, live_frame)
                
                # E-STOP TEXT
                cv2.rectangle(live_frame, (160, 200), (480, 280), (0, 0, 0), -1)
                cv2.rectangle(live_frame, (160, 200), (480, 280), danger_color, 3)
                cv2.putText(live_frame, "CRITICAL EMERGENCY STOP", (182, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, danger_color, 2)
                cv2.putText(live_frame, "IGNITION SOLENOID RELAY ACTUATED", (178, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

            frame_to_send = live_frame
        else:
            # Fallback to simulated render (high-fidelity graphics)
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            frame[:] = (26, 15, 9) # Deep slate bg #090F1A (BGR: 26, 15, 9)

            # Draw radar sweep grid lines
            for r in range(50, 450, 100):
                cv2.ellipse(frame, (320, 480), (r, r), 0, 180, 360, grid_color, 1)
                cv2.putText(frame, f"{r // 40}m", (320 + r + 5, 475), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (80, 80, 80), 1)

            # Draw grid radial lines
            for angle in range(210, 340, 30):
                rad = np.radians(angle)
                ex = int(320 + 400 * np.cos(rad))
                ey = int(480 + 400 * np.sin(rad))
                cv2.line(frame, (320, 480), (ex, ey), grid_color, 1)

            with state_lock:
                estop = telemetry_data["estop_active"]
                alert = telemetry_data["alert_level"]
                speed = telemetry_data["speed"]
                bubble = calculate_safety_bubble(speed)
                
                r_warn = int(bubble["warning_radius"] * 40)
                r_dang = int(bubble["danger_radius"] * 40)
                
                cv2.ellipse(frame, (320, 480), (r_warn, r_warn), 0, 180, 360, warning_color if alert != "NORMAL" else safe_color, 2)
                cv2.ellipse(frame, (320, 480), (r_dang, r_dang), 0, 180, 360, danger_color, 2)
                
                cv2.rectangle(frame, (280, 430), (360, 480), (12, 107, 255), -1)
                cv2.rectangle(frame, (280, 430), (360, 480), (255, 255, 255), 1)
                cv2.rectangle(frame, (270, 410), (280, 480), (50, 50, 50), -1)
                cv2.rectangle(frame, (360, 410), (370, 480), (50, 50, 50), -1)
                cv2.putText(frame, "CAT EXCAVATOR", (283, 455), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)

                for w in sim_workers:
                    if not w["active"]:
                        continue
                    px = int(320 + w["x"] * 40)
                    py = int(480 - w["y"] * 40)
                    
                    box_w = int(220 / max(w["y"], 1.0))
                    box_h = int(440 / max(w["y"], 1.0))
                    
                    x1 = px - box_w // 2
                    y1 = py - box_h
                    x2 = px + box_w // 2
                    y2 = py
                    
                    dist = np.sqrt(w["x"]**2 + w["y"]**2)
                    
                    color = safe_color
                    if dist < bubble["danger_radius"]:
                        color = danger_color
                    elif dist < bubble["warning_radius"]:
                        color = warning_color
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    label = f"Worker: {w['id']} | Dist: {dist:.1f}m"
                    cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1, cv2.LINE_AA)
                    
                    tag_y = y1 + 15
                    if w["helmet"]:
                        cv2.putText(frame, "[H: OK]", (x1 + 5, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, safe_color, 1)
                    else:
                        cv2.putText(frame, "[NO-HELMET]", (x1 + 5, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, danger_color, 1)
                    
                    tag_y += 15
                    if w["vest"]:
                        cv2.putText(frame, "[V: OK]", (x1 + 5, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, safe_color, 1)
                    else:
                        cv2.putText(frame, "[NO-VEST]", (x1 + 5, tag_y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, danger_color, 1)

                    steps = 15
                    fx, fy = px, py
                    for _ in range(steps):
                        n_fx = fx + int(w["vx"] * 4.0)
                        n_fy = fy - int(w["vy"] * 4.0)
                        cv2.line(frame, (fx, fy), (n_fx, n_fy), (0, 242, 254), 1, cv2.LINE_AA)
                        fx, fy = n_fx, n_fy
                    
                    cv2.line(frame, (320, 480), (px, py), (100, 100, 100), 1, cv2.LINE_AA)

            cv2.putText(frame, "WORKSITE REAR CAMERA - YOLOv8 + RADAR FUSION", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(frame, f"BUBBLE RADIUS: {bubble['warning_radius']:.1f}m", (15, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.4, warning_color if alert != "NORMAL" else safe_color, 1)
            cv2.putText(frame, f"MACHINE SPEED: {speed:.1f} m/s", (15, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

            if estop:
                overlay = frame.copy()
                cv2.rectangle(overlay, (0, 0), (640, 480), (0, 0, 255), -1)
                alpha = 0.25 + 0.15 * math.sin(tick * 0.8)
                cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
                
                cv2.rectangle(frame, (160, 200), (480, 280), (0, 0, 0), -1)
                cv2.rectangle(frame, (160, 200), (480, 280), danger_color, 3)
                cv2.putText(frame, "CRITICAL EMERGENCY STOP", (182, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, danger_color, 2)
                cv2.putText(frame, "IGNITION CUT - RELAY ACTUATED", (195, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

            frame_to_send = frame

        ret, jpeg = cv2.imencode('.jpg', frame_to_send)
        if not ret:
            continue
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        time.sleep(0.066)


def generate_operator_feed():
    """Generates OpenCV operator cabin camera frames (infrared simulation + face tracking)."""
    text_color = (0, 242, 254) # Cyan (BGR: 254, 242, 0)
    warning_color = (0, 165, 255) # Orange
    danger_color = (0, 0, 255) # Red
    mesh_color = (254, 242, 0) # Ice Blue/Cyan dots
    safe_color = (0, 255, 0) # Green
    
    # Load face and eye Haar cascades
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
    
    while True:
        global webcam_frame, webcam_active
        live_frame = None
        if webcam_active:
            with webcam_lock:
                if webcam_frame is not None:
                    live_frame = webcam_frame.copy()
                    
        if live_frame is not None:
            # Grayscale for face detection
            live_frame = cv2.resize(live_frame, (640, 480))
            gray = cv2.cvtColor(live_frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            # Infrared camera styling (grayscale BGR with cold blue overlay tint)
            gray_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
            blue_tint = np.zeros_like(gray_bgr)
            blue_tint[:] = (20, 10, 5) # subtle cool cyan tint
            live_frame = cv2.addWeighted(gray_bgr, 0.9, blue_tint, 0.1, 0)
            
            # Scanlines overlay
            for y in range(0, 480, 4):
                cv2.line(live_frame, (0, y), (640, y), (30, 30, 30), 1)

            eye_closed = False
            yawn_active = False
            ear = 0.28
            mar = 0.15
            pitch = 2.0
            
            if len(faces) > 0:
                # Focus on operator's face
                faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
                (cx, cy, cw, ch) = faces[0]
                
                # Draw MediaPipe-like face mesh dots
                face_cx = cx + cw // 2
                face_cy = cy + ch // 2
                cv2.circle(live_frame, (face_cx, face_cy), 2, mesh_color, -1) # nose
                cv2.circle(live_frame, (face_cx, face_cy - ch//8), 2, mesh_color, -1) # nose bridge
                cv2.circle(live_frame, (face_cx, face_cy + ch//6), 2, mesh_color, -1) # mouth top
                cv2.circle(live_frame, (face_cx, face_cy + ch//4), 2, mesh_color, -1) # chin
                
                # Outer facial contour dots
                for i in range(12):
                    ang = i * (360 / 12)
                    rad = np.radians(ang)
                    dx = int(face_cx + (cw//2.2) * np.cos(rad))
                    dy = int(face_cy + (ch//1.8) * np.sin(rad))
                    cv2.circle(live_frame, (dx, dy), 2, mesh_color, -1)
                
                # Draw box around face
                cv2.rectangle(live_frame, (cx, cy), (cx + cw, cy + ch), (120, 120, 120), 1)
                
                # Detect eyes inside face area (upper half ROI)
                eye_roi = gray[cy:cy + int(ch*0.65), cx:cx + cw]
                eyes = eye_cascade.detectMultiScale(eye_roi, 1.15, 3)
                
                if len(eyes) < 2:
                    # If eyes are closed (not detected), drop EAR and log fatigue
                    ear = 0.08
                    eye_closed = True
                    cv2.putText(live_frame, "EYES CLOSED", (face_cx - 50, cy - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, danger_color, 1)
                    
                    # Highlight closed eyes area in red
                    cv2.line(live_frame, (face_cx - cw//4 - 10, face_cy - ch//8), (face_cx - cw//4 + 10, face_cy - ch//8), danger_color, 2)
                    cv2.line(live_frame, (face_cx + cw//4 - 10, face_cy - ch//8), (face_cx + cw//4 + 10, face_cy - ch//8), danger_color, 2)
                else:
                    ear = 0.28
                    cv2.ellipse(live_frame, (face_cx - cw//4, face_cy - ch//8), (12, 6), 0, 0, 360, mesh_color, 1)
                    cv2.ellipse(live_frame, (face_cx + cw//4, face_cy - ch//8), (12, 6), 0, 0, 360, mesh_color, 1)
                    cv2.circle(live_frame, (face_cx - cw//4, face_cy - ch//8), 2, (255, 255, 255), -1)
                    cv2.circle(live_frame, (face_cx + cw//4, face_cy - ch//8), 2, (255, 255, 255), -1)

                pitch = round((face_cy - 240) / 8.0, 1)
                with state_lock:
                    operator_face_state["eye_closed"] = eye_closed
                    operator_face_state["ear"] = ear
                    operator_face_state["pitch"] = pitch
            else:
                # Grayscale webcam is online but operator is out-of-frame
                pass

            # HUD text overlays
            with state_lock:
                fatigue_prob = telemetry_data["fatigue_score"]
                op_name = telemetry_data["operator_name"]

            cv2.putText(live_frame, "OPERATOR LIVE FEED - IR CABIN COMPACT SENSOR", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(live_frame, f"OPERATOR: {op_name.upper()}", (15, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
            cv2.putText(live_frame, f"EYE ASPECT RATIO (EAR): {ear:.3f}", (15, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.4, danger_color if eye_closed else (255, 255, 255), 1)
            cv2.putText(live_frame, f"HEAD PITCH: {pitch:.1f} DEG", (15, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.4, danger_color if pitch < -20 else (255, 255, 255), 1)

            # Fatigue Probability Gauge
            cv2.rectangle(live_frame, (15, 430), (200, 450), (60, 60, 60), -1)
            fill_w = int(fatigue_prob * 185)
            gauge_color = safe_color
            if fatigue_prob > 0.75:
                gauge_color = danger_color
            elif fatigue_prob > 0.45:
                gauge_color = warning_color
            cv2.rectangle(live_frame, (15, 430), (15 + fill_w, 450), gauge_color, -1)
            cv2.putText(live_frame, f"FATIGUE RISK: {int(fatigue_prob * 100)}%", (15, 420), cv2.FONT_HERSHEY_SIMPLEX, 0.4, gauge_color, 1)

            frame_to_send = live_frame
        else:
            # Fallback Operator Simulation render
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            frame[:] = (40, 40, 40) # Grayscale IR feed bg

            # Add simulated IR scanline noise
            for y in range(0, 480, 4):
                cv2.line(frame, (0, y), (640, y), (43, 43, 43), 1)

            with state_lock:
                eye_closed = operator_face_state["eye_closed"]
                yawn_active = operator_face_state["yawn_active"]
                ear = operator_face_state["ear"]
                mar = operator_face_state["mar"]
                pitch = operator_face_state["pitch"]
                fatigue_prob = telemetry_data["fatigue_score"]
                op_name = telemetry_data["operator_name"]

                cx, cy = 320, 240
                y_shift = int(-pitch * 2.0)
                head_cy = cy + y_shift
                cv2.ellipse(frame, (cx, head_cy), (100, 140), 0, 0, 360, (100, 100, 100), 2)
                
                lex, ley = cx - 40, head_cy - 30
                rex, rey = cx + 40, head_cy - 30
                
                if eye_closed:
                    cv2.line(frame, (lex - 15, ley), (lex + 15, ley), danger_color, 2)
                    cv2.line(frame, (rex - 15, rey), (rex + 15, rey), danger_color, 2)
                    cv2.putText(frame, "EYES CLOSED", (cx - 50, head_cy - 60), cv2.FONT_HERSHEY_SIMPLEX, 0.4, danger_color, 1)
                else:
                    cv2.ellipse(frame, (lex, ley), (15, 8), 0, 0, 360, mesh_color, 1)
                    cv2.ellipse(frame, (rex, rey), (15, 8), 0, 0, 360, mesh_color, 1)
                    cv2.circle(frame, (lex, ley), 3, (255, 255, 255), -1)
                    cv2.circle(frame, (rex, rey), 3, (255, 255, 255), -1)

                mouth_cy = head_cy + 50
                if yawn_active:
                    cv2.ellipse(frame, (cx, mouth_cy), (15, int(mar * 40)), 0, 0, 360, warning_color, 2)
                    cv2.putText(frame, "YAWNING DETECTED", (cx - 65, head_cy + 105), cv2.FONT_HERSHEY_SIMPLEX, 0.4, warning_color, 1)
                else:
                    cv2.ellipse(frame, (cx, mouth_cy), (20, 5), 0, 0, 180, mesh_color, 1)

                for i in range(12):
                    ang = i * (360 / 12)
                    rad = np.radians(ang)
                    dx = int(cx + 80 * np.cos(rad))
                    dy = int(head_cy + 110 * np.sin(rad))
                    cv2.circle(frame, (dx, dy), 2, mesh_color, -1)
                
                cv2.circle(frame, (cx, head_cy), 2, mesh_color, -1)
                cv2.circle(frame, (cx, head_cy + 15), 2, mesh_color, -1)
                cv2.circle(frame, (cx, head_cy + 30), 2, mesh_color, -1)

            cv2.putText(frame, "OPERATOR MONITORED FEED - IR CABIN SENSOR", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(frame, f"OPERATOR: {op_name.upper()}", (15, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
            cv2.putText(frame, f"EYE ASPECT RATIO (EAR): {ear:.3f}", (15, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.4, danger_color if eye_closed else (255, 255, 255), 1)
            cv2.putText(frame, f"MOUTH ASPECT RATIO (MAR): {mar:.3f}", (15, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.4, warning_color if yawn_active else (255, 255, 255), 1)
            cv2.putText(frame, f"HEAD PITCH: {pitch:.1f} DEG", (15, 115), cv2.FONT_HERSHEY_SIMPLEX, 0.4, danger_color if pitch < -20 else (255, 255, 255), 1)

            cv2.rectangle(frame, (15, 430), (200, 450), (60, 60, 60), -1)
            fill_w = int(fatigue_prob * 185)
            gauge_color = safe_color
            if fatigue_prob > 0.75:
                gauge_color = danger_color
            elif fatigue_prob > 0.45:
                gauge_color = warning_color
            cv2.rectangle(frame, (15, 430), (15 + fill_w, 450), gauge_color, -1)
            cv2.putText(frame, f"FATIGUE RISK: {int(fatigue_prob * 100)}%", (15, 420), cv2.FONT_HERSHEY_SIMPLEX, 0.4, gauge_color, 1)

            frame_to_send = frame

        ret, jpeg = cv2.imencode('.jpg', frame_to_send)
        if not ret:
            continue
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        time.sleep(0.066)

# =====================================================================
# REST Endpoints & Data APIs
# =====================================================================

@app.route('/video_feed/worksite')
def video_feed_worksite():
    return Response(generate_worksite_feed(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/video_feed/operator')
def video_feed_operator():
    return Response(generate_operator_feed(), mimetype='multipart/x-mixed-replace; boundary=frame')

# Telemetry Server-Sent Events (SSE) stream
@app.route('/telemetry')
def telemetry():
    def event_stream():
        while True:
            with state_lock:
                json_data = json.dumps(telemetry_data)
            yield f"data: {json_data}\n\n"
            time.sleep(0.2) # push updates 5 times a second
    return Response(event_stream(), mimetype="text/event-stream")

# System manual E-Stop trigger
@app.route('/api/estop/trigger', methods=['POST'])
def trigger_estop():
    with state_lock:
        telemetry_data["estop_active"] = True
        telemetry_data["alert_level"] = "CRITICAL"
        telemetry_data["speed"] = 0.0
        
    hardware.set_relay(True)
    hardware.set_led("red", True)
    hardware.set_led("orange", False)
    hardware.set_buzzer(True)
    
    log_event("CRITICAL", "GPIO_CONTROLLER", "Manual cabin emergency stop switch activated by operator.")
    return jsonify({"success": True, "message": "Emergency stop relay triggered successfully."})

# System manual E-Stop reset
@app.route('/api/estop/reset', methods=['POST'])
def reset_estop():
    global sim_workers, grace_period_until
    with state_lock:
        telemetry_data["estop_active"] = False
        telemetry_data["alert_level"] = "NORMAL"
        telemetry_data["speed"] = 1.2
        telemetry_data["rpm"] = 1850
        telemetry_data["collision_countdown"] = 99.0
        
        # Reset the simulated worker positions to safe distance
        sim_workers[0]["x"] = 0.0
        sim_workers[0]["y"] = 10.0
        sim_workers[1]["x"] = -6.0
        sim_workers[1]["y"] = 7.0
        sim_workers[2]["x"] = 5.0
        sim_workers[2]["y"] = 12.0
        
    hardware.set_relay(False)
    hardware.set_led("red", False)
    hardware.set_led("orange", False)
    hardware.set_buzzer(False)
    
    # Set grace period to 5 seconds from now
    grace_period_until = time.time() + 5.0
    
    log_event("INFO", "SYSTEM", "Safety override system reset. Solenoid relay released. Resuming normal operations.")
    return jsonify({"success": True, "message": "E-Stop reset, machine ignition solenoid released."})

# Simulated SAE J1939 CAN Bus telemetry logger
@app.route('/api/can_bus')
def get_can_bus_logs():
    can_ids = ["0x18FEEE00", "0x18FEF600", "0x18FEEF00", "0x0CF00400", "0x18FEF500"]
    can_names = ["Engine Temp", "Particulate Filter", "Hydraulic Pressure", "Electronic Engine Controller", "Ambient Conditions"]
    frames = []
    for _ in range(12):
        can_id = random.choice(can_ids)
        idx = can_ids.index(can_id)
        name = can_names[idx]
        data = " ".join([f"0x{random.randint(0, 255):02X}" for _ in range(8)])
        frames.append({
            "timestamp": datetime.now().isoformat(),
            "pgn": can_id,
            "name": name,
            "data": data,
            "channel": "CAN0"
        })
    return jsonify(frames)

# Settings fetch & update
@app.route('/api/settings', methods=['GET', 'POST'])
def settings_handler():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        for k, v in data.items():
            cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, str(v)))
            
            # Apply dynamic changes instantly to hardware thresholds
            if k == "estop_relay_enabled":
                pass # can toggle physical triggers
            if k == "safety_bubble_base_radius":
                with state_lock:
                    telemetry_data["safety_bubble_radius"] = float(v)
        conn.commit()
        log_event("INFO", "SYSTEM", "Safety thresholds and parameters updated in system settings.")
        
    # GET settings
    cursor.execute("SELECT * FROM settings")
    settings = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return jsonify(settings)

# Incidents logs for Near-Miss charts
@app.route('/api/near_misses')
def near_misses():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM near_misses ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "machinery_id": r["machinery_id"],
            "operator_name": r["operator_name"],
            "worker_id": r["worker_id"],
            "min_distance": r["min_distance"],
            "relative_speed": r["relative_speed"],
            "trajectory_intersection": r["trajectory_intersection"],
            "action_taken": r["action_taken"],
            "video_replay_path": r["video_replay_path"]
        })
    return jsonify(result)

# Incidents logs for Fatigue charts
@app.route('/api/fatigue_history')
def fatigue_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM fatigue_logs ORDER BY timestamp DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "operator_name": r["operator_name"],
            "ear": r["ear"],
            "mar": r["mar"],
            "perclos": r["perclos"],
            "yawn_count": r["yawn_count"],
            "head_pitch": r["head_pitch"],
            "fatigue_probability": r["fatigue_probability"],
            "alert_level": r["alert_level"]
        })
    return jsonify(result)

# Incidents logs for PPE compliance charts
@app.route('/api/ppe_history')
def ppe_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ppe_violations ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "worker_id": r["worker_id"],
            "missing_helmet": r["missing_helmet"],
            "missing_vest": r["missing_vest"],
            "missing_gloves": r["missing_gloves"],
            "missing_boots": r["missing_boots"],
            "detection_confidence": r["detection_confidence"]
        })
    return jsonify(result)

# Fetch system logs
@app.route('/api/logs')
def get_logs():
    q = request.args.get('q', '')
    level = request.args.get('level', '')
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM system_logs WHERE 1=1"
    params = []
    
    if q:
        query += " AND (message LIKE ? OR source LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%"])
    if level:
        query += " AND level = ?"
        params.append(level)
        
    query += " ORDER BY timestamp DESC LIMIT 200"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "timestamp": r["timestamp"],
            "level": r["level"],
            "source": r["source"],
            "message": r["message"]
        })
    return jsonify(result)

# Simulate generation of industrial safety report
@app.route('/api/report')
def generate_report():
    # Simple simulated report download
    # Write a plain text CSV report simulating industrial safety metrics
    report_content = "GuardEdge X - Industrial Safety Audit Report\n"
    report_content += f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    report_content += "Machinery ID: CAT-320D-01\n"
    report_content += "-----------------------------------------------\n"
    report_content += "METRIC, VALUE, COMPLIANCE STATUS\n"
    report_content += f"Active Safety Score, {telemetry_data['safety_score']}%, COMPLIANT\n"
    report_content += f"PPE Compliance Rate, {telemetry_data['ppe_compliance_rate']}%, IMPROVEMENT NEEDED\n"
    report_content += f"Total Near-Misses Blocked, {telemetry_data['near_miss_counter']}, SAFE INTERVENTIONS\n"
    
    report_path = os.path.join(os.path.dirname(__file__), "guardedge_x_safety_report.txt")
    with open(report_path, "w") as f:
        f.write(report_content)
        
    return send_file(report_path, as_attachment=True, download_name="guardedge_x_safety_report.txt")

if __name__ == "__main__":
    # Start the simulation updater background thread
    sim_thread = threading.Thread(target=run_simulation_loop, daemon=True)
    sim_thread.start()
    
    # Start the webcam capture background thread
    cam_thread = threading.Thread(target=camera_capture_loop, daemon=True)
    cam_thread.start()
    
    # Run server on port 5000
    print("Starting GuardEdge X Flask Backend Server on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
