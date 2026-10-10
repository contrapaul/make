"""Classroom doorway counter.

HC-SR04 counts people passing a doorway, three buttons adjust the total,
four LEDs give feedback, an SSD1306 shows the count, and a small web
server on the local network serves a live dashboard.

Counting, buttons, LEDs and the OLED all work with no network at all --
WiFi is best effort and never blocks the loop.
"""

import json
import time

import board
import busio
import digitalio
import displayio
import terminalio

from i2cdisplaybus import I2CDisplayBus
from adafruit_displayio_ssd1306 import SSD1306
from adafruit_display_text import label
import adafruit_hcsr04


# --- pins ------------------------------------------------------------------
# GPIO 3 is skipped: it is an ESP32-S3 strapping pin.
PIN_TRIG = board.IO1
PIN_ECHO = board.IO2
PIN_SDA = board.IO4
PIN_SCL = board.IO5

# IO7 and IO8 are not broken out without soldering on this board.
PIN_BTN_RESET = board.IO6
PIN_BTN_PLUS = board.IO9
PIN_BTN_MINUS = board.IO10

PIN_LED_DETECT = board.IO13


# --- config ----------------------------------------------------------------
DEFAULTS = {
    "device_name": "Doorway Counter",
    "display": {"width": 128, "height": 64, "address": 0x3C},
    "sensor": {
        "trigger_cm": 80,
        "clear_cm": 95,
        "confirm_readings": 2,
        "min_gap_s": 0.35,
        "poll_s": 0.06,
    },
    "leds": {"detect_flash_s": 1.0, "button_flash_s": 0.25},
}


def load_config():
    cfg = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    try:
        with open("/config.json") as f:
            user = json.load(f)
    except (OSError, ValueError) as err:
        print("config.json not loaded, using defaults:", err)
        return cfg
    for key, value in user.items():
        if isinstance(value, dict) and isinstance(cfg.get(key), dict):
            cfg[key].update(value)
        else:
            cfg[key] = value
    return cfg


CONFIG = load_config()
SENSOR = CONFIG["sensor"]
LEDS = CONFIG["leds"]


# --- hardware --------------------------------------------------------------
def make_led(pin):
    led = digitalio.DigitalInOut(pin)
    led.direction = digitalio.Direction.OUTPUT
    led.value = False
    return led


def make_button(pin):
    btn = digitalio.DigitalInOut(pin)
    btn.direction = digitalio.Direction.INPUT
    btn.pull = digitalio.Pull.UP  # pressed reads False
    return btn


led_detect = make_led(PIN_LED_DETECT)

btn_reset = make_button(PIN_BTN_RESET)
btn_plus = make_button(PIN_BTN_PLUS)
btn_minus = make_button(PIN_BTN_MINUS)

sonar = adafruit_hcsr04.HCSR04(
    trigger_pin=PIN_TRIG, echo_pin=PIN_ECHO, timeout=0.05
)

displayio.release_displays()
i2c = busio.I2C(PIN_SCL, PIN_SDA)
display = SSD1306(
    I2CDisplayBus(i2c, device_address=CONFIG["display"]["address"]),
    width=CONFIG["display"]["width"],
    height=CONFIG["display"]["height"],
)


# --- screen ----------------------------------------------------------------
screen = displayio.Group()
title = label.Label(terminalio.FONT, text=CONFIG["device_name"], x=2, y=6)
count_text = label.Label(terminalio.FONT, text="0", scale=4, x=4, y=34)
status_text = label.Label(terminalio.FONT, text="starting...", x=2, y=58)
screen.append(title)
screen.append(count_text)
screen.append(status_text)
display.root_group = screen


# --- state -----------------------------------------------------------------
count = 0
detections = 0  # sensor-driven counts only, ignores manual edits
last_event = "boot"
last_event_at = time.monotonic()
last_distance = None

present = False  # someone is currently in the beam
streak = 0  # consecutive readings agreeing with a state change
last_count_at = 0.0
next_sensor_poll = 0.0

led_off_at = {}  # led object -> monotonic deadline
button_prev = {btn_reset: True, btn_plus: True, btn_minus: True}
button_settle = {btn_reset: 0.0, btn_plus: 0.0, btn_minus: 0.0}
DEBOUNCE_S = 0.05

ip_address = None
server = None


def flash(led, seconds):
    """Never cut an in-progress flash short."""
    led.value = True
    deadline = time.monotonic() + seconds
    led_off_at[led] = max(deadline, led_off_at.get(led, 0.0))


def note(event):
    global last_event, last_event_at
    last_event = event
    last_event_at = time.monotonic()


