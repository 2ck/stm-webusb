from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import sys
import os

class CustomHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


os.chdir(sys.path[0] + "/..")

httpd = HTTPServer(("localhost", 8000), CustomHandler)

print("Serving on http://localhost:8000")
httpd.serve_forever()
