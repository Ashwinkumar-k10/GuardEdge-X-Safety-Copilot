import numpy as np
import time
import cv2

# =====================================================================
# 1. Kalman Filter for Trajectory Tracking
# =====================================================================
class KalmanFilter2D:
    def __init__(self, dt=0.1, process_noise=0.1, measurement_noise=0.2):
        self.dt = dt
        # State vector: [x, y, vx, vy]^T
        self.x = np.zeros((4, 1), dtype=np.float32)
        
        # State Transition Matrix A
        self.A = np.array([
            [1, 0, dt,  0],
            [0, 1,  0, dt],
            [0, 0,  1,  0],
            [0, 0,  0,  1]
        ], dtype=np.float32)
        
        # Measurement Matrix H (we only measure position x, y)
        self.H = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float32)
        
        # Process Noise Covariance Q
        self.Q = np.eye(4, dtype=np.float32) * process_noise
        
        # Measurement Noise Covariance R
        self.R = np.eye(2, dtype=np.float32) * measurement_noise
        
        # Error Covariance Matrix P
        self.P = np.eye(4, dtype=np.float32) * 1.0

    def predict(self):
        # x_k = A * x_{k-1}
        self.x = np.dot(self.A, self.x)
        # P_k = A * P_{k-1} * A^T + Q
        self.P = np.dot(np.dot(self.A, self.P), self.A.T) + self.Q
        return self.x

    def update(self, z):
        # z is measurement [mx, my]^T
        z = np.array(z, dtype=np.float32).reshape(2, 1)
        
        # Innovation y = z - H * x_k
        y = z - np.dot(self.H, self.x)
        
        # Innovation Covariance S = H * P_k * H^T + R
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        
        # Kalman Gain K = P_k * H^T * S^-1
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))
        
        # Updated state x = x_k + K * y
        self.x = self.x + np.dot(K, y)
        
        # Updated Covariance P = (I - K * H) * P_k
        I = np.eye(4, dtype=np.float32)
        self.P = np.dot(I - np.dot(K, self.H), self.P)
        return self.x

    def predict_future(self, steps):
        """Predicts coordinates n steps into the future."""
        future_x = self.x.copy()
        for _ in range(steps):
            future_x = np.dot(self.A, future_x)
        return float(future_x[0, 0]), float(future_x[1, 0])


# =====================================================================
# 2. Centroid & Trajectory Tracker (DeepSORT-lite)
# =====================================================================
class GuardTrack:
    def __init__(self, track_id, centroid, bbox):
        self.track_id = track_id
        self.kf = KalmanFilter2D(dt=0.1)
        self.kf.x[0, 0] = centroid[0]
        self.kf.x[1, 0] = centroid[1]
        self.bbox = bbox
        self.frames_without_detection = 0
        self.trajectory = [centroid] # History of positions
        self.distance = 0.0 # meters from machine
        self.velocity = 0.0 # m/s
        self.ppe_status = {"helmet": True, "vest": True}

    def update(self, centroid, bbox, ppe_status=None):
        prev_pos = (self.kf.x[0, 0], self.kf.x[1, 0])
        self.kf.update(centroid)
        self.bbox = bbox
        self.frames_without_detection = 0
        current_pos = (self.kf.x[0, 0], self.kf.x[1, 0])
        
        # Calculate velocity: distance moved / dt (dt = 0.1s)
        dist_moved = np.sqrt((current_pos[0]-prev_pos[0])**2 + (current_pos[1]-prev_pos[1])**2)
        self.velocity = dist_moved / 0.1
        self.trajectory.append(current_pos)
        if len(self.trajectory) > 30:
            self.trajectory.pop(0)

        if ppe_status:
            self.ppe_status = ppe_status


