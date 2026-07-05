# GuardEdge X Demo Video Storyboard
## Title: GuardEdge X - Predictive Edge AI Safety Copilot for Heavy Machinery
**Target Duration:** 5–7 Minutes  
**Target Audience:** Tata Technologies InnoVent 2026 Judges / Industrial Safety Evaluators  
**Style/Vibe:** High-energy, cinematic, tech-driven, professional, industrial (Caterpillar/Tesla/Bosch-style branding).  

---

## Scene Timeline & Overview

| Scene | Duration | Title | Core Visual Focus |
| :--- | :--- | :--- | :--- |
| **Scene 1** | 0:00 - 0:45 | **The Industrial Blindspot** | B-Roll of massive excavators, dusty environments, and collision stats. |
| **Scene 2** | 0:45 - 1:30 | **Introducing GuardEdge X** | The physical hardware setup and offline Edge AI RPi5 architecture. |
| **Scene 3** | 1:30 - 2:30 | **Operator Fatigue Copilot** | Facial mesh mapping, micro-sleep detection, and fatigue metrics. |
| **Scene 4** | 2:30 - 3:45 | **Worksite Worker & PPE Fusion** | YOLOv8 tracking, distance sensors, radar fusion, and PPE compliance. |
| **Scene 5** | 3:45 - 4:45 | **Dynamic Bubble & E-Stop** | Top-down radar view, Kalman trajectory intersection, and relay cut-off. |
| **Scene 6** | 4:45 - 5:45 | **Control HMI & Digital Twin** | Full walk-through of the 15-page dashboard and analytics panel. |
| **Scene 7** | 5:45 - 6:30 | **Commercial Readiness** | Summary of safety score ROI, offline reliability, and closing pitch. |

---

## Scene Details

### Scene 1: The Industrial Blindspot (0:00 – 0:45)
* **Camera Angle:** Wide panning shots of a dusty construction site with heavy machinery. Extreme close-ups of excavator tracks and massive buckets.
* **UI/Visual Overlay:** Subtle, red semi-transparent text graphics: *"Heavy Machinery Accidents: 40% of all site fatalities"* and *"Blind Spots & Operator Fatigue: The Silent Killers"*.
* **Narration:**  
  *"On heavy industrial worksites, size is the ultimate hazard. Excavators, loaders, and haul trucks operate in blinding dust, darkness, and rain. Operators face long shifts, driving fatigue to critical levels. Passive mirrors and basic alarm beepers are no longer enough. We need a system that predicts danger before it strikes."*
* **BGM/Sound Effects:** Low, ominous low-frequency synth drone, fading into heavy machinery engine rumbles.
* **Transition:** Fade to white-hot camera flash, transitioning into a dark lab environment.

---

### Scene 2: Introducing GuardEdge X (0:45 – 1:30)
* **Camera Angle:** Overhead shot of an electronics lab bench. The camera slowly zooms in on a sleek, industrial-cased Raspberry Pi 5 wired to CSI cameras, a 24GHz mmWave radar module, and an emergency stop relay.
* **UI/Visual Overlay:** Glowing blue callout text labels pointing to each component (RPi 5, mmWave Radar, CSI Wide Angle, 5V E-Stop Relay).
* **Narration:**  
  *"Introducing GuardEdge X: The offline Edge AI copilot for predictive safety. Operating entirely on a single Raspberry Pi 5 with zero cloud dependencies and sub-100 millisecond latency, GuardEdge X merges optical cameras, mmWave radar, and ultrasonic rangefinders to build a 360-degree predictive safety bubble around the machine."*
* **BGM/Sound Effects:** Rhythmic, upbeat electronic synth track starts playing, representing high-tech innovation.
* **Transition:** Wipe right to the Operator Cabin view.

---

### Scene 3: Operator Fatigue Copilot (1:30 – 2:30)
* **Camera Angle:** Split-screen. Left side: The operator inside a dark simulator cabin wearing safety gear. Right side: The operator monitoring dashboard in the HMI showing the live infrared feed with facial landmarks mapped.
* **UI/Visual Overlay:** Real-time data overlay on the camera feed showing:
  - **EAR:** 0.28 (Normal) &rarr; 0.15 (Eyes closed)
  - **MAR:** Yawn detected!
  - **Fatigue Probability:** 85% [CRITICAL]
  - Head pose mesh shifting downwards.
* **Narration:**  
  *"Inside the cabin, an infrared camera monitors the operator. GuardEdge X extracts facial landmarks using MediaPipe Face Mesh to calculate the Eye Aspect Ratio and Mouth Aspect Ratio. It tracks PERCLOS—eye closure percentage—and head tilt angle. When our local Random Forest model predicts a high probability of fatigue or microsleep, a cabin warning is immediately triggered."*
* **BGM/Sound Effects:** A double beep warning sound plays as the "YAWN DETECTED" banner flashes on the cabin dashboard.
* **Transition:** Smooth zoom in on the HMI screen, sliding to the worksite view.

