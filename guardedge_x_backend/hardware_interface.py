import time
import random

try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
except ImportError:
    HAS_GPIO = False

class HardwareController:
    def __init__(self, relay_pin=18, red_led_pin=23, orange_led_pin=24, buzzer_pin=25, trigger_pin=27, echo_pin=22):
        self.relay_pin = relay_pin
        self.red_led_pin = red_led_pin
        self.orange_led_pin = orange_led_pin
        self.buzzer_pin = buzzer_pin
        self.trigger_pin = trigger_pin
        self.echo_pin = echo_pin
        
        self.is_mock = not HAS_GPIO
        self.relay_state = False
        self.red_led_state = False
        self.orange_led_state = False
        self.buzzer_state = False
        
        print(f"Hardware Interface Initialized. Mode: {'RASPBERRY_PI_GPIO' if HAS_GPIO else 'MOCK_EMULATION'}")
        
        if HAS_GPIO:
            try:
                GPIO.setmode(GPIO.BCM)
                GPIO.setwarnings(False)
                GPIO.setup(self.relay_pin, GPIO.OUT, initial=GPIO.LOW)
                GPIO.setup(self.red_led_pin, GPIO.OUT, initial=GPIO.LOW)
                GPIO.setup(self.orange_led_pin, GPIO.OUT, initial=GPIO.LOW)
                GPIO.setup(self.buzzer_pin, GPIO.OUT, initial=GPIO.LOW)
                
                # Ultrasonic
                GPIO.setup(self.trigger_pin, GPIO.OUT)
                GPIO.setup(self.echo_pin, GPIO.IN)
                GPIO.output(self.trigger_pin, GPIO.LOW)
            except Exception as e:
                print(f"Error initializing physical GPIO pins: {e}. Switching to Mock mode.")
                self.is_mock = True

    def set_relay(self, state):
        """Emergency Stop Ignition Relay: True=CUT engine (danger), False=ON (safe)"""
        self.relay_state = bool(state)
        if self.is_mock:
            print(f"[GPIO MOCK] E-Stop Ignition Relay -> {'CRITICAL CUT-OFF (HIGH)' if state else 'CLOSED - RUN ENGINE (LOW)'}")
        else:
            GPIO.output(self.relay_pin, GPIO.HIGH if state else GPIO.LOW)

    def set_led(self, color, state):
        """Set LED status: red (danger), orange (warning)"""
        if self.is_mock:
            if color == "red":
                self.red_led_state = bool(state)
            elif color == "orange":
                self.orange_led_state = bool(state)
            return
            
        state_val = GPIO.HIGH if state else GPIO.LOW
        if color == "red":
            self.red_led_state = bool(state)
            GPIO.output(self.red_led_pin, state_val)
        elif color == "orange":
            self.orange_led_state = bool(state)
            GPIO.output(self.orange_led_pin, state_val)

    def set_buzzer(self, state):
        """Active buzzer warning alert"""
        self.buzzer_state = bool(state)
        if self.is_mock:
            if state:
                print("[GPIO MOCK] Warning Buzzer -> ACTIVE (85dB Alarm Sounding)")
        else:
            GPIO.output(self.buzzer_pin, GPIO.HIGH if state else GPIO.LOW)

    def read_ultrasonic(self):
        """Read proximity sensor in meters"""
        if self.is_mock:
            # Return random walk distance between 2.0 and 8.0 meters
            return round(random.uniform(2.0, 8.0), 2)
            
        try:
            # Trigger high pulse
            GPIO.output(self.trigger_pin, GPIO.HIGH)
            time.sleep(0.00001)
            GPIO.output(self.trigger_pin, GPIO.LOW)
            
            start_time = time.time()
            stop_time = time.time()
            
            # Wait for Echo to go high
            timeout = time.time() + 0.1
            while GPIO.input(self.echo_pin) == 0:
                start_time = time.time()
                if start_time > timeout:
                    return 9.99 # Timeout

            # Wait for Echo to go low
            timeout = time.time() + 0.1
            while GPIO.input(self.echo_pin) == 1:
                stop_time = time.time()
                if stop_time > timeout:
                    return 9.99

            # Calculate pulse width
            duration = stop_time - start_time
            # Speed of sound is 343 m/s, distance is duration * speed / 2
            distance = (duration * 343.0) / 2.0
            return round(distance, 2)
        except Exception as e:
            print(f"Error reading ultrasonic: {e}")
            return 9.99

    def read_radar(self):
        """mmWave Radar reading distance (meters) and velocity (m/s)"""
        # mmWave Radar is connected via Serial UART in production.
        # Here we mock it or provide a simulated reading.
        # The radar is highly resistant to dust and rain.
        if self.is_mock:
            return {
                "distance": round(random.uniform(3.0, 12.0), 2),
                "velocity": round(random.uniform(-2.0, 2.0), 2),
                "status": "ACTIVE_TRACK"
            }
        else:
            # Emulated Serial return
            return {
                "distance": round(random.uniform(2.5, 10.0), 2),
                "velocity": round(random.uniform(-1.5, 1.5), 2),
                "status": "ACTIVE_TRACK"
            }

    def cleanup(self):
        if not self.is_mock and HAS_GPIO:
            try:
                GPIO.cleanup()
                print("GPIO Pins cleaned up successfully.")
            except Exception as e:
                print(f"Error on GPIO cleanup: {e}")

if __name__ == "__main__":
    controller = HardwareController()
    controller.set_relay(True)
    time.sleep(0.5)
    controller.set_relay(False)
    print(f"Ultrasonic Distance: {controller.read_ultrasonic()}m")
    controller.cleanup()
