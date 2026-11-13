"""Published reader entry must remain usable after the repository is rebuilt."""
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import subprocess
import unittest
from urllib.parse import quote, urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[3]


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith('/show-something/'):
            path = path[len('/show-something'):]
        return super().translate_path(path)

    def log_message(self, *_):
        pass


class Redirect(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.canonical = None
        self.refresh = None
        self.links = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            self.refresh = attrs.get('content', '').split('url=', 1)[-1].strip()
        if tag == 'a':
            self.links.append(attrs.get('href'))


class PublishedEntryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        subprocess.run(['python3', str(ROOT / '工程/scripts/build_site.py')], check=True, capture_output=True)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_published_reader_entry_reaches_home(self):
        for prefix in ('', '/show-something'):
            with self.subTest(prefix=prefix):
                old_url = self.base + prefix + '/' + quote('阅读/index.html')
                with urlopen(old_url) as response:
                    self.assertEqual(response.status, 200)
                    redirect = Redirect(response.read().decode())
                home = self.base + prefix + '/index.html'
                self.assertEqual(urljoin(old_url, redirect.canonical), home)
                self.assertEqual(urljoin(old_url, redirect.refresh), home)
                self.assertTrue(any(urljoin(old_url, link) == home for link in redirect.links))
                with urlopen(home) as response:
                    self.assertEqual(response.status, 200)
                    self.assertIn('id="featured-grid"', response.read().decode())


if __name__ == '__main__':
    unittest.main()
