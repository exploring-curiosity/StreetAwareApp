import paramiko
import threading

# Dictionary to track active SSH connections
active_connections = {}

def ssh_into_device(host, username, password, command):
    try:
        # Initialize SSH client
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        # Connect to the device
        client.connect(hostname=host, username=username, password=password, timeout=10)
        print(f"Connected to {host}")

        # Store client reference for termination
        active_connections[host] = client

        # Execute command
        stdin, stdout, stderr = client.exec_command(command)

        # Read and print the output in real-time
        print(f"Real-time output from {host}:")
        for line in iter(stdout.readline, ""):
            print(line, end="")  # Print each line as it's received
            if host not in active_connections:  # Stop if connection is removed
                break

        # Read any errors in real-time
        for line in iter(stderr.readline, ""):
            print(f"Error from {host}: {line}", end="")
            if host not in active_connections:
                break

        # Close connection
        client.close()
        del active_connections[host]  # Remove from active connections
        print(f"Disconnected from {host}")

    except Exception as e:
        print(f"Failed to connect to {host}: {e}")

# Function to listen for user input and stop sessions
def user_input_listener():
    while True:
        user_input = input().strip()
        if user_input.startswith("stop "):
            host_to_stop = user_input.split(" ")[1]
            if host_to_stop in active_connections:
                print(f"Stopping connection to {host_to_stop}...")
                active_connections[host_to_stop].close()
                del active_connections[host_to_stop]
            else:
                print(f"No active session for {host_to_stop}")

# List of devices
devices = [
    {"host": "192.168.0.184", "username": "reip", "password": "reip"},
    {"host": "192.168.0.227", "username": "reip", "password": "reip"}
]

# Command to run on each device
command_to_run = "cd software/reip-pipelines/smart-filter && python3 filter.py"

# Start user input listener in a separate thread
input_thread = threading.Thread(target=user_input_listener, daemon=True)
input_thread.start()

# Create and start SSH threads
threads = []
for device in devices:
    thread = threading.Thread(target=ssh_into_device, args=(device["host"], device["username"], device["password"], command_to_run))
    thread.start()
    threads.append(thread)

# Wait for all SSH threads to finish
for thread in threads:
    thread.join()

print("SSH session completed for all devices.")
