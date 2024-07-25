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
                pkgs.autoconf
                pkgs.autoreconfHook
                pkgs.automake
                pkgs.pkg-config
            ];
            phases = [ "unpackPhase" "configurePhase" "buildPhase" ];
            unpackPhase = ''
                export BUILDDIR=$(mktemp -d)
                export HOME=$BUILDDIR
                cp -r $src/. $BUILDDIR/
                chmod u+w -R $BUILDDIR/
                cd $BUILDDIR
            '';
            configurePhase = ''
                ls -la
                autoreconf -fiv
                emconfigure ./configure --host=wasm32-emscripten --prefix=$out
            '';
            buildPhase = ''
                emmake make install
            '';
            outputs = [ "out" ];
        };
        linkerFlags = "--bind -s ASYNCIFY -s NO_ALLOW_MEMORY_GROWTH -s USE_PTHREADS -s FORCE_FILESYSTEM -s WASM_BIGINT -s WASM";
        stlink-webusb = pkgs.emscriptenStdenv.mkDerivation {
            name = "stlink-webusb";
            src = stlink;
            nativeBuildInputs = [
                pkgs.cmake
                pkgs.git
                pkgs.pkg-config
            ];
            phases = [ "unpackPhase" "patchPhase" "configurePhase" "buildPhase" "installPhase" ];
            unpackPhase = ''
                export BUILDDIR=$(mktemp -d)
                export HOME=$BUILDDIR
                cp -r $src/. $BUILDDIR
                # chmod u+w -R $BUILDDIR/
                cd $BUILDDIR
            '';
            patchPhase = ''
                substituteInPlace CMakeLists.txt --replace-fail "LIB_SHARED} SHARED" "LIB_SHARED} STATIC"
                substituteInPlace cmake/modules/Findlibusb.cmake --replace-fail "HINTS /usr/include" "HINTS ${libusb-webusb}/include"
                substituteInPlace cmake/modules/Findlibusb.cmake --replace-fail "HINTS /usr /usr/local" "HINTS ${libusb-webusb}/lib"
            '';
            configurePhase = ''
                export CMAKEFLAGS='\
                    -DCMAKE_C_FLAGS="-D__linux__" \
                    -DCMAKE_EXE_LINKER_FLAGS="${toString linkerFlags}"'
            '';
            buildPhase = ''
                emmake make
            '';
            installPhase = ''
                emcc -o libstlink.js \
                    -I${libusb-webusb}/include -Iinc/ \
                    -L${libusb-webusb}/lib -Lbuild/Release/lib/ -lstlink -lusb-1.0 \
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
                    --preload-file config/chips@/chips \
                    ${toString linkerFlags}
                mkdir -p $out
                cp *.{js,wasm,data} $out/
                cp -r config/chips $out/
            '';
            outputs = [ "out" ];
        };
    in
    {
        packages.${system}.default = pkgs.stdenv.mkDerivation {
            name = "stlink-webusb-package";
            buildInputs = [ libusb-webusb stlink-webusb ];
            phases = [ "buildPhase" ];
            buildPhase = ''
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
