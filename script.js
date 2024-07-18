document.addEventListener("DOMContentLoaded", function() {
    if (typeof SharedArrayBuffer === "undefined") {
        // For security reasons, not available unless certain headers are set (see serv/https_server.py)
        // TODO: improve warning
        updateStatus("Error: SharedArrayBuffer is not available.", "status-failed");
        disableConnectButton();
        return;
    }

    if (typeof navigator.usb === "undefined") {
        // Not supported by Firefox, mostly just Chrome
        // TODO: improve warning, add link to availability
        updateStatus("Error: WebUSB is not supported by your browser.", "status-failed");
        disableConnectButton();
        return;
    }
});

let stlink;
document.getElementById("connect").addEventListener("click", async () => {
    try {
        // WebUSB requires user permission/interaction for USB device access
        // Filter for devices with ST vendor ID
        await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0483 }]
        });

        const loglevel = 0;

        stlink = await stlink_open_usb(loglevel, 1, null, 0);
        if (stlink === 0) {
            throw new Error("Could not connect to ST-LINK");
        }
        updateStatus("Status: Device Connected", "status-connected");

        stlink_printVersion(stlink);

    } catch (error) {
        console.error(error);
        updateStatus("Status: Connection Failed", "status-failed");
    }
});

async function cmdTransfer(device, type, length, ...values) {
    try {
        let transfer;
        if (type === "out") {
            if (values.length > length) {
                console.warn("Number of values exceeds specified length. Extra values will be truncated.");
            }
            // Pad command to length with 0-Bytes
            let arr = new Uint8Array(length);
            arr.set(values.slice(0, length));

            transfer = await device.transferOut(0x01, arr);
        } else if (type === "in") {
            transfer = await device.transferIn(0x01, length);
        } else {
            throw new Error("Invalid transfer type");
        }

        if (transfer.status !== "ok") {
            throw new Error("Transfer failed");
        }

        if (type === "in") {
            console.log(`Command-${type} return:`, new Uint8Array(transfer.data.buffer));
        }
    } catch (error) {
        console.error(`Command-${type} error:`, error.message);
    }
}

function updateStatus(message, statusClass) {
    const statusDiv = document.getElementById("status");
    statusDiv.innerText = message;
    statusDiv.className = statusClass;
}

function disableConnectButton() {
    const connectButton = document.getElementById('connect');
    connectButton.disabled = true;
}