---

### Scene 4: Worksite Worker & PPE Fusion (2:30 – 3:45)
* **Camera Angle:** First-person view of the worksite camera mounted on the rear of the excavator. Workers are walking in the background. The scene is slightly dusty.
* **UI/Visual Overlay:**
  - Glowing bounding boxes around workers (e.g., `Worker ID: #004`, `Distance: 5.4m`, `Speed: 1.2m/s`).
  - Green tag labels for `Helmet` and `Vest`, or red flashing tag labels for `NO-VEST` or `NO-HELMET`.
  - An overlay of the mmWave radar sweep showing a green arc that tightens as a worker gets closer.
* **Narration:**  
  *"Looking outward, GuardEdge X runs a CPU-quantized YOLOv8 object detection model on ONNX Runtime to identify ground personnel and verify personal protective equipment, such as helmets and high-visibility vests. By fusing camera coordinates with mmWave radar telemetry using an Extended Kalman Filter, we maintain high-precision tracking even in dense dust or low light where cameras are blinded."*
* **BGM/Sound Effects:** Cybernetic tracking sounds, digital lock-on click when worker is identified.
* **Transition:** Dynamic slide left, revealing the top-down safety bubble map.

---

### Scene 5: Dynamic Bubble & E-Stop Intervention (3:45 – 4:45)
* **Camera Angle:** Wide third-person view showing a real worker walking behind a moving excavator. A second camera angle shows the 5V relay module on a breadboard.
* **UI/Visual Overlay:**
  - An animated top-down radar view showing the excavator at the center.
  - A glowing blue safe zone, a yellow warning zone, and an orange danger bubble that expands as the excavator speeds up.
  - A worker's dot moving toward the danger bubble.
  - Collision Countdown ticker: `TTC: 2.1s` &rarr; `TTC: 0.9s` &rarr; `COLLISION IMMINENT!`
  - Flashing fullscreen alert: `EMERGENCY STOP RELAY TRIGGERED`.
* **Narration:**  
  *"The copilot calculates a dynamic safety bubble that expands based on the machine's speed. Using a Kalman trajectory filter, GuardEdge X predicts the paths of both machine and worker. If a collision is predicted within one second, the system bypasses human intervention—instantly triggering the GPIO E-Stop relay to cut off the engine ignition solenoid, preventing impact."*
* **BGM/Sound Effects:** Accelerated warning beeping that turns into a solid, loud warning buzz. A physical "click" sound of the relay switching, followed by a simulated heavy engine shutting down.
* **Transition:** Fade out, fade in on the 15-page dashboard interface.

---

### Scene 6: Control HMI & Digital Twin Walkthrough (4:45 – 5:45)
* **Camera Angle:** Smooth slider shot tracking across the 7-inch touchscreen. A developer's hand taps through various tabs on the UI dashboard: *Dashboard*, *Operator Profile*, *Incident Replay*, *Analytics*, and *Digital Twin*.
* **UI/Visual Overlay:** Close-ups of the responsive React UI:
  - **Digital Twin:** Showing an isometric canvas layout with 3D-looking machinery models and workers moving in real time.
  - **Analytics:** High-fidelity risk and PPE compliance charts.
  - **Incident Replay:** Scrubber bar sliding back in time to show a recorded near-miss event.
* **Narration:**  
  *"All telemetry, alerts, and live detections are centralized in a premium dark industrial HMI. The dashboard includes a real-time Digital Twin simulating the site layout, detailed operator performance rankings, and incident playback timelines. This gives operators and fleet managers complete visibility and accountability."*
* **BGM/Sound Effects:** Sleek, high-tech electronic transition sounds (swipes and button clicks).
* **Transition:** Cut to the final presentation pitch graphic.

---

### Scene 7: Commercial Readiness & Pitch (5:45 – 6:30)
* **Camera Angle:** A montage of clips: Raspberry Pi 5 running stable in a dust-proof enclosure, operators in safety gear smiling, and the Tata Technologies InnoVent logo.
* **UI/Visual Overlay:** Clean, white-and-orange bullet points:
  - *100% Offline Edge AI (Zero Cloud Fees/Lag)*
  - *Sub-100ms Latency on RPi 5*
  - *Modular Sensor Fusion (Camera + Radar)*
  - *Tata Technologies InnoVent 2026 Prototype*
* **Narration:**  
  *"GuardEdge X is not just a concept; it is an industry-grade, offline safety solution ready for deployment. By resolving the limits of cloud latency, network dropouts, and sensor blindness, GuardEdge X makes heavy machinery operations smart, predictive, and zero-accident. This is the future of industrial safety, powered by Edge AI. Thank you."*
* **BGM/Sound Effects:** Inspiring, cinematic orchestral swell that peaks and ends with a solid, professional tone.
* **Transition:** Fade to black. Show contact information and project github link.
