let stlink;

document.addEventListener("DOMContentLoaded", function() {
    // Output console.log and console.error messages to the page as well
    (function () {
        if (!console) {
            console = {};
        }
        var oldLog = console.log;
        var oldError = console.error;
        var logger = document.getElementById('log');

        console.log = function (message) {
            if (typeof message === 'object') {
                logger.innerHTML += (JSON && JSON.stringify ? JSON.stringify(message) : String(message)) + '<br />';
            } else {
                logger.innerHTML += message + '<br />';
            }
            oldLog.apply(console, arguments);
        };

        console.error = function (message) {
            if (typeof message === 'object' && message instanceof Error) {
                logger.innerHTML += '<span class="log-error">' + message.message + '</span><br />';
            } else if (typeof message === 'object') {
                logger.innerHTML += '<span class="log-error">' + (JSON && JSON.stringify ? JSON.stringify(message) : String(message)) + '</span><br />';
            } else {
                logger.innerHTML += '<span class="log-error">' + message + '</span><br />';
            }
            oldError.apply(console, arguments);
        };
    })();

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

    document.getElementById("connect").addEventListener("click", connect);
});

async function connect() {
    try {
        // WebUSB requires user permission/interaction for USB device access
        // Filter for devices with ST vendor ID
        await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0483 }]
        });

        await init_chipids("/chips");

        const loglevel = 0;

        stlink = await stlink_open_usb(loglevel, 1, null, 0);
        if (stlink === 0) {
            throw new Error("Could not connect to ST-LINK");
        }
        updateStatus("Status: Device Connected", "status-connected");

        stlink_printVersion(stlink);

        swapConnectDisconnect();

    } catch (error) {
        console.error(error);
        updateStatus("Status: Connection Failed", "status-failed");
    }
};

async function disconnect() {
    try {
        const exitDebugStatus = await stlink_exit_debug_mode(stlink);
        if (exitDebugStatus !== 0) {
            throw new Error("Could not exit debug mode");
        }
        console.log("Debug mode exited");

        updateStatus("Status: Not Connected", "status-disconnected");

        swapConnectDisconnect();
    } catch (error) {
        console.error(error);
        updateStatus("Status: Disconnect Failed", "status-failed");
    }
};

document.getElementById("upload").addEventListener("click", async () => {
    try {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".bin";
        fileInput.onchange = async function(event) {
            const file = event.target.files[0];
            if (file) {
                console.log(`Selected file: ${file.name}`);
                try {
                    await prepareFlashing();
                    await handleFileUpload(file);
                } catch (error) {
                    console.error(error);
                    updateStatus("Status: Firmware Upload Failed", "status-failed");
                } finally {
                    await cleanupPostFlashing();
                }
            }
        };
        fileInput.click();

    } catch (error) {
        console.error(error);
        updateStatus("Status: Firmware Upload Failed", "status-failed");
    }
});

async function handleFileUpload(file) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const uint8Array = new Uint8Array(arrayBuffer);
    const filePath = `/tmp/${file.name}`;

    Module.FS_createDataFile('/', filePath, uint8Array, true, true);
    try {
        // enum erase_type_t { NO_ERASE = 0, SECTION_ERASE = 1, MASS_ERASE = 2, };
        const fwriteFlashStatus = await stlink_fwrite_flash(stlink, filePath, 0x08000000, 2);
        if (fwriteFlashStatus !== 0) {
            throw new Error(`Could not write to flash, error ${fwriteFlashStatus}`);
        }
        console.log(`Wrote ${file.name} to flash memory`);
    } finally {
        Module.FS_unlink(filePath);
    }
}

async function prepareFlashing() {
    try{
        const debugStatus = await stlink_force_debug(stlink);
        if (debugStatus !== 0) {
            throw new Error("Could not force debug mode");
        }
        console.log("Debug mode activated");

        const status = await stlink_status(stlink);
        if (status !== 0) {
            throw new Error("Could not force get ST-LINK status");
        }
        console.log("Got ST-LINK status");

        const base_OFFSET = 102500;
        const flash_base = getValue(stlink + base_OFFSET, "i32");
        const flash_size = getValue(stlink + base_OFFSET + 4, "i32");
        console.log(`Flash base addr: 0x${flash_base.toString(16).toUpperCase()}, size: 0x${flash_size.toString(16).toUpperCase()}`);

        const eraseFlashStatus = await stlink_erase_flash_mass(stlink);
        if (eraseFlashStatus !== 0) {
            throw new Error("Could not mass-erase flash");
        }
        console.log("Mass-erased flash memory");

    } catch (error) {
        console.error("Error preparing for flashing:", error);
    }
}

async function cleanupPostFlashing() {
    try {
        const resetStatus = await stlink_reset(stlink, 0);
        if (resetStatus !== 0) {
            throw new Error("Could not reset device");
        }
        console.log("Device reset successfully");

        const runStatus = await stlink_run(stlink, 0);
        if (runStatus !== 0) {
            throw new Error("Could not run device");
        }
        console.log("Device running again");
    } catch (error) {
        console.error("Error cleaning up post-flashing:", error);
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(event) {
            resolve(event.target.result);
        };
        reader.onerror = function() {
            reject(new Error("Error reading file"));
        };
        reader.readAsArrayBuffer(file);
    });
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

function swapConnectDisconnect() {
    const connectButton = document.getElementById('connect');
    if (connectButton.innerText === "Connect") {
        connectButton.innerText = "Disconnect";
        connectButton.removeEventListener("click", connect);
        connectButton.addEventListener("click", disconnect);

        document.getElementById("upload").style.display = 'block';
    } else if (connectButton.innerText === "Disconnect") {
        connectButton.innerText = "Connect";
        connectButton.removeEventListener("click", disconnect);
        connectButton.addEventListener("click", connect);

        document.getElementById("upload").style.display = 'none';
    } else {
        // Something must have gone really wrong
        throw new Error("Unexpected button state");
    }
};
