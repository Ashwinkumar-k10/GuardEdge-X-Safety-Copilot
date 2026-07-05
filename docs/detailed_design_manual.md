# GuardEdge X: Comprehensive Systems Engineering & Detailed Design Manual
**System Version:** v1.0.4  
**Date:** July 2026  
**Classification:** Technical Documentation / InnoVent 2026 Project Submission  

---

## 1. Executive Summary & Design Philosophy
GuardEdge X is an edge-native, real-time safety copilot designed to solve the critical hazard of human-machinery contact in rugged industrial environments (e.g. open-cast mines, heavy infrastructure projects, and tunneling excavations).

The core design philosophy is built on **absolute local dependency**:
* **Zero Cloud Latency:** All neural network inference, sensor polling, coordinate filtering, and mechanical relays run entirely offline on a localized **Raspberry Pi 5 (8GB)**.
* **Proactive Override Actuation:** Instead of relying solely on operator alarms—which are often ignored due to auditory fatigue—GuardEdge X utilizes a direct physical solenoid bypass to isolate engine starter lines and cut machine motion in critical danger states (TTC < 1.0s).
* **Multi-Modal Redundancy:** Optical camera tracks (vulnerable to glare, dust, and darkness) are fused with 24GHz mmWave radar velocities (insensitive to environmental noise) to guarantee reliable trajectory tracking 24/7.

---

## 2. Theoretical Framework & Mathematical Formulations

### 2.1 Multi-Sensor Extended Kalman Filter (EKF) Proximity Fusion
To resolve spatial coordinates of nearby workers ($W_i$), the system fuses camera bounding box angles with radar range values.

Let the state vector of a tracked worker at time $t$ be:
$$x_t = \begin{bmatrix} x & y & v_x & v_y \end{bmatrix}^T$$
where:
* $x, y$ represent the relative coordinate distance of the target from the machine cab center.
* $v_x, v_y$ represent the relative velocity vectors of the target.

#### 1. State Transition Model
The state transitions linearly according to:
$$x_t = F x_{t-1} + w_t, \quad w_t \sim \mathcal{N}(0, Q)$$
$$F = \begin{bmatrix} 1 & 0 & \Delta t & 0 \\ 0 & 1 & 0 & \Delta t \\ 0 & 0 & 1 & 0 \\ 0 & 0 & 0 & 1 \end{bmatrix}$$
where $\Delta t$ is the polling interval ($\approx 33\text{ms}$ at 30 FPS).

#### 2. Non-Linear Measurement Update
The camera provides bearing angle $\theta$ and approximate bounding box width $w_{box}$, while the mmWave radar provides radial distance $r$ and radial velocity $\dot{r}$. The measurement vector $z_t$ is:
$$z_t = \begin{bmatrix} r \\ \theta \\ \dot{r} \end{bmatrix}$$
The non-linear measurement mapping function $h(x_t)$ is:
$$h(x_t) = \begin{bmatrix} \sqrt{x^2 + y^2} \\ \arctan2(y, x) \\ \frac{x v_x + y v_y}{\sqrt{x^2 + y^2}} \end{bmatrix}$$

We calculate the Jacobian of the measurement function $H_j$:
$$H_j = \frac{\partial h(x_t)}{\partial x_t} = \begin{bmatrix} \frac{x}{\sqrt{x^2+y^2}} & \frac{y}{\sqrt{x^2+y^2}} & 0 & 0 \\ -\frac{y}{x^2+y^2} & \frac{x}{x^2+y^2} & 0 & 0 \\ \frac{v_x(x^2+y^2) - x(xv_x+yv_y)}{(x^2+y^2)^{1.5}} & \frac{v_y(x^2+y^2) - y(xv_x+yv_y)}{(x^2+y^2)^{1.5}} & \frac{x}{\sqrt{x^2+y^2}} & \frac{y}{\sqrt{x^2+y^2}} \end{bmatrix}$$

Applying EKF prediction and updates:
$$\text{Innovation: } y_t = z_t - h(x_{t|t-1})$$
$$\text{Gain: } K_t = P_{t|t-1} H_j^T (H_j P_{t|t-1} H_j^T + R)^{-1}$$
$$\text{Updated State: } x_{t|t} = x_{t|t-1} + K_t y_t$$
This ensures smooth tracking logs even when the optical target is temporarily obscured by exhaust smoke or dust.

