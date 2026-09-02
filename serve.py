# Dev server with no-cache headers: Chrome memory-caches ES modules across
# reloads when the server is silent about caching, which serves STALE code
# mixes during iteration (found the hard way). Usage: python3 serve.py [port] [dir]
import functools
import http.server
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8792
    directory = sys.argv[2] if len(sys.argv) > 2 else '.'
    handler = functools.partial(NoCacheHandler, directory=directory)
    print(f'serving {directory} on {port} (no-cache)')
    http.server.ThreadingHTTPServer(('', port), handler).serve_forever()
