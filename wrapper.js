Module.onRuntimeInitialized = function() {
    // Wrap the necessary stlink functions as async
    window.stlink_open_usb = Module.cwrap('stlink_open_usb', 'number', ['number', 'number', 'number', 'number'], { async: true });
    window.stlink_enter_swd_mode = Module.cwrap('stlink_enter_swd_mode', 'number', ['number'], { async : true });
    window.stlink_reset = Module.cwrap('stlink_reset', 'number', ['number', 'number'], { async: true });
    window.stlink_run = Module.cwrap('stlink_run', 'number', ['number', 'number'], { async: true });
    window.stlink_status = Module.cwrap('stlink_status', 'number', ['number'], { async: true });
    window.stlink_force_debug = Module.cwrap('stlink_force_debug', 'number', ['number'], { async: true });
    window.stlink_erase_flash_mass = Module.cwrap('stlink_erase_flash_mass', 'number', ['number'], { async: true });
    window.stlink_fwrite_flash = Module.cwrap('stlink_fwrite_flash', 'number', ['number', 'string', 'number', 'number'], { async: true });
    window.stlink_exit_debug_mode = Module.cwrap('stlink_exit_debug_mode', 'number', ['number'], { async: true });
    window.stlink_close = Module.cwrap('stlink_close', 'null', ['number'], { async: true });
};

function stlink_printVersion(stlink) {
    if (stlink === 0) {
        console.error("Error: stlink parameter is zero.");
        return;
    }

    const base_OFFSET = 102536;

    // Offsets within the stlink_version_t structure
    const STLINK_V_OFFSET = 0;
    const JTAG_V_OFFSET = 4;
    const SWIM_V_OFFSET = 8;
    const ST_VID_OFFSET = 12;
    const STLINK_PID_OFFSET = 16;
    const JTAG_API_OFFSET = 20;
    const FLAGS_OFFSET = 24;

    // Read the values
    const stlink_v = getValue(stlink + base_OFFSET + STLINK_V_OFFSET, "i32");
    const jtag_v = getValue(stlink + base_OFFSET + JTAG_V_OFFSET, "i32");
    const swim_v = getValue(stlink + base_OFFSET + SWIM_V_OFFSET, "i32");
    const st_vid = getValue(stlink + base_OFFSET + ST_VID_OFFSET, "i32");
    const stlink_pid = getValue(stlink + base_OFFSET + STLINK_PID_OFFSET, "i32");
    const jtag_api = getValue(stlink + base_OFFSET + JTAG_API_OFFSET, "i32");
    const flags = getValue(stlink + base_OFFSET + FLAGS_OFFSET, "i32");

    console.log(`stlink_v = ${stlink_v}`);
    console.log(`jtag_v = ${jtag_v}`);
    console.log(`swim_v = ${swim_v}`);
    console.log(`st_vid = 0x${st_vid.toString(16).toUpperCase()}`);
    console.log(`stlink_pid = 0x${stlink_pid.toString(16).toUpperCase()}`);
    console.log(`jtag_api = ${jtag_api}`);

    // Collecting flag names
    const flagNames = [];
    if (flags & (1 << 0)) flagNames.push("STLINK_F_HAS_TRACE");
    if (flags & (1 << 1)) flagNames.push("STLINK_F_HAS_SWD_SET_FREQ");
    if (flags & (1 << 2)) flagNames.push("STLINK_F_HAS_JTAG_SET_FREQ");
    if (flags & (1 << 3)) flagNames.push("STLINK_F_HAS_MEM_16BIT");
    if (flags & (1 << 4)) flagNames.push("STLINK_F_HAS_GETLASTRWSTATUS2");
    if (flags & (1 << 5)) flagNames.push("STLINK_F_HAS_DAP_REG");
    if (flags & (1 << 6)) flagNames.push("STLINK_F_QUIRK_JTAG_DP_READ");
    if (flags & (1 << 7)) flagNames.push("STLINK_F_HAS_AP_INIT");
    if (flags & (1 << 8)) flagNames.push("STLINK_F_HAS_DPBANKSEL");
    if (flags & (1 << 9)) flagNames.push("STLINK_F_HAS_RW8_512BYTES");

    console.log(`flags: [${flagNames.join(', ')}]`);
}
