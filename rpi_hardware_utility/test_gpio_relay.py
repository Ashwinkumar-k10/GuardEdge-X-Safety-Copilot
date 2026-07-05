#!/usr/bin/env python3
import time
import sys

try:
    import RPi.GPIO as GPIO
except ImportError:
    print("RPi.GPIO not found! Please run 'pip install RPi.GPIO' on your Raspberry Pi.")
    sys.exit(1)

# GPIO BCM Pin Mappings
RELAY_PIN = 18   # BCM Pin 18: Solenoid E-Stop override relay
BUZZER_PIN = 17  # BCM Pin 17: Cabin warning buzzer

def setup_hardware():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    
    # Configure pins as outputs
    GPIO.setup(RELAY_PIN, GPIO.OUT)
    GPIO.setup(BUZZER_PIN, GPIO.OUT)
    
    # Ensure they start in the nominal (inactive) state
    GPIO.output(RELAY_PIN, GPIO.LOW)
    GPIO.output(BUZZER_PIN, GPIO.LOW)

def run_diagnostic_test():
    print("--------------------------------------------------")
    print("|   GUARDEDGE X: RASPBERRY PI GPIO DIAGNOSTIC TOOL  |")
    print("--------------------------------------------------")
    print(f"BCM Pin 18 -> Solenoid Relay Actuator")
    print(f"BCM Pin 17 -> Cabin Alarm Buzzer")
    print("\nStarting diagnostic loop (Press Ctrl+C to terminate)...")
    
    try:
        while True:
            # 1. Trigger Warning state (Buzzer ON, Relay NOMINAL)
            print("\n[ALERT] Simulating Warning Threshold...")
            print("Action: Warning buzzer active, engine relay closed (running).")
            GPIO.output(BUZZER_PIN, GPIO.HIGH)
            GPIO.output(RELAY_PIN, GPIO.LOW)
            time.sleep(2.0)
            
            # 2. Trigger Critical state (Buzzer ON, Relay OPEN / E-STOP)
            print("[CRITICAL] Simulating Danger Collision Breach...")
            print("Action: Warning buzzer active, Solenoid relay OPEN (IGNITION CUT).")
            GPIO.output(BUZZER_PIN, GPIO.HIGH)
            GPIO.output(RELAY_PIN, GPIO.HIGH)
            time.sleep(3.0)
            
            # 3. Reset to safe state
            print("[NOMINAL] Restoring safe operating parameters...")
            print("Action: All alarms disabled, engine relay closed (running).")
            GPIO.output(BUZZER_PIN, GPIO.LOW)
            GPIO.output(RELAY_PIN, GPIO.LOW)
            time.sleep(3.0)
            
    except KeyboardInterrupt:
        print("\nHalting diagnostics...")
    finally:
        # Clean up GPIO settings on exit
        GPIO.output(RELAY_PIN, GPIO.LOW)
        GPIO.output(BUZZER_PIN, GPIO.LOW)
        GPIO.cleanup()
        print("GPIO pins successfully reset to safe state. Diagnostics completed.")

if __name__ == "__main__":
    setup_hardware()
    run_diagnostic_test()
