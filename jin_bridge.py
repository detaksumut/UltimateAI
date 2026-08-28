import os
import sys
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Konfigurasi Host dan Port Lokal
HOST = 'localhost'
PORT = 8999

class JINReadOnlyHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    # METODE BACA (STRICT READ-ONLY)
    def do_GET(self):
        parsed_path = urlparse(self.path)
        query = parse_qs(parsed_path.query)

        # 1. Endpoint Check Status
        if parsed_path.path == '/status':
            self._set_headers(200)
            response = {"status": "ONLINE", "mode": "READ-ONLY", "agent": "JIN-Core"}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            return

        # 2. Endpoint Scan Directory / Folder
        elif parsed_path.path == '/scan':
            target_path = query.get('path', [os.path.expanduser('~')])[0]
            try:
                if not os.path.exists(target_path):
                    self._set_headers(404)
                    self.wfile.write(json.dumps({"error": "Path tidak ditemukan"}).encode('utf-8'))
                    return

                items = []
                for entry in os.scandir(target_path):
                    items.append({
                        "name": entry.name,
                        "is_dir": entry.is_dir(),
                        "size": entry.stat().st_size if not entry.is_dir() else 0,
                        "path": entry.path
                    })

                self._set_headers(200)
                res = {"current_path": target_path, "total_items": len(items), "items": items}
                self.wfile.write(json.dumps(res, indent=2).encode('utf-8'))
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return

        self._set_headers(400)
        self.wfile.write(json.dumps({"error": "Invalid Endpoint"}).encode('utf-8'))

    # BLOKIR SEMUA PERINTAH TULIS/HAPUS/MODIFIKASI
    def do_POST(self):
        self._set_headers(403)
        self.wfile.write(json.dumps({"error": "DILARANG: MODE STRICT READ-ONLY."}).encode('utf-8'))

    def do_PUT(self):
        self.do_POST()

    def do_DELETE(self):
        self.do_POST()

def run_server():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, JINReadOnlyHandler)
    print(f"==================================================")
    print(f" JIN Local Read-Only Daemon Running on http://{HOST}:{PORT}")
    print(f" Status: STRICT READ-ONLY MODE (NO WRITE/DELETE)")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nDaemon dimatikan.")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
