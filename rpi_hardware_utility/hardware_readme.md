# Raspberry Pi 5 Hardware Testing Utilities

This directory contains standalone Python utilities to test individual physical sensor and actuator components on your Raspberry Pi 5 before executing the complete GuardEdge X HMI platform.

---

## 🔌 1. GPIO Relay & Buzzer Diagnostic

Test BCM Pin 18 (E-Stop ignition control relay) and BCM Pin 17 (PWM alert buzzer) to confirm proper electrical insulation and wiring.

### Wiring Configuration
* **Relay Signal Line** ===> **GPIO BCM 18** (Physical pin 12)
* **Buzzer Signal Line** ===> **GPIO BCM 17** (Physical pin 11)
* **Common Ground**     ===> **GND** (Physical pin 9 or 14)
* **VCC (5V/3.3V)**     ===> **5V Power** (Physical pin 2 or 4)

### Execution
Run the following script on your Raspberry Pi terminal:
```bash
sudo python3 test_gpio_relay.py
```
*The script will cycle through Warning, Critical (E-Stop activated), and Nominal operating states every few seconds.*

---

## 📡 2. mmWave Radar UART Diagnostic

Test communications and range readings from the 24GHz mmWave radar module (SEN0395).

### Wiring Configuration
* **Sensor TXD Line**   ===> **GPIO BCM 15 (RXD)** (Physical pin 10)
* **Sensor RXD Line**   ===> **GPIO BCM 14 (TXD)** (Physical pin 8)
* **Common Ground**     ===> **GND** (Physical pin 6)
* **VCC (5V)**          ===> **5V Power** (Physical pin 4)

### Serial Setup
Ensure the Raspberry Pi hardware serial interface is enabled:
1. Run `sudo raspi-config`
2. Navigate to: **Interface Options** -> **Serial Port**
3. Select **No** to: "Would you like a login shell to be accessible over serial?"
4. Select **Yes** to: "Would you like the serial port hardware to be enabled?"
5. Reboot the Pi: `sudo reboot`

### Execution
Run the following command:
```bash
python3 test_mmwave_radar.py
```
*The script will issue the initialization command 'sensorStart' to the SEN0395 module and write the real-time distance and tracking logs to the screen.*
