#!/usr/bin/env python3
"""เสิร์ฟไฟล์แบบไม่ให้เบราว์เซอร์แคช — แก้ปัญหาแก้โค้ดแล้วหน้าเว็บยังเป็นตัวเก่า

    python3 serve.py          # http://localhost:4173
    python3 serve.py 8080     # เปลี่ยนพอร์ต
"""
import http.server, os, sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4173
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'เปิดที่ http://localhost:{port}  (ปิดด้วย Ctrl+C)')
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
