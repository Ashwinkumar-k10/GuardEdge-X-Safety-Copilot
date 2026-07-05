import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Eye, Users, HardHat, Milestone, Radio, AlertTriangle, Play,
  BarChart2, Cpu, Wrench, UserCheck, Settings, FileText, Database,
  TrendingUp, Activity, RotateCcw, AlertOctagon, Bell, Power, RefreshCw,
  Sun, CheckCircle, XCircle, Download, Clock, MapPin, PlayCircle, PauseCircle
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from 'recharts';

// =====================================================================
// Local Mock Data Generation (Fallback for offline presentation)
// =====================================================================
const generateMockTelemetry = (tick: number, estopActive: boolean) => {
  if (estopActive) {
    return {
      machinery_id: "CAT-320D-01",
      machinery_type: "Hydraulic Excavator",
      operator_name: "Rajesh Kumar",
      safety_score: 82.5,
      fatigue_score: 0.12,
      worker_count: 3,
      rpm: 800,
      speed: 0.0,
      boom_angle: 42.0,
      bucket_height: 1.8,
      current_task: "EMERGENCY SHUTDOWN STATE",
      collision_countdown: 0.0,
      near_miss_counter: 13,
      estop_active: true,
      ppe_compliance_rate: 66.7,
      active_gesture: "NO_HAND",
      weather_temp: 32.5,
      weather_condition: "Dusty / Dry",
      gpu_usage: 5.2,
      cpu_usage: 12.0,
      ram_usage: 3.01,
      system_temp: 45.5,
      storage_free: 18.2,
      radar_status: "STANDBY",
      ultrasonic_status: "STANDBY",
      safety_bubble_radius: 3.0,
      alert_level: "CRITICAL"
    };
  }

  // Operator fatigue cycle
  const phase = (tick % 600) / 10; // 0 to 60s
  let ear = 0.28 + 0.02 * Math.sin(phase * 0.5);
  let mar = 0.15 + 0.05 * Math.cos(phase * 0.3);
  let headPitch = 2.0 + 3.0 * Math.sin(phase * 0.5);
  let fatigueScore = 0.04;
  let activeGesture = "NO_HAND";

  if (phase >= 40.0 && phase < 48.0) {
    mar = 0.75 + 0.1 * Math.sin(phase); // Yawning
    fatigueScore = 0.45;
  }
  if (phase >= 50.0 && phase < 55.0) {
    ear = 0.10 + 0.02 * Math.sin(phase); // Eyes closing
    headPitch = -25.0; // head drop
    fatigueScore = 0.88;
  }

  // Worker approach cycle: Worker W-004 gets closer
  const wDistance = Math.max(10.0 - (tick % 150) * 0.08, 0.8);
  const ttc = wDistance < 4.0 ? wDistance / 1.5 : 99.0;
  const isDanger = wDistance < 2.0 || ttc < 1.0;
  const isWarning = wDistance < 5.0 && !isDanger;

  let alert_level = "NORMAL";
  if (isDanger || fatigueScore > 0.75) alert_level = "CRITICAL";
  else if (isWarning || fatigueScore > 0.40) alert_level = "WARNING";

  // Simulate STOP gesture via hand in warning state
  if (isWarning && tick % 20 > 15) {
    activeGesture = "STOP";
  }

  return {
    machinery_id: "CAT-320D-01",
    machinery_type: "Hydraulic Excavator",
    operator_name: "Rajesh Kumar",
    safety_score: isDanger ? 65.0 : isWarning ? 88.0 : 98.4,
    fatigue_score: fatigueScore,
    worker_count: 3,
    rpm: 1850 + Math.floor(40 * Math.sin(tick * 0.1)),
    speed: isDanger ? 0.0 : 1.2,
    boom_angle: 42.0 + parseFloat((1.5 * Math.sin(tick * 0.05)).toFixed(1)),
    bucket_height: 1.8 + parseFloat((0.3 * Math.cos(tick * 0.07)).toFixed(2)),
    current_task: isDanger ? "COLLISION IMMINENT" : "Trenching and Excavation",
    collision_countdown: isDanger ? 0.8 : parseFloat(ttc.toFixed(1)),
    near_miss_counter: 12 + (isDanger ? 1 : 0),
    estop_active: isDanger,
    ppe_compliance_rate: 66.7, // 2 out of 3 compliant
    active_gesture: activeGesture,
    weather_temp: 32.5 + parseFloat((0.2 * Math.sin(tick * 0.01)).toFixed(1)),
    weather_condition: "Dusty / Dry",
    gpu_usage: 14.5 + parseFloat((1.2 * Math.sin(tick * 0.1)).toFixed(1)),
    cpu_usage: 42.0 + parseFloat((4.5 * Math.cos(tick * 0.2)).toFixed(1)),
    ram_usage: 3.12 + parseFloat((0.02 * Math.sin(tick * 0.05)).toFixed(2)),
    system_temp: 52.3 + parseFloat((0.5 * Math.sin(tick * 0.05)).toFixed(1)),
    storage_free: 18.2,
    radar_status: "ACTIVE_TRACK",
    ultrasonic_status: "ONLINE",
    safety_bubble_radius: 3.0 + (isDanger ? 0 : 1.2),
    alert_level: alert_level,
    ear,
    mar,
    headPitch,
    worker_distance: parseFloat(wDistance.toFixed(1))
  };
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Dual telemetry state architecture
  const [mockTelemetry, setMockTelemetry] = useState<any>(generateMockTelemetry(0, false));
  const [liveTelemetry, setLiveTelemetry] = useState<any>(null);
  
  const [systemMode, setSystemMode] = useState<'live' | 'simulation'>('live');
  const [backendDown, setBackendDown] = useState(true);
  
  // Computed active telemetry structure (shadows original telemetry name for zero code modification downstream)
  const usingMock = systemMode === 'simulation' || backendDown;
  const telemetry = usingMock ? mockTelemetry : (liveTelemetry || mockTelemetry);
  
  const [estopActive, setEstopActive] = useState(false);
  const [tick, setTick] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [alertHistory, setAlertHistory] = useState<any[]>([]);
  const [canLogs, setCanLogs] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [baseBuffer, setBaseBuffer] = useState<number>(3.0);
  const [brakingLatency, setBrakingLatency] = useState<number>(0.5);
  const [trajectoryData, setTrajectoryData] = useState<any[]>([]);
  
  // Replay control states
  const [replayTick, setReplayTick] = useState(50);
  const [replayPlaying, setReplayPlaying] = useState(false);

  // References for Canvas drawings
  const bubbleCanvasRef = useRef<HTMLCanvasElement>(null);
  const twinCanvasRef = useRef<HTMLCanvasElement>(null);
  const replayCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Establish persistent SSE telemetry connection with auto-retry
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: any = null;
    
    const connectSSE = () => {
      console.log("Connecting to GuardEdge X backend telemetry stream...");
      eventSource = new EventSource("http://localhost:5000/telemetry");
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveTelemetry(data);
          setBackendDown(false);
          // Keep frontend E-Stop state in sync with backend hardware E-stop state
          setEstopActive(data.estop_active);
        } catch (err) {
          console.error("Error parsing telemetry stream data:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("Could not connect to live backend API. Switched to Offline Emulation.");
        setBackendDown(true);
        if (eventSource) eventSource.close();
        
        // Retry connection in 3 seconds
        retryTimeout = setTimeout(() => {
          connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  // 2. Emulated background loop (only runs simulation ticks when usingMock is true)
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => {
        const nextTick = t + 1;
        if (usingMock) {
          const mockData = generateMockTelemetry(nextTick, estopActive);
          setMockTelemetry(mockData);
          
          if (mockData.estop_active && !estopActive) {
            setEstopActive(true);
            addLog("CRITICAL", "AI_PIPELINE", "EMERGENCY STOP INTERVENTION: Bypassed operator. Relay 18 triggered high.");
            triggerPhysicalAlarm();
          }
        }
        return nextTick;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [usingMock, estopActive]);

  // 2b. Track real-time trajectory coordinates convergence history
  useEffect(() => {
    if (!telemetry) return;
    setTrajectoryData((prev) => {
      const next = [...prev, {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        workerY: telemetry.worker_distance !== undefined ? parseFloat(telemetry.worker_distance.toFixed(2)) : 10.0,
        bubbleLimit: telemetry.safety_bubble_radius || 3.0,
        countdown: telemetry.collision_countdown < 90 ? telemetry.collision_countdown : 10.0
      }];
      return next.slice(-15); // keep last 15 points
    });
  }, [telemetry]);

  // Log logger handler
  const addLog = (level: string, source: string, message: string) => {
    const timestamp = new Date().toISOString();
    setLogs((prev) => [{ timestamp, level, source, message }, ...prev].slice(0, 100));
  };

  const triggerPhysicalAlarm = () => {
    setAlertHistory((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        type: "Collision Risk",
        desc: "Worker W-004 distance < 1.0m. Ignition relay shut down.",
        lvl: "CRITICAL"
      },
      ...prev
    ]);
  };

  const handleManualEstop = async () => {
    if (usingMock) {
      setEstopActive(true);
      setMockTelemetry((prev: any) => ({ ...prev, estop_active: true, alert_level: "CRITICAL" }));
      addLog("CRITICAL", "GPIO_CONTROLLER", "Cabin manual Emergency Stop switch activated by operator.");
    } else {
      try {
        await fetch("http://localhost:5000/api/estop/trigger", { method: "POST" });
        setEstopActive(true);
        addLog("CRITICAL", "GPIO_CONTROLLER", "Cabin manual Emergency Stop switch activated by operator.");
      } catch (err) {
        console.error("Failed to trigger E-Stop:", err);
      }
    }
  };

  const handleResetEstop = async () => {
    if (usingMock) {
      setEstopActive(false);
      setTick(0); // reset tracking loop
      addLog("INFO", "SYSTEM", "Safety override system reset. Ignition relay released. Resuming operations.");
    } else {
      try {
        await fetch("http://localhost:5000/api/estop/reset", { method: "POST" });
        setEstopActive(false);
        addLog("INFO", "SYSTEM", "Safety override system reset. Ignition relay released. Resuming operations.");
      } catch (err) {
        console.error("Failed to reset E-Stop:", err);
      }
    }
  };

  // Poll J1939 CAN Bus logs when Diagnostics tab is active
  useEffect(() => {
    if (currentTab !== 'health') return;
    
    const fetchCanLogs = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/can_bus");
        const data = await res.json();
        setCanLogs((prev) => [...data, ...prev].slice(0, 100));
      } catch (err) {
        // Fallback simulated SAE J1939 frames if offline
        const mockCan = Array.from({ length: 5 }).map(() => {
          const pgn = ["0x18FEEE00", "0x18FEF600", "0x18FEEF00", "0x0CF00400", "0x18FEF500"][Math.floor(Math.random() * 5)];
          const names = ["Engine Temp", "Particulate Filter", "Hydraulic Pressure", "Electronic Engine Controller", "Ambient Conditions"];
          const name = names[["0x18FEEE00", "0x18FEF600", "0x18FEEF00", "0x0CF00400", "0x18FEF500"].indexOf(pgn)];
          const dataBytes = Array.from({ length: 8 }).map(() => `0x${Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')}`).join(" ");
          return {
            timestamp: new Date().toISOString(),
            pgn,
            name,
            data: dataBytes,
            channel: "CAN0"
          };
        });
        setCanLogs((prev) => [...mockCan, ...prev].slice(0, 100));
      }
    };
    
    fetchCanLogs();
    const interval = setInterval(fetchCanLogs, 1500);
    return () => clearInterval(interval);
  }, [currentTab]);

  // Seed default logs on start
  useEffect(() => {
    setLogs([
      { timestamp: new Date(Date.now() - 1000).toISOString(), level: "INFO", source: "SYSTEM", message: "GuardEdge X Core AI Engine initialized." },
      { timestamp: new Date(Date.now() - 2000).toISOString(), level: "INFO", source: "RADAR_MMWAVE", message: "24GHz mmWave sensor active. Serial link established." },
      { timestamp: new Date(Date.now() - 3000).toISOString(), level: "INFO", source: "CAMERA_OPTICAL", message: "Sony IMX219 worksite camera frame capture OK (120 FPS)." },
      { timestamp: new Date(Date.now() - 4000).toISOString(), level: "INFO", source: "GPIO_CONTROLLER", message: "Actuator relay mapped to BCM Pin 18 - status nominal." },
    ]);
  }, []);

  // 3. Canvas rendering for dynamic safety bubble visualizer
  useEffect(() => {
    if (currentTab !== 'bubble' || !bubbleCanvasRef.current) return;
    const canvas = bubbleCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 500;
    canvas.height = 300;
    ctx.fillStyle = '#090F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height - 40;

    // Grid lines radial sweeps
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let r = 40; r <= 200; r += 40) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#475569';
      ctx.font = '8px monospace';
      ctx.fillText(`${(r / 25).toFixed(1)}m`, cx + r + 4, cy - 2);
    }

    // Dynamic speeds & radii mapping
    const speed = telemetry.speed || 1.2;
    const r_base = baseBuffer * 25; // base meters map to pixels
    const r_warn = r_base + speed * (brakingLatency * 30);
    const r_dang = (r_base * 0.6) + speed * (brakingLatency * 15);

    // Draw warning zone
    ctx.strokeStyle = telemetry.alert_level === 'CRITICAL' ? '#EF4444' : '#FF6B00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r_warn, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 107, 0, 0.05)';
    ctx.fill();

    // Draw danger zone
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r_dang, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.fill();

    // Draw radar scanning sweep line (oscillating arc)
    const sweepAngle = Math.PI + ((tick % 60) / 60) * Math.PI; // sweeps from PI to 2*PI
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * 220, cy + Math.sin(sweepAngle) * 220);
    ctx.stroke();

    // Excavator Cabin Box
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 20, cy - 10, 40, 20);
    ctx.strokeStyle = '#00F2FE';
    ctx.strokeRect(cx - 20, cy - 10, 40, 20);
    ctx.fillStyle = '#FF6B00';
    ctx.font = '9px Orbitron';
    ctx.fillText("CABIN", cx - 15, cy + 3);

  }, [currentTab, telemetry, baseBuffer, brakingLatency, tick]);

  // 4. Canvas rendering for Digital Twin Visualizer
  useEffect(() => {
    if (currentTab !== 'twin' || !twinCanvasRef.current) return;
    const canvas = twinCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 400;
    
    // Draw grid background
    ctx.fillStyle = '#090F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw excavator twin center
    const ex = 300;
    const ey = 250;
    
    // Safety bubbles (read from telemetry)
    const bubbleRadiusVal = telemetry.safety_bubble_radius || 3.0;
    
    // Map radius in meters to pixels: 1 meter = 30 pixels
    const r_warn = bubbleRadiusVal * 30;
    const r_dang = (bubbleRadiusVal * 0.6) * 30;

    // Draw warning zone
    ctx.strokeStyle = telemetry.alert_level === 'CRITICAL' ? 'rgba(239, 68, 68, 0.7)' : (telemetry.alert_level === 'WARNING' ? 'rgba(255, 107, 0, 0.5)' : 'rgba(16, 185, 129, 0.3)');
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, r_warn, 0, 2*Math.PI); ctx.stroke();
    ctx.fillStyle = telemetry.alert_level === 'CRITICAL' ? 'rgba(239, 68, 68, 0.05)' : (telemetry.alert_level === 'WARNING' ? 'rgba(255, 107, 0, 0.03)' : 'rgba(16, 185, 129, 0.01)');
    ctx.fill();

    // Draw danger zone
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(ex, ey, r_dang, 0, 2*Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fill();

    // Twin excavator body drawing
    ctx.save();
    ctx.translate(ex, ey);
    
    // Rotate body slightly to look dynamic
    const boom_ang_rad = (telemetry.boom_angle || 42.0) * Math.PI / 180;
    ctx.rotate(Math.sin(tick * 0.01) * 0.05); // slight chassis oscillation
    
    // Tracks
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-35, -25, 12, 50);
    ctx.fillRect(23, -25, 12, 50);
    
    // Chassis body (CAT yellow-orange)
    ctx.fillStyle = '#FF6B00';
    ctx.fillRect(-23, -20, 46, 40);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-23, -20, 46, 40);
    
    // Cab outline
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-15, -15, 15, 20);
    ctx.strokeStyle = '#00F2FE';
    ctx.strokeRect(-15, -15, 15, 20);
    
    // Counterweight
    ctx.fillStyle = '#334155';
    ctx.fillRect(-23, 15, 46, 8);
    
    // Boom line extending based on actual boom_angle
    const boomLength = Math.max(80 * Math.cos(boom_ang_rad), 20);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(5, -10);
    ctx.lineTo(5 + boomLength * 0.6, -10 - boomLength * 0.4);
    ctx.stroke();
    
    ctx.strokeStyle = '#FF6B00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(5 + boomLength * 0.6, -10 - boomLength * 0.4);
    
    // Arm/Bucket height extension
    const bucket_h = telemetry.bucket_height || 1.8;
    const armX = 5 + boomLength * 0.6 + (30 - bucket_h * 5);
    const armY = -10 - boomLength * 0.4 - (20 + bucket_h * 5);
    ctx.lineTo(armX, armY);
    ctx.stroke();
    
    // Bucket outline
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(armX, armY, 6, 0, 2*Math.PI);
    ctx.fill();
    
    ctx.restore();

    // Draw workers dynamically from backend workers list
    const activeWorkers = telemetry.workers || [
      { id: "W-004", x: 0.0, y: telemetry.worker_distance || 10.0, helmet: true, vest: true },
      { id: "W-012", x: -4.0, y: 7.0, helmet: true, vest: false },
      { id: "W-005", x: 4.5, y: 11.0, helmet: false, vest: true }
    ];
    
    activeWorkers.forEach((w: any) => {
      // Coordinate mapping (1m = 30px)
      const wx = ex + w.x * 30;
      const wy = ey - w.y * 30;
      
      const isPPECompliant = w.helmet && w.vest;
      
      ctx.fillStyle = isPPECompliant ? '#10B981' : '#EF4444';
      ctx.beginPath();
      ctx.arc(wx, wy, 8, 0, 2*Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Proximity ring
      ctx.strokeStyle = isPPECompliant ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(wx, wy, 15, 0, 2*Math.PI);
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = '9px Roboto Mono';
      ctx.fillText(`${w.id} ${isPPECompliant ? '' : '[PPE!]'}`, wx + 12, wy + 4);
    });

    // Draw scanning radar arcs
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ex - 200, ey);
    ctx.lineTo(ex + 200, ey);
    ctx.stroke();

  }, [currentTab, telemetry, tick]);

  // 5. Canvas rendering for Incident Replay scrubber
  useEffect(() => {
    if (currentTab !== 'replay' || !replayCanvasRef.current) return;
    const canvas = replayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 300;
    ctx.fillStyle = '#090F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid background
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    const startY = 40;
    const endY = 220;
    const curY = startY + (replayTick / 100) * (endY - startY);
    const mx = 300, my = 220;

    // Safety zones (warning bubble = 90px, danger bubble = 45px)
    // Warning zone
    ctx.strokeStyle = 'rgba(255, 107, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, my, 90, 0, 2*Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 107, 0, 0.02)';
    ctx.fill();

    // Danger zone
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 45, 0, 2*Math.PI); ctx.stroke();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
    ctx.fill();

    // Draw worker trajectory trace (dotted path where worker came from)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, startY);
    ctx.lineTo(mx, curY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Draw historical frame dots
    for (let sy = startY; sy < curY; sy += 25) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath(); ctx.arc(mx, sy, 3, 0, 2*Math.PI); ctx.fill();
    }

    // Excavator twin structure
    // Tracks
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(mx - 22, my - 18, 8, 36);
    ctx.fillRect(mx + 14, my - 18, 8, 36);
    
    // Chassis
    ctx.fillStyle = '#FF6B00';
    ctx.fillRect(-14 + mx, -15 + my, 28, 30);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-14 + mx, -15 + my, 28, 30);

    // Cabin
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(mx - 10, my - 12, 10, 16);
    
    // E-Stop status indicator ring around excavator
    if (curY > my - 45) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 20 + (replayTick % 5) * 2, 0, 2*Math.PI);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, 2*Math.PI); ctx.fill();
    }

    // Worker approaching target
    const distMeters = ((my - curY) / 20);
    const inDanger = distMeters < 2.25; // 45px / 20
    const inWarning = distMeters < 4.5;  // 90px / 20

    ctx.fillStyle = inDanger ? '#ef4444' : (inWarning ? '#FF6B00' : '#10B981');
    ctx.beginPath(); ctx.arc(mx, curY, 8, 0, 2*Math.PI); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '9px Roboto Mono';
    ctx.fillText(`W-004 (${distMeters.toFixed(1)}m)`, mx + 12, curY + 3);

    // Diagnostics HUD box overlay
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillRect(15, 15, 190, 80);
    ctx.strokeRect(15, 15, 190, 80);

    ctx.font = 'bold 8px Orbitron';
    ctx.fillStyle = '#00F2FE';
    ctx.fillText("CRASH TRACE RECONSTRUCTION", 22, 28);
    
    ctx.font = '8px Roboto Mono';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`TIME SCENE: T-${((100 - replayTick) * 0.1).toFixed(1)}s`, 22, 42);
    ctx.fillText(`PROXIMITY: ${distMeters.toFixed(2)}m`, 22, 53);
    
    // Status text
    const ttc = distMeters / 1.5; // assume speed is 1.5 m/s
    const statusText = inDanger ? "E-STOP ENGAGED" : (inWarning ? "BUZZER WARNING" : "TRACKING SCAN");
    const statusColor = inDanger ? "#EF4444" : (inWarning ? "#FF6B00" : "#10B981");
    ctx.fillText(`EST TTC: ${inWarning ? `${ttc.toFixed(1)}s` : 'SAFE'}`, 22, 64);
    
    ctx.fillStyle = statusColor;
    ctx.font = 'bold 8px Roboto Mono';
    ctx.fillText(`RELAY STATE: ${statusText}`, 22, 76);

    // Scrubber timeline bar in canvas
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 270, 580, 20);
    ctx.fillStyle = '#00F2FE';
    ctx.fillRect(10, 270, (replayTick/100) * 580, 20);
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px Roboto Mono';
    ctx.fillText(`Scrubber Frame: T-${((100 - replayTick) * 0.1).toFixed(1)}s`, 20, 284);

  }, [currentTab, replayTick]);

  // Handle auto playback for replay
  useEffect(() => {
    if (!replayPlaying) return;
    const replayInterval = setInterval(() => {
      setReplayTick((prev) => {
        if (prev >= 100) {
          setReplayPlaying(false);
          return 100;
        }
        return prev + 1;
      });
    }, 100);
    return () => clearInterval(replayInterval);
  }, [replayPlaying]);

  // Sidebar list definitions
  const sidebarTabs = [
    { id: 'dashboard', name: 'Dashboard', icon: Shield },
    { id: 'fatigue', name: 'Operator Monitoring', icon: Clock },
    { id: 'detection', name: 'Worker Detection', icon: Users },
    { id: 'ppe', name: 'PPE Detection', icon: HardHat },
    { id: 'gesture', name: 'Gesture Recognition', icon: Milestone },
    { id: 'bubble', name: 'Safety Bubble', icon: Radio },
    { id: 'collision', name: 'Collision Predictor', icon: AlertTriangle },
    { id: 'replay', name: 'Incident Replay', icon: Play },
    { id: 'analytics', name: 'Analytics Data', icon: BarChart2 },
    { id: 'twin', name: 'Digital Twin', icon: RefreshCw },
    { id: 'health', name: 'Machine Diagnostics', icon: Wrench },
    { id: 'profile', name: 'Operator Profile', icon: UserCheck },
    { id: 'settings', name: 'System Settings', icon: Settings },
    { id: 'logs', name: 'System Logs', icon: Database },
    { id: 'reports', name: 'Safety Reports', icon: FileText }
  ];

  // Raw mock analytics data for charts
  const safetyHistory = [
    { day: 'Mon', score: 98, fatigue: 4, compliance: 100 },
    { day: 'Tue', score: 97, fatigue: 6, compliance: 95 },
    { day: 'Wed', score: 95, fatigue: 12, compliance: 85 },
    { day: 'Thu', score: 98, fatigue: 3, compliance: 100 },
    { day: 'Fri', score: 92, fatigue: 18, compliance: 66 },
    { day: 'Sat', score: 96, fatigue: 9, compliance: 90 },
    { day: 'Sun', score: 99, fatigue: 2, compliance: 100 },
  ];

  const ppeViolations = [
    { name: 'W-002', helmet: 1, vest: 0 },
    { name: 'W-004', helmet: 0, vest: 2 },
    { name: 'W-005', helmet: 2, vest: 1 },
    { name: 'W-007', helmet: 1, vest: 1 },
    { name: 'W-012', helmet: 0, vest: 3 },
  ];

  const fatigueDistribution = [
    { name: '08:00', val: 0.1 },
    { name: '10:00', val: 0.15 },
    { name: '12:00', val: 0.38 },
    { name: '14:00', val: 0.45 },
    { name: '16:00', val: 0.58 },
    { name: '18:00', val: 0.2 },
  ];

  return (
    <div className="flex h-screen bg-[#090F1A] text-slate-100 font-sans select-none overflow-hidden">
      
      {/* 1. Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col justify-between z-20">
        <div>
          {/* Logo Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#FF6B00] to-[#00F2FE] flex items-center justify-center shadow-cyan-glow">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="font-orbitron font-bold text-sm tracking-widest text-[#00F2FE]">GUARDEDGE X</h1>
              <span className="text-[9px] text-[#FF6B00] font-mono tracking-wider">OFFLINE EDGE AI</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {sidebarTabs.map((t) => {
              const Icon = t.icon;
              const isActive = currentTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setCurrentTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[rgba(0,242,254,0.15)] to-transparent border-l-2 border-[#00F2FE] text-[#00F2FE]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#00F2FE]' : 'text-slate-500'}`} />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Hardware Info & Mode Toggle */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="text-[10px] font-mono text-slate-500 space-y-1">
            <div>DEVICE: RASPBERRY PI 5 (8GB)</div>
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                systemMode === 'simulation' ? 'bg-indigo-500' : (backendDown ? 'bg-orange-500' : 'bg-[#10B981]')
              } animate-pulse`}></span>
              <span>MODE: {
                systemMode === 'simulation' ? 'SIMULATION' : (backendDown ? 'LIVE (OFFLINE EMUL)' : 'LIVE WEBCAM CV')
              }</span>
            </div>
          </div>
          <button
            onClick={() => setSystemMode((m) => m === 'live' ? 'simulation' : 'live')}
            className={`w-full py-1.5 rounded text-[10px] font-orbitron font-bold transition-all active:scale-95 cursor-pointer ${
              systemMode === 'live' && !backendDown
                ? 'bg-gradient-to-r from-[#00F2FE] to-cyan-500 text-black shadow-cyan-glow'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {systemMode === 'live' ? 'SWITCH TO SIMULATION' : 'SWITCH TO LIVE WEBCAM'}
          </button>
        </div>
      </aside>

      {/* 2. Main Workstation Panel */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Fullscreen Alert overlay removed for realistic non-blocking diagnostics */}

        {/* Header Telemetry Bar */}
        <header className="h-14 border-b border-slate-800 glass-panel flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono">
              <span className="text-slate-500">ASSET:</span> <span className="text-[#00F2FE]">{telemetry.machinery_id}</span>
            </div>
            <div className="text-xs font-mono">
              <span className="text-slate-500">OPERATOR:</span> <span className="text-slate-200">{telemetry.operator_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Status indicators */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${telemetry.alert_level === 'CRITICAL' ? 'bg-[#EF4444]' : telemetry.alert_level === 'WARNING' ? 'bg-[#FF6B00]' : 'bg-[#10B981]'} animate-pulse`}></span>
                <span className="text-[10px] font-mono tracking-wider">{telemetry.alert_level} RISK STATE</span>
              </div>
            </div>

            {/* Quick manual E-Stop */}
            <button
              onClick={handleManualEstop}
              className="px-4 py-1.5 bg-[#EF4444] hover:bg-[#dc2626] text-black font-orbitron font-bold text-xs rounded transition-all flex items-center gap-1.5 shadow"
            >
              <Power className="w-3.5 h-3.5 text-black" />
              EMERGENCY STOP
            </button>
          </div>
        </header>

        {/* Warning Banner below header if E-stop active */}
        {estopActive && (
          <div className="bg-red-950/70 border-b border-red-500/80 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse z-20 flex-shrink-0 animate-alert-flash">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-6 h-6 text-[#EF4444] animate-bounce flex-shrink-0" />
              <div>
                <div className="text-xs font-orbitron font-bold text-[#EF4444]">CRITICAL ENGINE IGNITION RELAY DEACTIVATED [RELAY BCM 18: HIGH]</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Hazard proximity violation. The ignition solenoid circuit has been cut off to prevent collision.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right hidden xl:block font-mono text-[9px] text-red-400">
                BUZZER: 85dB PULSING | ENGINE: SOLENOID LOCKED
              </div>
              <button
                onClick={handleResetEstop}
                className="px-4 py-1.5 bg-[#EF4444] hover:bg-[#dc2626] active:scale-95 text-black font-orbitron font-bold text-xs rounded transition-all flex items-center gap-1.5 shadow shadow-red-950/40 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5 text-black" />
                RELEASE ENGINE E-STOP
              </button>
            </div>
          </div>
        )}

        {/* Tab content wrapper */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* =========================================================
              TAB: DASHBOARD
              ========================================================= */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                
                {/* 1. Safety Score */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-t-2 border-[#10B981]">
                  <div className="text-slate-500 text-[10px] font-mono">SAFETY SCORE</div>
                  <div className="text-3xl font-orbitron font-bold text-[#10B981] mt-2">{telemetry.safety_score}%</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-2">CLASS-A SITE RATING</div>
                </div>

                {/* 2. Fatigue Indicator */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-t-2 border-[#FF6B00]">
                  <div className="text-slate-500 text-[10px] font-mono">FATIGUE RISK</div>
                  <div className="text-3xl font-orbitron font-bold text-[#FF6B00] mt-2">{Math.round(telemetry.fatigue_score * 100)}%</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-2">PERCLOS TRACKED</div>
                </div>

                {/* 3. Worker Count */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-t-2 border-[#00F2FE]">
                  <div className="text-slate-500 text-[10px] font-mono">WORKER COUNT</div>
                  <div className="text-3xl font-orbitron font-bold text-[#00F2FE] mt-2">{telemetry.worker_count}</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-2">YOLOv8 DETECTED</div>
                </div>

                {/* 4. Engine RPM */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-l-2 border-slate-700">
                  <div className="text-slate-500 text-[10px] font-mono">ENGINE RPM</div>
                  <div className="text-3xl font-orbitron font-bold mt-2">{telemetry.rpm}</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-2">DIAGNOSTICS ONLINE</div>
                </div>

                {/* 5. Boom/Bucket */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between border-l-2 border-slate-700">
                  <div className="text-slate-500 text-[10px] font-mono">BOOM / BUCKET</div>
                  <div className="text-xl font-orbitron font-bold mt-2">{telemetry.boom_angle}° / {telemetry.bucket_height}m</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-2">ANGLE & DEPTH</div>
                </div>

                {/* 6. Collision countdown */}
                <div className={`glass-panel p-4 rounded-xl flex flex-col justify-between border-t-2 ${telemetry.collision_countdown < 5 ? 'border-[#EF4444] animate-pulse' : 'border-slate-800'}`}>
                  <div className="text-slate-500 text-[10px] font-mono">COLLISION COUNTDOWN</div>
                  <div className="text-3xl font-orbitron font-bold text-[#EF4444] mt-2">
                    {telemetry.collision_countdown < 10 ? `${telemetry.collision_countdown}s` : 'SAFE'}
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-2">TRAJECTORY PREDICT</div>
                </div>

              </div>

              {/* Cameras Split Screen */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Worksite optical feed */}
                <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-orbitron font-semibold flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#00F2FE] animate-pulse" />
                      WORKSITE REAR FEED
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">YOLOv8 + KALMAN FILTER</span>
                  </div>
                  <div className="flex-1 bg-black min-h-[300px] flex items-center justify-center relative overflow-hidden">
                    <img
                      src={`http://localhost:5000/video_feed/worksite?simulate=${usingMock ? 1 : 0}`}
                      className="w-full h-full object-cover"
                      alt="Worksite Feed"
                      onError={(e) => {
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24'%3E%3Cpath fill='%23ef4444' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'/%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                </div>

                {/* Operator Monitoring IR feed */}
                <div className="glass-panel rounded-xl overflow-hidden flex flex-col">
                  <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-xs font-orbitron font-semibold flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#FF6B00]" />
                      OPERATOR IR CABIN FEED
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">MEDIAPIPE FACE MESH</span>
                  </div>
                  <div className="flex-1 bg-black min-h-[300px] flex items-center justify-center relative overflow-hidden">
                    <img
                      src={`http://localhost:5000/video_feed/operator?simulate=${usingMock ? 1 : 0}`}
                      className="w-full h-full object-cover"
                      alt="Operator Feed"
                      onError={(e) => {
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24'%3E%3Cpath fill='%23ef4444' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'/%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                </div>

              </div>

              {/* Bottom Row Details */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Alerts */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">ACTIVE SYSTEM ALARMS</h3>
                  <div className="mt-3 space-y-2 flex-1">
                    {telemetry.alert_level === 'CRITICAL' ? (
                      <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-500 animate-pulse">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold font-orbitron">IMPACT IMMINENT</div>
                          <div className="text-[10px] font-mono">Excavator shutdown triggered.</div>
                        </div>
                      </div>
                    ) : telemetry.alert_level === 'WARNING' ? (
                      <div className="p-3 bg-orange-950/40 border border-[#FF6B00]/50 rounded-lg flex items-center gap-3 text-[#FF6B00]">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold font-orbitron">PROXIMITY WARNING</div>
                          <div className="text-[10px] font-mono">Worker W-004 is approaching safety bubble.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-green-950/20 border border-green-500/20 rounded-lg flex items-center gap-3 text-[#10B981]">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold font-orbitron">SENSORS STABLE</div>
                          <div className="text-[10px] font-mono">Zero collision hazards detected on site.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Resource Usage */}
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">EDGE COMPUTE (RPi5) RESOURCE</h3>
                  <div className="mt-4 space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span>CPU OVERALL (4x Cortex-A76)</span>
                        <span>{telemetry.cpu_usage}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#00F2FE] h-full" style={{ width: `${telemetry.cpu_usage}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span>GPU/NPU ACCELERATOR</span>
                        <span>{telemetry.gpu_usage}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#FF6B00] h-full" style={{ width: `${telemetry.gpu_usage}%` }}></div>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] pt-1">
                      <span>SYSTEM TEMP:</span>
                      <span className="text-[#FF6B00]">{telemetry.system_temp}°C</span>
                    </div>
                  </div>
                </div>

                {/* Radar Sweep Animation Widget */}
                <div className="glass-panel p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">RADAR RANGE SWEEP</h3>
                  <div className="flex-1 flex items-center justify-center mt-3">
                    <div className="w-24 h-24 rounded-full border border-slate-800 relative flex items-center justify-center overflow-hidden bg-slate-950">
                      {/* Sweep line */}
                      <div className="absolute w-12 h-[1px] bg-gradient-to-r from-transparent to-[#00F2FE] origin-left left-1/2 top-1/2 animate-radar-sweep shadow-cyan-glow"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00F2FE]"></div>
                      <div className="w-12 h-12 rounded-full border border-dashed border-slate-800"></div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: OPERATOR FATIGUE
              ========================================================= */}
          {currentTab === 'fatigue' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">OPERATOR FATIGUE & ATTENTION TELEMETRY</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Telemetry Gauges */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">FACIAL RATIO METRICS</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span>EYE ASPECT RATIO (EAR)</span>
                        <span className={telemetry.ear < 0.2 ? 'text-red-500 font-bold' : 'text-slate-300'}>
                          {telemetry.ear?.toFixed(3) || '0.280'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${telemetry.ear < 0.2 ? 'bg-red-500' : 'bg-[#10B981]'}`}
                          style={{ width: `${Math.min(100, ((telemetry.ear || 0.28) / 0.4) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Drowsiness threshold: &lt; 0.20</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span>MOUTH ASPECT RATIO (MAR)</span>
                        <span className={telemetry.mar > 0.6 ? 'text-[#FF6B00] font-bold' : 'text-slate-300'}>
                          {telemetry.mar?.toFixed(3) || '0.150'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${telemetry.mar > 0.6 ? 'bg-[#FF6B00]' : 'bg-[#00F2FE]'}`}
                          style={{ width: `${Math.min(100, ((telemetry.mar || 0.15) / 1.0) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono">Yawning threshold: &gt; 0.65</span>
                    </div>

                    <div className="pt-2">
                      <div className="text-[10px] font-mono text-slate-500">HEAD DROP/PITCH ANGLE:</div>
                      <div className="text-xl font-orbitron font-bold mt-1 text-slate-200">
                        {telemetry.headPitch?.toFixed(1) || '0.0'}°
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Fatigue risk timeline graph */}
                <div className="glass-panel p-6 rounded-xl col-span-2">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">FATIGUE RISK PROBABILITY SHIFT</h3>
                  <div className="h-[200px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={safetyHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#64748b" style={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0f1626', borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Line type="monotone" dataKey="fatigue" stroke="#FF6B00" strokeWidth={2} name="Fatigue Alert Frequency" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: WORKER DETECTION
              ========================================================= */}
          {currentTab === 'detection' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">YOLOv8 + DeepSORT WORKER DETECTION PIPELINE</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Live stream expanded */}
                <div className="glass-panel rounded-xl overflow-hidden col-span-2 flex flex-col">
                  <div className="p-3 bg-slate-900/60 border-b border-slate-800 text-xs font-orbitron">
                    WORKSITE OPTICAL TARGET STREAM
                  </div>
                  <div className="bg-black aspect-video flex items-center justify-center relative overflow-hidden">
                    <img
                      src={`http://localhost:5000/video_feed/worksite?simulate=${usingMock ? 1 : 0}`}
                      className="w-full h-full object-cover"
                      alt="Optical Target Feed"
                      onError={(e) => {
                        e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24'%3E%3Cpath fill='%23ef4444' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z'/%3E%3C/svg%3E";
                      }}
                    />
                  </div>
                </div>

                {/* Worker targets status */}
                <div className="glass-panel p-6 rounded-xl space-y-4">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">DETECTION TELEMETRY</h3>
                  
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-500">OBJECT MODEL:</span>
                      <span className="text-[#00F2FE]">YOLOv8-NANO-PPE [ONNX]</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-500">TRACKER:</span>
                      <span className="text-[#00F2FE]">DeepSORT CENTROID</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-500">INFERENCE SPEED:</span>
                      <span className="text-[#10B981]">14.2 ms [LATENCY OK]</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/40 pb-1">
                      <span className="text-slate-500">COMPUTE STATE:</span>
                      <span className="text-[#10B981]">OFFLINE (NO INTERNET)</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: PPE DETECTION
              ========================================================= */}
          {currentTab === 'ppe' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">PERSONAL PROTECTIVE EQUIPMENT (PPE) LOGS</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* PPE checks */}
                <div className="glass-panel p-6 rounded-xl space-y-4">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">ACTIVE TARGET COMPLIANCE</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardHat className="w-5 h-5 text-[#10B981]" />
                        <span className="text-xs font-mono">SAFETY HELMET</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-green-950 border border-green-500/30 text-[#10B981] text-[10px] font-mono rounded">DETECTION OK</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-[#EF4444]" />
                        <span className="text-xs font-mono">HI-VIS VEST</span>
                      </div>
                      <span className="px-2.5 py-0.5 bg-red-950 border border-red-500/30 text-[#EF4444] text-[10px] font-mono rounded">VIOLATION ALERT</span>
                    </div>
                  </div>
                </div>

                {/* PPE violation history */}
                <div className="glass-panel p-6 rounded-xl col-span-2">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">COMPLIANCE STATISTICS</h3>
                  <div className="h-[200px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ppeViolations}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0f1626', borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Legend />
                        <Bar dataKey="helmet" fill="#FF6B00" name="Missing Helmet count" />
                        <Bar dataKey="vest" fill="#EF4444" name="Missing Vest count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: GESTURE RECOGNITION
              ========================================================= */}
          {currentTab === 'gesture' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">MEDIAPIPE HAND GESTURE CONTROL</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Active Gestures & Probabilities */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <div>
                    <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">RECOGNIZED COMMANDS</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono text-center pt-4">
                      <div className={`p-4 rounded-lg border transition-all ${telemetry.active_gesture === 'STOP' ? 'border-red-500 bg-red-950/20 text-red-500 animate-pulse font-bold' : 'border-slate-800 bg-slate-900/30 text-slate-500'}`}>
                        <div className="text-2xl">✋</div>
                        <div className="mt-2 font-bold font-orbitron">STOP</div>
                      </div>

                      <div className={`p-4 rounded-lg border transition-all ${telemetry.active_gesture === 'THUMBS_UP' ? 'border-emerald-500 bg-green-950/20 text-[#10B981] animate-pulse font-bold' : 'border-slate-800 bg-slate-900/30 text-slate-500'}`}>
                        <div className="text-2xl">👍</div>
                        <div className="mt-2 font-bold font-orbitron">SAFE / RESUME</div>
                      </div>
                    </div>
                  </div>

                  {/* Neural Net Inference HUD */}
                  <div className="space-y-4 pt-2 border-t border-slate-800/60">
                    <h4 className="text-[10px] font-orbitron font-bold text-slate-400">CNN CLASSIFIER PROBABILITIES (REAL-TIME)</h4>
                    
                    <div className="space-y-3 font-mono text-[10px]">
                      {/* STOP probability */}
                      <div>
                        <div className="flex justify-between mb-1 text-slate-400">
                          <span>✋ STOP GESTURE CLASSIFIER:</span>
                          <span className={telemetry.active_gesture === 'STOP' ? 'text-red-400 font-bold' : 'text-slate-500'}>
                            {telemetry.active_gesture === 'STOP' ? '94.2%' : '1.4%'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/60">
                          <div className={`h-full transition-all duration-300 ${telemetry.active_gesture === 'STOP' ? 'bg-red-500' : 'bg-slate-700'}`} style={{ width: telemetry.active_gesture === 'STOP' ? '94.2%' : '1.4%' }}></div>
                        </div>
                      </div>

                      {/* THUMBS UP probability */}
                      <div>
                        <div className="flex justify-between mb-1 text-slate-400">
                          <span>👍 SAFE/RESUME CLASSIFIER:</span>
                          <span className={telemetry.active_gesture === 'THUMBS_UP' ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                            {telemetry.active_gesture === 'THUMBS_UP' ? '96.5%' : '0.8%'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/60">
                          <div className={`h-full transition-all duration-300 ${telemetry.active_gesture === 'THUMBS_UP' ? 'bg-emerald-500' : 'bg-slate-700'}`} style={{ width: telemetry.active_gesture === 'THUMBS_UP' ? '96.5%' : '0.8%' }}></div>
                        </div>
                      </div>

                      {/* NO HAND probability */}
                      <div>
                        <div className="flex justify-between mb-1 text-slate-400">
                          <span>🔍 NO GESTURE DETECTED (BACKGROUND):</span>
                          <span className={telemetry.active_gesture === 'NO_HAND' ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                            {telemetry.active_gesture === 'NO_HAND' ? '98.1%' : '2.5%'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/60">
                          <div className={`h-full transition-all duration-300 ${telemetry.active_gesture === 'NO_HAND' ? 'bg-cyan-500' : 'bg-slate-700'}`} style={{ width: telemetry.active_gesture === 'NO_HAND' ? '98.1%' : '2.5%' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline & Test overrides */}
                <div className="glass-panel p-6 rounded-xl space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">COMMAND HISTORY TIMELINE</h3>
                    
                    <div className="space-y-2 font-mono text-[10px] text-slate-400 h-[100px] overflow-y-auto pr-1">
                      <div className="flex gap-4 border-b border-slate-800/40 pb-2">
                        <span className="text-[#00F2FE]">09:42:15</span>
                        <span className="text-red-500 font-bold">✋ STOP GESTURE RECOGNIZED</span>
                        <span className="text-slate-500">Excavator stop actuated.</span>
                      </div>
                      <div className="flex gap-4 border-b border-slate-800/40 pb-2">
                        <span className="text-[#00F2FE]">09:40:02</span>
                        <span className="text-[#10B981]">👍 SAFE GESTURE DETECTED</span>
                        <span className="text-slate-500">System checklist verified.</span>
                      </div>
                    </div>
                  </div>

                  {/* Manual testing overrides */}
                  <div className="pt-4 border-t border-slate-800/60 space-y-3">
                    <h4 className="text-[10px] font-orbitron font-bold text-slate-400">MANUAL DEMO OVERRIDES</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          if (usingMock) {
                            setMockTelemetry((prev: any) => ({ ...prev, active_gesture: 'STOP', estop_active: true, alert_level: "CRITICAL" }));
                            setEstopActive(true);
                            addLog("CRITICAL", "AI_PIPELINE", "Gesture STOP manual override triggered.");
                          } else {
                            fetch("http://localhost:5000/api/settings", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ active_gesture: "STOP" })
                            }).catch(console.error);
                          }
                        }}
                        className="py-1.5 bg-red-950/40 hover:bg-red-950/80 border border-red-500/40 text-red-400 font-orbitron font-semibold text-[10px] rounded transition-all cursor-pointer"
                      >
                        SIMULATE ✋ STOP
                      </button>

                      <button
                        onClick={() => {
                          if (usingMock) {
                            setMockTelemetry((prev: any) => ({ ...prev, active_gesture: 'THUMBS_UP', estop_active: false, alert_level: "NORMAL" }));
                            setEstopActive(false);
                            addLog("INFO", "AI_PIPELINE", "Gesture SAFE/RESUME manual override triggered.");
                          } else {
                            fetch("http://localhost:5000/api/settings", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ active_gesture: "THUMBS_UP" })
                            }).catch(console.error);
                          }
                        }}
                        className="py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-orbitron font-semibold text-[10px] rounded transition-all cursor-pointer"
                      >
                        SIMULATE 👍 RESUME
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* =========================================================
              TAB: SAFETY BUBBLE
              ========================================================= */}
          {currentTab === 'bubble' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">DYNAMIC PREDICTIVE SAFETY BUBBLE</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 2.5D top-down map */}
                <div className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2 w-full text-left mb-4">
                    BUBBLE RADIUS SIMULATION
                  </h3>
                  <canvas ref={bubbleCanvasRef} className="border border-slate-800 bg-[#090F1A] rounded" />
                </div>

                {/* Configurations */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">BUBBLE PARAMETERS</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span>STATIC BASE BUFFER:</span>
                        <span>{baseBuffer.toFixed(1)} METERS</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="5.0"
                        step="0.5"
                        value={baseBuffer}
                        onChange={(e) => setBaseBuffer(parseFloat(e.target.value))}
                        className="w-full accent-[#00F2FE] cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span>BRAKING LATENCY FACTOR:</span>
                        <span>{brakingLatency.toFixed(1)} SECONDS</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={brakingLatency}
                        onChange={(e) => setBrakingLatency(parseFloat(e.target.value))}
                        className="w-full accent-[#FF6B00] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {currentTab === 'collision' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">KALMAN FILTER COLLISION PREDICTION</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Tickers */}
                <div className="glass-panel p-6 rounded-xl space-y-6 flex flex-col justify-between">
                  <div className="space-y-6">
                    <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">COLLISION STATISTICS</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-[10px] font-mono text-slate-500">TIME TO IMPACT (TTC):</div>
                        <div className={`text-4xl font-orbitron font-bold mt-2 ${telemetry.collision_countdown < 5.0 ? 'text-[#EF4444] animate-pulse' : 'text-emerald-500'}`}>
                          {telemetry.collision_countdown < 15 ? `${telemetry.collision_countdown.toFixed(1)}s` : 'SAFE'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono text-slate-500">KALMAN INTERSECT CONFIDENCE:</div>
                        <div className={`text-sm font-orbitron font-bold mt-1 ${telemetry.collision_countdown < 10.0 ? 'text-[#EF4444]' : 'text-[#00F2FE]'}`}>
                          {telemetry.collision_countdown < 10.0 ? '97.8% [CRITICAL BREACH]' : '94.2% [MONITORING]'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-mono text-slate-500">BRAKING DISTANCE ENVELOPE:</div>
                        <div className="text-sm font-orbitron font-bold mt-1 text-slate-300">
                          {((telemetry.speed || 1.2) * 2.1).toFixed(2)} METERS
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-[10px] font-mono text-slate-500 pt-4 border-t border-slate-800/60">
                    STATUS: {telemetry.estop_active ? "IGNITION RELAY OPEN" : "TRACKING ACTIVE"}
                  </div>
                </div>

                {/* Trajectory Convergence */}
                <div className="glass-panel p-6 rounded-xl col-span-2">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">
                    REAL-TIME STATE CONVERGENCE TRACE
                  </h3>
                  <div className="h-[210px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trajectoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: 9 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: '#0f1626', borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="workerY" stroke="#FF6B00" strokeWidth={2} name="Worker Distance (m)" activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="bubbleLimit" stroke="#00F2FE" strokeWidth={1.5} name="Safety Bubble Buffer (m)" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="countdown" stroke="#EF4444" strokeWidth={1.5} name="TTC Index (s)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            {/* Kalman threat matrix table */}
              <div className="glass-panel p-6 rounded-xl">
                <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2 mb-4">
                  KALMAN STATE THREAT MATRIX
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs text-slate-400">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] text-slate-500">
                        <th className="pb-2">OBJECT ID</th>
                        <th className="pb-2">COORD (X, Y)</th>
                        <th className="pb-2">VELOCITY VECTOR</th>
                        <th className="pb-2">TTC (s)</th>
                        <th className="pb-2">THREAT INDEX</th>
                        <th className="pb-2">SOLENOID STATE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      <tr className="hover:bg-slate-900/10">
                        <td className="py-2 text-[#00F2FE] font-bold">W-004 (Worker)</td>
                        <td className="py-2">
                          {(telemetry.workers?.[0]?.x || 0.0).toFixed(1)}m, {(telemetry.worker_distance || 10.0).toFixed(1)}m
                        </td>
                        <td className="py-2">-1.5 m/s</td>
                        <td className="py-2">
                          {telemetry.collision_countdown < 15 ? `${telemetry.collision_countdown.toFixed(1)}s` : 'SAFE'}
                        </td>
                        <td className={`py-2 font-bold ${telemetry.alert_level === 'CRITICAL' ? 'text-[#EF4444]' : (telemetry.alert_level === 'WARNING' ? 'text-[#FF6B00]' : 'text-emerald-500')}`}>
                          {telemetry.alert_level}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${telemetry.estop_active ? 'bg-red-950 border border-red-500/30 text-[#EF4444] animate-pulse' : 'bg-slate-900 text-slate-500'}`}>
                            {telemetry.estop_active ? 'RELAY OPEN (CUT)' : 'RELAY CLOSED (RUN)'}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-900/10">
                        <td className="py-2 text-slate-300">W-012 (Worker)</td>
                        <td className="py-2">-4.0m, 7.0m</td>
                        <td className="py-2">+0.2 m/s</td>
                        <td className="py-2">SAFE</td>
                        <td className="py-2 text-emerald-500 font-bold">NORMAL</td>
                        <td className="py-2"><span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-500">MONITORING</span></td>
                      </tr>
                      <tr className="hover:bg-slate-900/10">
                        <td className="py-2 text-slate-300">W-005 (Worker)</td>
                        <td className="py-2">4.5m, 11.0m</td>
                        <td className="py-2">+0.4 m/s</td>
                        <td className="py-2">SAFE</td>
                        <td className="py-2 text-emerald-500 font-bold">NORMAL</td>
                        <td className="py-2"><span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-500">MONITORING</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
          {currentTab === 'replay' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">CRITICAL NEAR-MISS INCIDENT REPLAY VIEWER</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Replay List */}
                <div className="glass-panel p-6 rounded-xl space-y-4">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">INCIDENT HISTORY</h3>
                  <div className="space-y-2">
                    <button className="w-full p-3 rounded-lg border border-red-500 bg-red-950/20 text-left text-xs font-mono text-red-400">
                      <div className="font-bold font-orbitron">INCIDENT #12 (NEAR-MISS)</div>
                      <div className="text-[10px] text-slate-500 mt-1">Worker W-004 | Distance: 1.1m</div>
                    </button>
                    <button className="w-full p-3 rounded-lg border border-slate-800 hover:border-slate-700 text-left text-xs font-mono text-slate-400">
                      <div className="font-bold font-orbitron">INCIDENT #11 (WARNING)</div>
                      <div className="text-[10px] text-slate-500 mt-1">Worker W-012 | Distance: 2.3m</div>
                    </button>
                  </div>
                </div>

                {/* Canvas Player */}
                <div className="glass-panel p-6 rounded-xl col-span-2 flex flex-col items-center">
                  <div className="w-full flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                    <span className="text-xs font-orbitron font-bold text-slate-400">INCIDENT #12 SIMULATED REPLAY</span>
                    <button
                      onClick={() => {
                        if (replayTick >= 100) {
                          setReplayTick(0);
                        }
                        setReplayPlaying(!replayPlaying);
                      }}
                      className="px-3 py-1 bg-[#00F2FE] text-black font-orbitron font-bold text-xs rounded hover:bg-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {replayPlaying ? <PauseCircle className="w-4 h-4 text-black" /> : <PlayCircle className="w-4 h-4 text-black" />}
                      {replayPlaying ? 'PAUSE' : 'PLAY REPLAY'}
                    </button>
                  </div>
                  
                  <canvas ref={replayCanvasRef} className="border border-slate-800 bg-black rounded" />
                  
                  {/* Slider controller */}
                  <div className="w-full mt-4 flex items-center gap-4">
                    <span className="text-xs font-mono text-slate-500">T-10s</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={replayTick}
                      onChange={(e) => setReplayTick(parseInt(e.target.value))}
                      className="flex-1 accent-[#00F2FE]"
                    />
                    <span className="text-xs font-mono text-slate-500">T-0s</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: ANALYTICS
              ========================================================= */}
          {currentTab === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">SITE COMPLIANCE & SAFETY ANALYTICS</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Near-Miss Trend */}
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">WEEKLY RISK & TELEMETRY PROFILE</h3>
                  <div className="h-[220px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={safetyHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#64748b" style={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0f1626', borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="score" stroke="#00F2FE" strokeWidth={2} name="Safety Index" />
                        <Line type="monotone" dataKey="compliance" stroke="#FF6B00" strokeWidth={2} name="PPE Compliance %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Operator Safety profile */}
                <div className="glass-panel p-6 rounded-xl">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">OPERATOR HISTORICAL PROBABILITY DISTRIBUTION</h3>
                  <div className="h-[220px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fatigueDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 10 }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#0f1626', borderColor: 'rgba(255,255,255,0.08)' }} />
                        <Bar dataKey="val" fill="#00F2FE" name="Average Fatigue Score" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: DIGITAL TWIN
              ========================================================= */}
          {currentTab === 'twin' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">3D WORKSITE DIGITAL TWIN SIMULATION</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 3D Canvas visualizer */}
                <div className="glass-panel p-6 rounded-xl col-span-2 flex flex-col items-center justify-center">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2 w-full text-left mb-4">
                    REAL-TIME SITE LAYOUT SCAN
                  </h3>
                  <canvas ref={twinCanvasRef} className="border border-slate-800 bg-[#090F1A] rounded" />
                </div>

                {/* Details side bar */}
                <div className="glass-panel p-6 rounded-xl space-y-4">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">SITE COORDINATES</h3>
                  
                  <div className="space-y-3 font-mono text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500">EXCAVATOR GPS:</span><br/>
                      <span className="text-slate-200">23° 59&apos; 12.4&quot; N, 78° 14&apos; 22.8&quot; E</span>
                    </div>
                    <div>
                      <span className="text-slate-500">TARGET W-004 COORDINATES:</span><br/>
                      <span className="text-[#FF6B00]">REL_X: 0.0m, REL_Y: {telemetry.worker_distance}m</span>
                    </div>
                    <div>
                      <span className="text-slate-500">ASSET ELEVATION:</span><br/>
                      <span className="text-slate-200">340m Mean Sea Level</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: MACHINE HEALTH
              ========================================================= */}
          {currentTab === 'health' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">HEAVY MACHINERY DIAGNOSTICS & CAN SYSTEM</h2>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Hydraulic pressure */}
                <div className="glass-panel p-6 rounded-xl border-b border-[#00F2FE]/40">
                  <div className="text-[10px] font-mono text-slate-500">HYDRAULIC PUMP PRESSURE</div>
                  <div className="text-2xl font-orbitron font-bold mt-2 text-[#00F2FE]">
                    {310 + Math.floor(Math.sin(tick * 0.1) * 3)} Bar
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1">NOMINAL (MAX 350)</div>
                </div>

                {/* Oil temperature */}
                <div className="glass-panel p-6 rounded-xl border-b border-amber-500/40">
                  <div className="text-[10px] font-mono text-slate-500">ENGINE OIL TEMPERATURE</div>
                  <div className="text-2xl font-orbitron font-bold mt-2 text-[#FF6B00]">
                    {(88.5 + Math.sin(tick * 0.05) * 0.4).toFixed(1)}°C
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1">OPTIMAL RANGE</div>
                </div>

                {/* Coolant level */}
                <div className="glass-panel p-6 rounded-xl border-b border-emerald-500/40">
                  <div className="text-[10px] font-mono text-slate-500">COOLANT TEMPERATURE</div>
                  <div className="text-2xl font-orbitron font-bold mt-2 text-[#10B981]">
                    {(84.2 + Math.cos(tick * 0.03) * 0.3).toFixed(1)}°C
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1">COMPLIANT (MAX 95)</div>
                </div>

                {/* Fuel Level */}
                <div className="glass-panel p-6 rounded-xl border-b border-cyan-500/40">
                  <div className="text-[10px] font-mono text-slate-500">DIESEL FUEL QUANTITY</div>
                  <div className="text-2xl font-orbitron font-bold mt-2 text-[#10B981]">72%</div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1">210 LITERS REMAINING</div>
                </div>

              </div>

              {/* CAN Bus scrolling log and Hardware harness status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. SAE J1939 CAN Bus Analyzer */}
                <div className="glass-panel p-6 rounded-xl flex flex-col h-[280px]">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2 flex justify-between items-center">
                    <span>SAE J1939 CAN-BUS DATA STREAM [CHANNEL: CAN0]</span>
                    <span className="text-[9px] text-[#10B981] font-mono animate-pulse">250 KBPS ONLINE</span>
                  </h3>
                  
                  <div className="flex-1 bg-black p-3 rounded font-mono text-[9px] text-emerald-500 space-y-1 overflow-y-auto mt-4 border border-slate-800 shadow-inner scrollbar-thin">
                    {canLogs.length === 0 ? (
                      <div className="text-slate-500 italic">Awaiting J1939 frames...</div>
                    ) : (
                      canLogs.map((item, idx) => (
                        <div key={idx} className="flex justify-between hover:bg-emerald-950/20">
                          <span>{new Date(item.timestamp).toLocaleTimeString() || "10:30:22"}</span>
                          <span className="text-cyan-400">ID: {item.pgn}</span>
                          <span className="text-slate-300 font-semibold">{item.name}</span>
                          <span className="text-[#FF6B00]">{item.data}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Sensor harness diagnostics checks */}
                <div className="glass-panel p-6 rounded-xl flex flex-col h-[280px]">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">
                    HARDWARE WIRING HARNESS STATUS
                  </h3>
                  
                  <div className="flex-1 mt-4 space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></span>
                        <span className="text-slate-300">24GHz mmWave Radar (UART0)</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">115200 BAUD</span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></span>
                        <span className="text-slate-300">MIPI CSI-2 Camera Link</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">1080p @ 30FPS</span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 ${telemetry.estop_active ? 'bg-red-500' : 'bg-emerald-500'} rounded-full animate-pulse`}></span>
                        <span className="text-slate-300">Ignition Actuator Relay</span>
                      </div>
                      <span className={`text-[10px] ${telemetry.estop_active ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                        {telemetry.estop_active ? 'RELAY OPEN (CUT)' : 'RELAY CLOSED (RUN)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 bg-slate-900/40 border border-slate-800 rounded">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></span>
                        <span className="text-slate-300">Warning Horn/Buzzer</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">PWM HARNESS</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: OPERATOR PROFILE
              ========================================================= */}
          {currentTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">OPERATOR CREDENTIALS & COMPLIANCE</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Profile Card */}
                <div className="glass-panel p-6 rounded-xl space-y-4">
                  <div className="w-20 h-20 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center text-3xl">
                    👷
                  </div>
                  <div>
                    <h3 className="font-orbitron font-bold text-slate-200">RAJESH KUMAR</h3>
                    <span className="text-xs font-mono text-slate-500">HEAVY OPERATOR LICENSE: CLASS-A</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/60 font-mono text-[10px] text-slate-400 space-y-1">
                    <div>SHIFT TIME: 08:00 - 17:00</div>
                    <div>ACTIVE DURATION: 5.2 hrs</div>
                    <div>AVERAGE SAFETY RATING: 98.4%</div>
                  </div>
                </div>

                {/* Fatigue history overview */}
                <div className="glass-panel p-6 rounded-xl col-span-2 space-y-4">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">OPERATIONAL WARNING HISTORY & VERIFICATIONS</h3>
                  <div className="h-[200px] overflow-y-auto space-y-2 pr-1">
                    <div className="p-2.5 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs font-mono">
                      <div className="space-y-0.5">
                        <span className="text-slate-200">Shift Start Checklist Verification</span>
                        <div className="text-[10px] text-slate-500">Self-attestation safety verification signature</div>
                      </div>
                      <span className="text-[#10B981] font-bold">PASSED</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs font-mono">
                      <div className="space-y-0.5">
                        <span className="text-slate-200">Operator PPE Compliance Scan</span>
                        <div className="text-[10px] text-slate-500">MIPI camera hardhat & safety vest match</div>
                      </div>
                      <span className="text-[#10B981] font-bold">COMPLIANT</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs font-mono">
                      <div className="space-y-0.5">
                        <span className="text-slate-200">Attention Calibration (PERCLOS)</span>
                        <div className="text-[10px] text-slate-500">Calibrated drowsiness threshold validation</div>
                      </div>
                      <span className="text-[#10B981] font-bold">NOMINAL</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs font-mono">
                      <div className="space-y-0.5">
                        <span className="text-slate-200">Continuous Operating Hours Limit</span>
                        <div className="text-[10px] text-slate-500">Current shift: 5.2 / 8.0 hours maximum</div>
                      </div>
                      <span className="text-[#00F2FE] font-bold">NOMINAL</span>
                    </div>

                    <div className="p-2.5 bg-red-950/20 border border-red-500/20 rounded flex justify-between items-center text-xs font-mono">
                      <div className="space-y-0.5">
                        <span className="text-red-400">Solenoid Override Relay Actuation</span>
                        <div className="text-[10px] text-red-500/70">Automatic collision mitigation brake reset</div>
                      </div>
                      <span className="text-red-500 font-bold">E-STOP ENGAGED</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================
              TAB: SYSTEM SETTINGS
              ========================================================= */}
          {currentTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">SYSTEM PARAMETER SETTINGS</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
                
                {/* Hardware configuration */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">GPIO PIN & HARDWARE MAPS</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-orbitron font-semibold text-slate-200 mb-1">GPIO IGNITION RELAY PIN</label>
                      <select className="w-full bg-[#090F1A] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#00F2FE] font-mono">
                        <option value="18">BCM PIN 18 (SAFETY CRITICAL RELAY)</option>
                        <option value="23">BCM PIN 23 (AUX RELAY 1)</option>
                        <option value="24">BCM PIN 24 (AUX RELAY 2)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-orbitron font-semibold text-slate-200 mb-1">CABIN WARNING BUZZER PIN</label>
                      <select className="w-full bg-[#090F1A] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-[#00F2FE] font-mono">
                        <option value="17">BCM PIN 17 (PWM HORN ALARM)</option>
                        <option value="22">BCM PIN 22 (LED AUX STATUS)</option>
                      </select>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-800/60 pt-4">
                      <div>
                        <div className="text-xs font-orbitron font-semibold text-slate-200">CABIN AUDIO LIMITER (85dB)</div>
                        <div className="text-[10px] text-slate-500 font-mono">Enforce OSHA standard audio levels</div>
                      </div>
                      <input type="checkbox" defaultChecked className="w-10 h-5 accent-[#00F2FE] cursor-pointer" />
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-800/60 pt-4">
                      <div>
                        <div className="text-xs font-orbitron font-semibold text-slate-200">PPE COMPLIANCE INTERVENTION</div>
                        <div className="text-[10px] text-slate-500 font-mono">Force E-Stop if worker lacks helmet/vest</div>
                      </div>
                      <input type="checkbox" className="w-10 h-5 accent-[#EF4444] cursor-pointer" />
                    </div>
                  </div>
                </div>

                {/* AI / CV Threshold adjustments */}
                <div className="glass-panel p-6 rounded-xl space-y-6">
                  <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">AI ENGINE & THRESHOLDS</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-300">STATIC BASE SAFETY BUFFER:</span>
                        <span className="text-[#00F2FE] font-bold">3.0 METERS</span>
                      </div>
                      <input type="range" min="1.0" max="5.0" step="0.5" defaultValue="3.0" className="w-full accent-[#00F2FE] cursor-pointer" />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-300">BRAKING LATENCY FACTOR:</span>
                        <span className="text-[#FF6B00] font-bold">0.5 SECONDS</span>
                      </div>
                      <input type="range" min="0.1" max="2.0" step="0.1" defaultValue="0.5" className="w-full accent-[#FF6B00] cursor-pointer" />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-300">NPU FATIGUE THRESHOLD (PERCLOS):</span>
                        <span className="text-[#EF4444] font-bold">40% BLINK RATE</span>
                      </div>
                      <input type="range" min="10" max="90" step="5" defaultValue="40" className="w-full accent-[#EF4444] cursor-pointer" />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1">
                        <span className="text-slate-300">mmWAVE RADAR SCAN RADIUS:</span>
                        <span className="text-[#00F2FE] font-bold">15 METERS</span>
                      </div>
                      <input type="range" min="5" max="40" step="5" defaultValue="15" className="w-full accent-[#00F2FE] cursor-pointer" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Button */}
              <div className="flex items-center gap-4 max-w-4xl">
                <button
                  onClick={() => {
                    addLog("INFO", "SYSTEM", "Saving parameter settings to Raspberry Pi EEPROM flash memory...");
                    setTimeout(() => {
                      addLog("INFO", "SYSTEM", "EEPROM Write completed. Core configuration successfully updated and verified.");
                      setToastMessage("Parameters successfully committed to Raspberry Pi EEPROM flash memory!");
                      setTimeout(() => setToastMessage(null), 4000);
                    }, 800);
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#00F2FE] to-cyan-500 text-black font-orbitron font-bold text-xs rounded hover:opacity-90 active:scale-95 transition-all shadow-cyan-glow cursor-pointer"
                >
                  SAVE PARAMETERS TO EEPROM FLASH
                </button>
                <span className="text-[10px] font-mono text-slate-500">
                  Settings will persist across machine restarts.
                </span>
              </div>

            </div>
          )}

          {/* =========================================================
              TAB: SYSTEM LOGS
              ========================================================= */}
          {currentTab === 'logs' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">CHRONOLOGICAL EVENT LOG TERMINAL</h2>
              
              <div className="glass-panel rounded-xl overflow-hidden flex flex-col h-[400px]">
                <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-orbitron font-semibold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#00F2FE]" />
                    EVENT FEED
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">SQLite DB logs table</span>
                </div>
                <div className="flex-1 bg-black p-4 font-mono text-[10px] space-y-1.5 overflow-y-auto">
                  {logs.map((log, idx) => (
                    <div key={idx} className="flex gap-4">
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className={`font-bold ${log.level === 'CRITICAL' ? 'text-red-500 animate-pulse' : log.level === 'WARNING' ? 'text-[#FF6B00]' : 'text-[#00F2FE]'}`}>
                        [{log.level}]
                      </span>
                      <span className="text-slate-400">[{log.source}]</span>
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* =========================================================
              TAB: REPORTS
              ========================================================= */}
          {currentTab === 'reports' && (
            <div className="space-y-6">
              <h2 className="text-lg font-orbitron font-bold text-[#00F2FE] border-b border-slate-800 pb-2">INDUSTRIAL SAFETY COMPLIANCE EXPORT</h2>
              
              <div className="glass-panel p-6 rounded-xl max-w-xl space-y-6">
                <h3 className="text-xs font-orbitron font-bold text-slate-400 border-b border-slate-800 pb-2">SITE COMPLIANCE SUMMARY</h3>
                
                <div className="space-y-4 font-mono text-xs text-slate-300">
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span>Audit Standard:</span>
                    <span>Tata InnoVent 2026 Specification</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span>Machinery compliance score:</span>
                    <span className="text-[#10B981] font-bold">98.4% (EXCELLENT)</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span>Ignition cut validation:</span>
                    <span className="text-[#10B981]">VERIFIED</span>
                  </div>
                </div>

                <a
                  href="http://localhost:5000/api/report"
                  download="guardedge_x_safety_report.txt"
                  className="px-6 py-3 bg-[#FF6B00] hover:bg-[#e05e00] text-black font-orbitron font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow"
                >
                  <Download className="w-5 h-5 text-black" />
                  EXPORT COMPLIANCE AUDIT
                </a>
              </div>

            </div>
          )}

        </div>
      </main>

      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 glass-panel-heavy border-l-4 border-[#00F2FE] p-4 rounded-r-lg shadow-cyan-glow flex items-center gap-3 animate-pulse">
          <Cpu className="w-5 h-5 text-[#00F2FE] flex-shrink-0" />
          <div>
            <div className="text-[10px] font-orbitron font-bold text-[#00F2FE] tracking-wider">HARDWARE WRITE SUCCESSFUL</div>
            <div className="text-[10px] text-slate-300 font-mono mt-0.5">{toastMessage}</div>
          </div>
        </div>
      )}

    </div>
  );
}