class GuardEdgeTracker:
    def __init__(self, max_lost_frames=10):
        self.tracks = {}
        self.next_track_id = 1
        self.max_lost_frames = max_lost_frames

    def update(self, detections, ppe_statuses=None):
        """
        detections: list of bounding boxes [x1, y1, x2, y2]
        ppe_statuses: list of dicts {"helmet": bool, "vest": bool} corresponding to boxes
        """
        centroids = []
        for bbox in detections:
            cx = (bbox[0] + bbox[2]) / 2.0
            cy = (bbox[1] + bbox[3]) / 2.0
            centroids.append((cx, cy))

        # Predict existing tracks
        for track in self.tracks.values():
            track.kf.predict()
            track.frames_without_detection += 1

        unmatched_detections = list(range(len(centroids)))
        unmatched_tracks = list(self.tracks.keys())

        # Simple Euclidean Distance Matcher
        if len(centroids) > 0 and len(self.tracks) > 0:
            dist_matrix = np.zeros((len(centroids), len(self.tracks)), dtype=np.float32)
            track_ids = list(self.tracks.keys())
            
            for d_idx, c in enumerate(centroids):
                for t_idx, t_id in enumerate(track_ids):
                    t_x = self.tracks[t_id].kf.x[0, 0]
                    t_y = self.tracks[t_id].kf.y = self.tracks[t_id].kf.x[1, 0]
                    dist_matrix[d_idx, t_idx] = np.sqrt((c[0]-t_x)**2 + (c[1]-t_y)**2)

            # Match greedily
            for _ in range(min(len(centroids), len(self.tracks))):
                min_idx = np.unravel_index(np.argmin(dist_matrix), dist_matrix.shape)
                d_val = dist_matrix[min_idx]
                
                # Match threshold (e.g. max 80 pixels distance movement per frame)
                if d_val < 80:
                    det_idx = min_idx[0]
                    t_idx = min_idx[1]
                    t_id = track_ids[t_idx]
                    
                    ppe_st = ppe_statuses[det_idx] if ppe_statuses else None
                    self.tracks[t_id].update(centroids[det_idx], detections[det_idx], ppe_st)
                    
                    if det_idx in unmatched_detections:
                        unmatched_detections.remove(det_idx)
                    if t_id in unmatched_tracks:
                        unmatched_tracks.remove(t_id)
                        
                    # Set matched values to infinity in distance matrix
                    dist_matrix[det_idx, :] = np.inf
                    dist_matrix[:, t_idx] = np.inf
                else:
                    break

        # Register new tracks
        for det_idx in unmatched_detections:
            ppe_st = ppe_statuses[det_idx] if ppe_statuses else {"helmet": True, "vest": True}
            new_track = GuardTrack(self.next_track_id, centroids[det_idx], detections[det_idx])
            new_track.ppe_status = ppe_st
            self.tracks[self.next_track_id] = new_track
            self.next_track_id += 1

        # Delete expired tracks
        for t_id in unmatched_tracks:
            if self.tracks[t_id].frames_without_detection > self.max_lost_frames:
                del self.tracks[t_id]

        return self.tracks


# =====================================================================
# 3. Fatigue Predictor (Random Forest Mock Pipeline)
# =====================================================================
class OperatorFatiguePredictor:
    def __init__(self, ear_threshold=0.20, mar_threshold=0.60):
        self.ear_threshold = ear_threshold
        self.mar_threshold = mar_threshold
        self.ear_history = []
        self.yawn_timer = 0
        self.yawn_count = 0
        self.perclos_window_size = 300 # 30 seconds at 10Hz
        self.perclos_buffer = []

    def process_telemetry(self, ear, mar, head_pitch):
        """
        ear: Eye Aspect Ratio
        mar: Mouth Aspect Ratio
        head_pitch: pitch angle in degrees (negative is looking down)
        """
        # 1. Update PERCLOS buffer
        is_closed = 1 if ear < self.ear_threshold else 0
        self.perclos_buffer.append(is_closed)
        if len(self.perclos_buffer) > self.perclos_window_size:
            self.perclos_buffer.pop(0)

        perclos = sum(self.perclos_buffer) / len(self.perclos_buffer) if self.perclos_buffer else 0.0

        # 2. Count Yawns
        if mar > self.mar_threshold:
            if self.yawn_timer == 0:
                self.yawn_timer = time.time()
        else:
            if self.yawn_timer > 0:
                yawn_duration = time.time() - self.yawn_timer
                if yawn_duration > 1.5: # Yawning longer than 1.5 seconds
                    self.yawn_count += 1
                self.yawn_timer = 0

        # 3. Random Forest Emulated Decision tree logic
        # High PERCLOS + high yawn count + head hanging down = high probability of fatigue
        feat_vector = np.array([ear, mar, perclos, self.yawn_count, head_pitch])
        
        # Emulating Random Forest decision nodes:
        prob = 0.05
        # Tree 1: EAR based
        if ear < 0.18: prob += 0.25
        if ear < 0.14: prob += 0.15
        
        # Tree 2: PERCLOS based
        if perclos > 0.10: prob += 0.20
        if perclos > 0.20: prob += 0.15
        
        # Tree 3: Yawning based
        if self.yawn_count > 0: prob += 0.10
        if self.yawn_count > 3: prob += 0.15
        
        # Tree 4: Head Pitch based
        if head_pitch < -15.0: prob += 0.20 # looking down (nodding off)
        if head_pitch < -25.0: prob += 0.15

        # Normalize probability
        prob = min(max(prob, 0.01), 0.99)
        
        alert_level = "NORMAL"
        if prob > 0.75:
            alert_level = "CRITICAL"
        elif prob > 0.45:
            alert_level = "WARNING"

        return {
            "ear": float(ear),
            "mar": float(mar),
            "perclos": float(perclos),
            "yawn_count": int(self.yawn_count),
            "head_pitch": float(head_pitch),
            "fatigue_probability": float(prob),
            "alert_level": alert_level
        }


