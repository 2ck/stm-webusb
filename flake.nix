{
    description = ( "WebUSB stlink" );

    inputs = {
        nixpkgs = { url = "github:NixOS/nixpkgs/nixos-unstable"; };
        libusb = { url = "github:libusb/libusb"; flake = false; };
        stlink = { url = "github:stlink-org/stlink/testing"; flake = false; };
    };

    outputs = { self, nixpkgs, libusb, stlink }:
    let
        system = "x86_64-linux";
        pkgs = nixpkgs.legacyPackages.${system};
        dependencies = [
            (pkgs.python3.withPackages (pip3: [
                pip3.compiledb
            ]))
        ];
        libusb-webusb = pkgs.emscriptenStdenv.mkDerivation {
            name = "libusb-webusb";
            src = libusb;
            nativeBuildInputs = [
                pkgs.autoreconfHook
                pkgs.pkg-config
            ];
            outputs = [ "out" ];
            configurePhase = ''
                export HOME=$TMPDIR
                runHook preConfigure

                emconfigure ./configure --host=wasm32-emscripten --prefix=$out

                runHook postConfigure
            '';
            checkPhase = ''
                echo "Check phase skipped"
            '';
        };
        emLinkerFlags = "--bind -s ASYNCIFY -s USE_PTHREADS -s FORCE_FILESYSTEM";
        stlink-webusb = pkgs.emscriptenStdenv.mkDerivation {
            name = "stlink-webusb";
            src = stlink;
            nativeBuildInputs = [
                pkgs.cmake
                pkgs.git
                pkgs.pkg-config
                libusb-webusb
            ];
            dontStrip = true;
            outputs = [ "out" ];
            configurePhase = ''
                export HOME=$TMPDIR
                runHook preConfigure

                export CMAKEFLAGS='-DCMAKE_C_FLAGS="-D__linux__" \
                    -DCMAKE_EXE_LINKER_FLAGS="${toString emLinkerFlags}" \
                    -DCMAKE_INSTALL_PREFIX="$HOME" \
                    -DSTLINK_MODPROBED_DIR="$HOME/etc/modprobe.d" \
                    -DSTLINK_UDEV_RULES_DIR="$TMPDIR/lib/udev/rules.d"'

                runHook postConfigure
            '';
            postPatch = ''
                substituteInPlace CMakeLists.txt --replace-fail "LIB_SHARED} SHARED" "LIB_SHARED} STATIC"
            '';
            postInstall = ''
                emcc -o libstlink.js \
                    -L${libusb-webusb}/lib -lusb-1.0 -Lbuild/Release/lib/ -lstlink \
                    ${toString emLinkerFlags} \
                    -s EXPORTED_FUNCTIONS="[ \
                        '_init_chipids', \
                        '_stlink_open_usb', \
                        '_stlink_enter_swd_mode', \
                        '_stlink_reset', \
                        '_stlink_run', \
                        '_stlink_status', \
                        '_stlink_force_debug', \
                        '_stlink_erase_flash_mass', \
                        '_stlink_fwrite_flash', \
                        '_stlink_exit_debug_mode', \
                        '_stlink_close' \
                    ]" -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap']" \
                    --preload-file config/chips@/chips
                mkdir -p $out
                cp *.{js,wasm,data} $out/
                cp -r config/chips $out/
            '';
            checkPhase = ''
                echo "Check phase skipped"
            '';
        };
    in
    {
        packages.${system}.default = pkgs.stdenv.mkDerivation {
            name = "stlink-webusb-package";
            buildInputs = [ stlink-webusb ];
            phases = [ "installPhase" ];
            installPhase = ''
                ln -sfT ${stlink-webusb} $out
            '';
        };
        devShells.${system}.default = pkgs.stdenv.mkDerivation {
            name = "shell";
            buildInputs = [ self.packages.${system}.default ] ++ dependencies;
            shellHook = ''
                exec $SHELL
            '';
        };
        apps.${system}.default =
        let script = pkgs.writeShellScriptBin "run-server" ''
            export PATH=${nixpkgs.lib.strings.makeBinPath [ pkgs.python3 ]}:$PATH
            python3 server/http_server.py
        '';
        in {
            type = "app";
            program = "${script}/bin/run-server";
        };
    };
}