---

### 2.2 Physics-Based Dynamic Safety Bubble
Rather than drawing static radial boundaries, the guard envelope ($R_{bubble}$) dynamically expands and contracts to maintain a constant Safety Margin:

$$R_{bubble} = R_{base} + d_{latency} + d_{braking}$$

1. **Static Margin ($R_{base}$):** The physical clearance distance of the cabin bumper ($\approx 3.0$ meters).
2. **Reaction Latency Distance ($d_{latency}$):** Takes into account system latency (AI pipeline latency $t_{npu} \approx 10\text{ms}$ + relay actuation time $t_{relay} \approx 20\text{ms}$ + operator braking reaction latency $t_{human} \approx 500\text{ms}$):
   $$d_{latency} = v_{machine} \times (t_{npu} + t_{relay} + t_{human})$$
3. **Deceleration Distance ($d_{braking}$):** The physical distance needed for the vehicle's hydraulic system to bring it to a complete stop from its current speed ($v_{machine}$) under constant maximum deceleration ($a_{max} \approx 4.0\text{ m/s}^2$):
   $$d_{braking} = \frac{v_{machine}^2}{2 \cdot a_{max}}$$

Combining these expressions:
$$R_{bubble} = R_{base} + v_{machine} \cdot t_{total} + \frac{v_{machine}^2}{2 a_{max}}$$

* **At Rest ($v = 0$):** $R_{bubble} = R_{base} = 3.0\text{m}$
* **Nominal Operating Speed ($v = 2.0\text{ m/s}$):** $R_{bubble} = 3.0 + (2.0 \times 0.53) + \frac{4.0}{8.0} = 4.56\text{m}$

---

### 2.3 Operator Attention & Fatigue Analysis (PERCLOS)
The facial landmark tracker extracts the spatial positions of the operator's eyelids and lips to calculate fatigue coefficients:

#### 1. Eye Aspect Ratio (EAR)
Defined by the relative vertical and horizontal coordinates of the eyelids:
$$EAR = \frac{||p_2 - p_6|| + ||p_3 - p_5||}{2 \cdot ||p_1 - p_4||}$$
* When eyes are wide open, $EAR \approx 0.30$.
* When eyes close, $EAR$ drops below $0.20$.

#### 2. Mouth Aspect Ratio (MAR)
Detects yawning:
$$MAR = \frac{||m_2 - m_8|| + ||m_3 - m_7|| + ||m_4 - m_6||}{2 \cdot ||m_1 - m_5||}$$
* Under standard conditions, $MAR < 0.20$.
* During yawning, $MAR$ surges to $>0.60$.

#### 3. PERCLOS (Percentage of Eye Closure)
Evaluated over a rolling 1-minute window:
$$\text{PERCLOS} = \frac{\sum T_{EAR < 0.20}}{60.0} \times 100\%$$
If the PERCLOS index exceeds **40%**, the system classifies the operator state as **MICRO-SLEEP** and engages the cabin siren.

---

## 3. Core Software Component & Thread Architecture
The Python backend (`app.py`) runs as a multi-threaded processing server to ensure concurrent sensor polling without thread blocking:

```text
+-----------------------------------------------------------------------+
|                       CORE PROCESS: Flask App                          |
+-----------------------------------------------------------------------+
        |                  |                 |                  |
        v                  v                 v                  v
+--------------+   +---------------+   +------------+   +---------------+
|   Thread 1   |   |   Thread 2    |   |  Thread 3  |   |   Thread 4    |
| Operator Cam |   | Worksite Cam  |   | mmWave Ser |   |  GPIO Controller|
| (120 FPS IR) |   | (Sony IMX219) |   | (SEN0395)  |   | (Relay Actuator)|
+--------------+   +---------------+   +------------+   +---------------+
        |                  |                 |                  |
        +--------+---------+--------+--------+                  |
                 |                  |                           |
                 v                  v                           |
        +-----------------+ +---------------+                   |
        |  AI Pipeline    | | Kalman Filter |                   |
        | (ONNX YOLO/MP)  | |  (Coordinates)|                   |
        +-----------------+ +---------------+                   |
                 |                  |                           |
                 +--------+---------+                           |
                          v                                     v
                 +------------------+                   +---------------+
                 |  telemetry_data  |<==================| physical relay|
                 | (Global Dict)    | (Write safety status)| BCM PIN 18    |
                 +------------------+                   +---------------+
```