# =====================================================================
# 4. Hand Gesture Command Recognition
# =====================================================================
class GestureRecognizer:
    def __init__(self):
        self.gesture_history = []

    def recognize_gesture(self, landmarks):
        """
        landmarks: dict of keypoint names to coordinates, or None.
        If None, returns "NO_HAND".
        """
        if not landmarks:
            return "NO_HAND"
            
        # Mock logic matching hand landmark angles:
        # e.g., fingers: [thumb, index, middle, ring, pinky] represented as True (open) / False (closed)
        fingers_open = landmarks.get("fingers_open", [True, True, True, True, True])
        thumb_direction = landmarks.get("thumb_direction", "UP") # UP, DOWN, LEFT, RIGHT

        if all(fingers_open):
            return "STOP" # Flat palm up
        elif not any(fingers_open[1:]) and thumb_direction == "UP":
            return "SAFE" # Thumbs up
        elif not any(fingers_open[1:]) and thumb_direction == "DOWN":
            return "UNSAFE" # Thumbs down
        elif fingers_open[1] and fingers_open[2] and not any(fingers_open[3:]):
            return "SLOW DOWN" # Peace sign
        elif fingers_open[1] and not any(fingers_open[2:]) and thumb_direction == "RIGHT":
            return "MOVE RIGHT" # Pointing right
        elif fingers_open[1] and not any(fingers_open[2:]) and thumb_direction == "LEFT":
            return "MOVE LEFT" # Pointing left
        
        return "UNKNOWN"


# =====================================================================
# 5. Dynamic Safety Bubble Calculator
# =====================================================================
def calculate_safety_bubble(machine_speed, base_radius=3.0, reaction_time=0.5, braking_decel=4.0):
    """
    machine_speed: speed in m/s
    base_radius: static buffer (meters)
    reaction_time: reaction latency (seconds)
    braking_decel: machine deceleration capacity (m/s^2)
    """
    # R = R_base + v * t + v^2 / 2a
    braking_dist = (machine_speed ** 2) / (2 * braking_decel)
    reaction_dist = machine_speed * reaction_time
    total_radius = base_radius + reaction_dist + braking_dist
    return {
        "base_radius": float(base_radius),
        "warning_radius": float(total_radius),
        "danger_radius": float(base_radius + reaction_dist * 0.5 + braking_dist * 0.3)
    }


# =====================================================================
# 6. Collision Predictor (Kalman Trajectory Intersector)
# =====================================================================
class CollisionPredictor:
    def __init__(self, time_horizon=3.0, dt=0.1):
        self.time_horizon = time_horizon
        self.dt = dt

    def predict_collision(self, machine_speed, machine_pos, machine_heading, worker_tracks, safety_bubble_radius):
        """
        machine_pos: (mx, my) in meters
        machine_heading: angle in degrees
        worker_tracks: dict of GuardTrack objects
        safety_bubble_radius: float (danger threshold)
        """
        collision_warning = False
        time_to_collision = 99.0
        colliding_worker_id = None
        predicted_points = {}

        # Machine trajectory simulation (assuming constant velocity along heading)
        mx, my = machine_pos
        rad_heading = np.radians(machine_heading)
        mvx = machine_speed * np.cos(rad_heading)
        mvy = machine_speed * np.sin(rad_heading)

        steps = int(self.time_horizon / self.dt)

        for track_id, track in worker_tracks.items():
            worker_points = []
            
            # Predict worker future positions
            wx = track.kf.x[0, 0]
            wy = track.kf.x[1, 0]
            wvx = track.kf.x[2, 0]
            wvy = track.kf.x[3, 0]
            
            collision_detected = False
            collision_step = -1

            for step in range(steps):
                t = step * self.dt
                # Machine future pos at t
                mt_x = mx + mvx * t
                mt_y = my + mvy * t
                
                # Worker future pos at t (constant velocity prediction from Kalman Filter)
                wt_x = wx + wvx * t
                wt_y = wy + wvy * t
                
                worker_points.append((wt_x, wt_y))
                
                # Distance at time t
                dist_t = np.sqrt((mt_x - wt_x)**2 + (mt_y - wt_y)**2)
                
                if dist_t < safety_bubble_radius and not collision_detected:
                    collision_detected = True
                    collision_step = step
                    
            predicted_points[track_id] = worker_points

            if collision_detected:
                ttc = collision_step * self.dt
                if ttc < time_to_collision:
                    time_to_collision = ttc
                    colliding_worker_id = track_id
                    collision_warning = True

        return {
            "collision_warning": collision_warning,
            "time_to_collision": float(time_to_collision) if collision_warning else 99.0,
            "colliding_worker_id": colliding_worker_id,
            "predicted_trajectories": predicted_points
        }
