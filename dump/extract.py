import pyshark

# Path to your pcapng file
pcapng_file = 'openocd_init_halt_exit_filtered.pcapng'

# Load the capture file
capture = pyshark.FileCapture(pcapng_file, use_json = True, include_raw = True)

# Extract the leftover capture data field from each packet
leftover_capture_data = []

for packet in capture:
    # Get the raw packet data
    raw_data = packet.get_raw_packet()
    # Extract anything after the first 64 bytes
    leftover_data = raw_data[64:]
    original_length = len(leftover_data)
    while leftover_data and leftover_data[-1] == 0:
        leftover_data = leftover_data[:-1]
    # Convert to uppercase hex string with 0x prefix
    hex_data = ', '.join(f'0x{byte:02X}' for byte in leftover_data)
    # Prepend the length of the leftover data
    output_line = f'{original_length}, {hex_data}'
    leftover_capture_data.append(output_line)

# Close the capture file
capture.close()

# Print the extracted data
for data in leftover_capture_data:
    print(data)
