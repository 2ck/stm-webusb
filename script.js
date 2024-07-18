let device;
document.addEventListener("DOMContentLoaded", function() {
    if (typeof navigator.usb === "undefined") {
        // Not supported by Firefox, mostly just Chrome
        // TODO: improve warning, add link to availability
        updateStatus("Error: WebUSB is not supported by your browser.", "status-failed");
        disableConnectButton();
        return;
    }
});

document.getElementById("connect").addEventListener("click", async () => {
    try {
        // WebUSB requires user permission/interaction for USB device access
        // Filter for devices with ST vendor ID
        device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0483 }]
        });

        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);

        updateStatus("Status: Device Connected", "status-connected");

        // Probably: Get version/status
        cmdTransfer(device, "out", 16, 0xF1);
        cmdTransfer(device, "in", 6);

        // Probably: Some reset
        // from manual: Green LED ON after a successful target communication initialization
        cmdTransfer(device, "out", 16, 0xF2, 0x30, 0xA3);
        cmdTransfer(device, "in", 2);

        // Probably: Communication/debug mode activation
        // from manual: Blinking red/green during communication with the target
        cmdTransfer(device, "out", 16, 0xF2, 0x07, 0x00, 0xED, 0x00, 0xE0, 0x04);
        cmdTransfer(device, "in", 4);
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