### Thread Descriptions & Isolation
1. **Operator Cam Thread:** Constantly captures infrared frames from the cabin camera. It performs MediaPipe Face Mesh processing, extracts eye coordinates, and runs EAR/PERCLOS calculations.
2. **Worksite Cam Thread:** Captures wide-angle worksite video. It runs YOLOv8-nano PPE bounding-box inference, associates worker tracking IDs via DeepSORT, and estimates angular bearing.
3. **mmWave Serial Thread:** Polls proximity measurements via a UART link from the mmWave radar at 115200 bps. Updates raw target distance records.
4. **GPIO Controller Thread:** Operates the physical Raspberry Pi GPIO pins. It monitors global safety alarm flags. If `alert_level == "CRITICAL"`, it drives BCM Pin 18 high to open the ignition relay.

---

## 4. Hardware Electrical Schematics
The prototype features isolated circuits to protect the edge computer from electrical spikes common in heavy machinery electrical harnesses.

### 4.1 Pi 5 Connection Pinout

```text
Raspberry Pi 5 Pinout Header:
+---------------------------------------------+
| [3.3V] [5V]   [5V]---------------------------[ VCC to Optocoupler Relay ]
| [GPIO2] (SDA) [5V]
| [GPIO3] (SCL) [GND]--------------------------[ GND to Common Sensor Ground ]
| [GPIO4]       [GPIO14] (TX)------------------[ RX of mmWave Radar ]
| [GND]         [GPIO15] (RX)------------------[ TX of mmWave Radar ]
| [GPIO17]-------------------------------------[ Signal of Warning Buzzer ]
| [GPIO18]-------------------------------------[ Signal of E-Stop Actuator ]
| [GND]         [GPIO23]
+---------------------------------------------+
```

### 4.2 Power Isolation Architecture
Excavator alternators introduce substantial ripple and voltage surges ($\approx 12\text{V}$ up to $40\text{V}$ load dump transients). To maintain system stability, the power supply is isolated:

```text
[ 12V Lead-Acid Engine Battery ]
               |
               v
  [ Automotive Transient Clamp ]  (Surge protection up to 60V)
               |
               v
 [ High-Efficiency Buck Regulator ] (Linear Technology LT1374, step-down to 5.1V / 5A)
               |
               v
      [ LC Pi-Filter ]            (Filters high-frequency engine noise)
               |
               v
   [ USB-C Power Interface ] ===> [ Raspberry Pi 5 Core Board ]
```

---

## 5. Testing & Verification Guide

To perform hardware and software verification of the pipeline, follow these standard operational test patterns:

### 5.1 Diagnostic Calibration Routine
1. **Camera Calibration:** Position the Worksites wide-angle camera at a height of 2.2 meters pointing downwards at a $15^\circ$ tilt. Run `python app.py` and verify that the optical center maps accurately.
2. **mmWave Threshold Setting:** Ensure that static obstacles (e.g. walls) are within the mmWave sensor's path. Adjust the radar sensitivity command string via serial:
   * Send `setLatency 50` to maintain responsive range tracking.
   * Send `setRange 15` to limit the active radar sensor sweep.

### 5.2 Failure Mode Simulation Tests

| Test ID | Simulated Failure | Expected System Reaction | Actuator Output |
|:---|:---|:---|:---|
| **TS-001** | Bounding box lost (Camera glare/dust block) | System shifts tracking dependency entirely to UART mmWave Radar. Proximity is maintained. | **NOMINAL RUN** |
| **TS-002** | Worker proximity reaches `<1.5` meters | Safety bubble breached. State transitions immediately to `CRITICAL`. | **PIN 18 HIGH (E-STOP)** |
| **TS-003** | Operator closes eyes for `>3.0` seconds | PERCLOS limits breached. Drowsiness alert is flagged. | **PIN 17 PWM ACTIVE (SIREN)** |
| **TS-004** | Ground worker holds up open palm gesture | Hand Gesture stops recognized. Actuator triggers emergency override. | **PIN 18 HIGH (E-STOP)** |