def apply(delta=None, reset=False, source="manual"):
    """Single funnel for every change to the count."""
    global count, detections
    if reset:
        count = 0
    else:
        count = max(0, count + delta)
        if source == "sensor":
            detections += 1
    note(("reset" if reset else ("+1" if delta > 0 else "-1")) + " (" + source + ")")


# --- inputs ----------------------------------------------------------------
def poll_buttons(now):
    for btn, action in (
        (btn_reset, "reset"),
        (btn_plus, "plus"),
        (btn_minus, "minus"),
    ):
        value = btn.value
        if value == button_prev[btn] or now < button_settle[btn]:
            continue
        button_prev[btn] = value
        button_settle[btn] = now + DEBOUNCE_S
        if value:  # released
            continue
        flash(led_detect, LEDS["button_flash_s"])
        if action == "reset":
            apply(reset=True, source="button")
        elif action == "plus":
            apply(1, source="button")
        else:
            apply(-1, source="button")


def poll_sensor(now):
    """Edge-triggered: count once when the beam is broken, not while held."""
    global next_sensor_poll, present, streak, last_distance, last_count_at

    if now < next_sensor_poll:
        return
    next_sensor_poll = now + SENSOR["poll_s"]

    try:
        distance = sonar.distance
    except RuntimeError:
        return  # no echo this cycle; common and harmless
    last_distance = distance

    wants_present = distance < SENSOR["trigger_cm"]
    wants_clear = distance > SENSOR["clear_cm"]

    if present:
        streak = streak + 1 if wants_clear else 0
        if streak >= SENSOR["confirm_readings"]:
            present = False
            streak = 0
        return

    streak = streak + 1 if wants_present else 0
    if streak >= SENSOR["confirm_readings"]:
        present = True
        streak = 0
        if now - last_count_at >= SENSOR["min_gap_s"]:
            last_count_at = now
            apply(1, source="sensor")
            flash(led_detect, LEDS["detect_flash_s"])


def poll_leds(now):
    for led, deadline in list(led_off_at.items()):
        if now >= deadline:
            led.value = False
            del led_off_at[led]


# --- display ---------------------------------------------------------------
shown_count = None
shown_status = None


def refresh_display():
    global shown_count, shown_status
    if count != shown_count:
        count_text.text = str(count)
        shown_count = count
    status = ip_address if ip_address else "offline"
    if status != shown_status:
        status_text.text = status
        shown_status = status


# --- network ---------------------------------------------------------------
def snapshot():
    return {
        "device": CONFIG["device_name"],
        "count": count,
        "detections": detections,
        "present": present,
        "distance_cm": round(last_distance, 1) if last_distance else None,
        "last_event": last_event,
        "seconds_since_event": round(time.monotonic() - last_event_at, 1),
        "uptime_s": round(time.monotonic(), 1),
        "ip": ip_address,
    }


def start_server():
    global ip_address, server

    import os
    import wifi
    import socketpool
    from adafruit_httpserver import Server, Request, JSONResponse, FileResponse, GET, POST

    ssid = os.getenv("CIRCUITPY_WIFI_SSID")
    password = os.getenv("CIRCUITPY_WIFI_PASSWORD")
    if not ssid:
        print("No CIRCUITPY_WIFI_SSID in settings.toml; running offline.")
        return

    wifi.radio.connect(ssid, password)
    ip_address = str(wifi.radio.ipv4_address)
    print("Dashboard at http://" + ip_address)

    pool = socketpool.SocketPool(wifi.radio)
    srv = Server(pool, "/www", debug=False)

    @srv.route("/", GET)
    def _index(request: Request):
        return FileResponse(request, "/index.html", "/www")

    @srv.route("/api/state", GET)
    def _state(request: Request):
        return JSONResponse(request, snapshot())

    @srv.route("/api/action", POST)
    def _action(request: Request):
        body = request.json() or {}
        action = body.get("action")
        if action == "reset":
            apply(reset=True, source="web")
        elif action == "plus":
            apply(1, source="web")
        elif action == "minus":
            apply(-1, source="web")
        elif action == "set":
            apply(int(body.get("count", count)) - count, source="web")
        else:
            return JSONResponse(request, {"error": "unknown action"})
        return JSONResponse(request, snapshot())

    srv.start(ip_address, port=80)
    server = srv


try:
    start_server()
except Exception as err:  # noqa: BLE001 - never let the network kill the counter
    print("WiFi unavailable, running offline:", err)

note("ready")


# --- main ------------------------------------------------------------------
while True:
    tick = time.monotonic()
    poll_buttons(tick)
    poll_sensor(tick)
    poll_leds(tick)
    refresh_display()
    if server is not None:
        try:
            server.poll()
        except Exception as err:  # noqa: BLE001
            print("server.poll:", err)
