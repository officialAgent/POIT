from flask import Flask, render_template, session, request, jsonify, url_for
from flask_socketio import SocketIO, emit, disconnect
import time
import json
import threading
import serial  # Import the serial module

async_mode = None

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode=async_mode, cors_allowed_origins="*")
thread = None
thread_lock = threading.Lock()

ser = None
set_temperature = 0  # Global variable to store the set temperature
serial_open = False  # Flag to check if serial is open
btn_value = None  # Global variable to store button value
connection_state = "Disconnected"  # Global variable to store connection state

def open_serial_connection():
    global ser, serial_open, connection_state
    if not serial_open:
        ser = serial.Serial("/dev/ttyS0", 9600)
        time.sleep(1)
        serial_open = True
        connection_state = "Connected"

def close_serial_connection():
    global ser, serial_open, connection_state
    if serial_open:
        ser.close()
        serial_open = False
        connection_state = "Disconnected"

def write_to_file(temperature, humidity):
    with open("data_log.txt", "a") as file:
        file.write(f"{time.time()},{temperature},{humidity}\n")

def background_thread():
    count = 0
    global ser, set_temperature, serial_open, btn_value

    while True:
        if serial_open:
            try:
                Uart = ser.readline().strip().decode('utf-8')
                data = json.loads(Uart)
                humidity = data['humidity']
                temperature = data['temperature']
                print(f"Humidity: {humidity}, Temperature: {temperature}")

                ac_status = 'Cooling' if temperature > set_temperature else 'Heating'

                if btn_value == "start":
                    count += 1
                    socketio.emit('my_response', {'humidity': humidity, 'temperature': temperature, 'count': count, 'ac_status': ac_status}, namespace='/test')
                    write_to_file(temperature, humidity)
                else:
                    time.sleep(0.1)

            except serial.SerialException:
                print("Serial connection lost.")
                serial_open = False
            except json.JSONDecodeError:
                print("Failed to decode JSON.")
            except KeyError as e:
                print(f"Missing key in JSON data: {e}")
            except Exception as e:
                print(f"Unexpected error: {e}")
        else:
            time.sleep(0.1)

@app.route('/')
def index():
    return render_template('index.html', async_mode=socketio.async_mode)

@app.route('/get_file_data', methods=['GET'])
def get_file_data():
    data = []
    print("FILE GET DATA")
    try:
        with open('data_log.txt', 'r') as file:
            for line in file:
                timestamp, temperature, humidity = line.strip().split(',')
                data.append({
                    'timestamp': float(timestamp),
                    'temperature': float(temperature),
                    'humidity': float(humidity)
                })
    except Exception as e:
        print(f"Error reading file: {e}")
        return jsonify({'error': str(e)})
    return jsonify(data)



@socketio.on('click_start', namespace='/test')
def handle_start(message):
    global btn_value
    btn_value = message['value']

@socketio.on('click_stop', namespace='/test')
def handle_stop(message):
    global btn_value
    btn_value = message['value']

@socketio.on('open_serial', namespace='/test')
def handle_open_serial(message):
    open_serial_connection()
    emit('serial_open_ack', {'status': 'Serial connection opened', 'connection_state': connection_state, 'btn_value': btn_value})

@socketio.on('set_temperature', namespace='/test')
def handle_set_temperature(message):
    global set_temperature
    set_temperature = float(message['value'])
    print(f"Set temperature to: {set_temperature}")
    emit('set_temperature_ack', {'status': 'Temperature set', 'set_temperature': set_temperature})

@socketio.on('view')
def graph():
    return render_template('graph.html')

@socketio.on('disconnect_request', namespace='/test')
def handle_disconnect_request():
    close_serial_connection()
    emit('serial_disconnect_ack', {'status': 'Serial connection closed', 'connection_state': connection_state})
    disconnect()

@socketio.on('connect', namespace='/test')
def handle_connect():
    global thread
    with thread_lock:
        if thread is None:
            thread = socketio.start_background_task(target=background_thread)
    emit('connection_state', {'state': connection_state, 'btn_value': btn_value})

@socketio.on('disconnect', namespace='/test')
def handle_disconnect():
    print('Client disconnected', request.sid)

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=800, debug=True)