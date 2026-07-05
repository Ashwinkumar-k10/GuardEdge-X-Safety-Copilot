#!/usr/bin/env python3
import time
import sys

try:
    import serial
except ImportError:
    print("pyserial module not found! Please run 'pip install pyserial' on your Raspberry Pi.")
    sys.exit(1)

# Default serial port config for Raspberry Pi 5
# On Pi 5, the primary hardware UART TX/RX pins map to '/dev/ttyAMA0' or '/dev/serial0'
SERIAL_PORT = "/dev/serial0"
BAUD_RATE = 115200

def test_radar_connection():
    print("--------------------------------------------------")
    print("|   GUARDEDGE X: mmWAVE RADAR UART DIAGNOSTIC   |")
    print("--------------------------------------------------")
    print(f"Connecting to sensor: {SERIAL_PORT} @ {BAUD_RATE} bps...")
    
    try:
        # Establish connection with 1-second read timeout
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1.0)
        time.sleep(0.5) # Allow serial link to stabilize
        
        # Flush buffers
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        print("Serial link established. Requesting sensor status...")
        
        # Send read range configuration commands to DFRobot SEN0395 module
        # Commands are terminated with CRLF
        ser.write(b"sensorStart\r\n")
        time.sleep(0.1)
        
        # Read initialization response
        response = ser.read_all().decode("utf-8", errors="ignore")
        if response:
            print(f"Sensor Response:\n{response.strip()}")
        
        print("\nStarting live coordinate stream... (Press Ctrl+C to terminate)")
        
        while True:
            # Poll lines from the serial stream
            if ser.in_waiting > 0:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if line:
                    # Clean and output target distance logs
                    # DFRobot SEN0395 prints 'Target: x.xx m' or relative velocity frames
                    print(f"[RADAR FEED] {line}")
            time.sleep(0.05)
            
    except serial.SerialException as e:
        print(f"\nSerial Port Error: {e}")
        print("Check list:")
        print("1. Are the RX/TX physical wires crossed? (Pi TX to Sensor RX, and vice-versa)")
        print("2. Is the serial port enabled in Raspberry Pi Config (`sudo raspi-config` -> Interface Options -> Serial)?")
        print("3. Is the correct dev port specified (e.g. /dev/ttyAMA0)?")
    except KeyboardInterrupt:
        print("\nClosing radar serial stream...")
    finally:
        try:
            # Send stop command to sensor to standby power
            ser.write(b"sensorStop\r\n")
            ser.close()
            print("Serial port closed safely.")
        except NameError:
            pass

if __name__ == "__main__":
    test_radar_connection()
