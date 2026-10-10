# Classroom Doorway Counter

An ESP32-S3 Super Mini (running CircuitPython, flashed with the Waveshare
ESP32-S3-Zero build) counts people passing an ultrasonic sensor, shows the
running total on an OLED, flashes an LED on each detection, and serves a live
dashboard to anyone on the same WiFi.

## Parts

| Qty | Part | Notes |
| --- | --- | --- |
| 1 | ESP32-S3 Super Mini | CircuitPython 9 or 10 |
| 1 | HC-SR04 ultrasonic sensor | **needs 5 V** |
| 1 | SSD1306 128x64 I2C OLED | **run it at 3.3 V**, see warning below |
| 1 | LED | flashes on each detection |
| 1 | 220 Ω resistor | use 150 Ω for a blue/white LED |
| 1 | 1 kΩ resistor | ECHO divider, upper leg |
| 1 | 2 kΩ resistor | ECHO divider, lower leg |
| 3 | Tactile push buttons | no external pull-ups needed |
| 1 | Breadboard power supply | 3.3 V and 5 V rails |

## Two safety rules

1. **The HC-SR04 ECHO pin outputs 5 V and will damage a 3.3 V GPIO.** It must
   go through the divider described below. TRIG is an input on the sensor, so
   a 3.3 V signal straight from the ESP32 is fine.
2. **Power the OLED from 3.3 V, not 5 V.** Its I2C pull-up resistors go to
   whatever you feed VCC. At 5 V it would pull SDA/SCL to 5 V and cook the
   ESP32's pins even though the module is "5 V tolerant".

## Pin map

GPIO 3 is deliberately unused — it is an ESP32-S3 strapping pin. IO7 and IO8
are skipped because they are not broken out without soldering on this board.

| ESP32 pin | Connects to |
| --- | --- |
| IO1 | HC-SR04 TRIG (direct) |
| IO2 | HC-SR04 ECHO **via divider** |
| IO4 | OLED SDA |
| IO5 | OLED SCL |
| IO6 | Reset button → GND |
| IO9 | +1 button → GND |
| IO10 | −1 button → GND |
| IO13 | LED → 220 Ω → GND |
| 3V3 | OLED VCC |
| GND | common ground rail |

IO11 and IO12 are free when you add the per-button LEDs back.

Buttons use the ESP32's internal pull-ups, so each button is simply
`GPIO → button → GND`. Pressed reads low.

LEDs: long leg (anode) to the GPIO, short leg (cathode) through the resistor
to the ground rail.

## The ECHO voltage divider

```
HC-SR04 ECHO ──[ 1 kΩ ]──┬── IO2
                         │
                      [ 2 kΩ ]
                         │
                        GND
```

5 V × 2k/(1k+2k) = 3.33 V. If you have a 1.8 kΩ instead of the 2 kΩ, use it —
that gives 3.21 V, a little more margin.

## Power

- **While developing:** power the board over USB. Run the breadboard supply
  as well for the sensor's 5 V, and **tie its ground rail to an ESP32 GND
  pin.** Without a common ground the sensor readings are garbage.
- **Deployed:** unplug USB and feed the breadboard supply's 5 V into the
  board's 5 V pin. Do not do both at once.

## Files on the CIRCUITPY drive

```
/code.py
/config.json
/settings.toml          <- from settings.toml.example, holds your WiFi
/www/index.html
/lib/adafruit_hcsr04.mpy
/lib/adafruit_displayio_ssd1306.mpy
/lib/adafruit_display_text/
/lib/adafruit_httpserver/
```

Grab the libraries from the [CircuitPython library
bundle](https://circuitpython.org/libraries) matching your CircuitPython
major version. `circup install adafruit_hcsr04 adafruit_displayio_ssd1306
adafruit_display_text adafruit_httpserver` does it in one line if you have
`circup`.

## Confirm your pin names first

The board module differs between board definitions. Open the serial console
and run:

```python
import board
dir(board)
```

If you see `IO1`, `IO2`, … you are good. If the names differ, adjust the
pin block at the top of `code.py`.

## Tuning the sensor

Everything worth changing lives in `config.json`; no code edits needed.

- `trigger_cm` — a reading below this means someone is in the beam. Set it to
  roughly 70% of the doorway width so the far door frame never trips it.
- `clear_cm` — must be above `trigger_cm`. The gap between the two is
  hysteresis and is what stops one person from being counted twice.
- `confirm_readings` — consecutive agreeing readings before the state flips.
  Raise it if you get phantom counts, lower it if fast walkers are missed.
- `min_gap_s` — minimum time between two sensor counts.

## Web API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/` | – | the dashboard |
| GET | `/api/state` | – | state JSON |
| POST | `/api/action` | `{"action": "plus"\|"minus"\|"reset"}` | state JSON |
| POST | `/api/action` | `{"action": "set", "count": 42}` | state JSON |

State JSON:

```json
{
  "device": "Doorway Counter",
  "count": 12,
  "detections": 11,
  "present": false,
  "distance_cm": 142.3,
  "last_event": "+1 (sensor)",
  "seconds_since_event": 3.4,
  "uptime_s": 812.5,
  "ip": "192.168.1.47"
}
```

The device prints its IP to the serial console at boot and shows it on the
bottom line of the OLED. Open that address in a browser on the same network.

## Known limitations

- The count lives in RAM and resets when the board reboots. CircuitPython
  cannot write to its own filesystem while the USB drive is mounted, so
  persistence needs a `boot.py` that calls `storage.remount("/", False)` —
  which then makes the drive read-only from your computer. Left out on
  purpose.
- One HC-SR04 cannot tell direction. It counts crossings, not ins and outs.
  Two sensors a few inches apart would give you direction.
