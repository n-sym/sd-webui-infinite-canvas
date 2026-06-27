import os
import urllib.request

ext_dir = os.path.dirname(os.path.abspath(__file__))
js_dir = os.path.join(ext_dir, "javascript")

if not os.path.exists(js_dir):
    os.makedirs(js_dir)

files = {
    "floating-ui.core.umd.min.js": "https://unpkg.com/@floating-ui/core@1/dist/floating-ui.core.umd.min.js",
    "floating-ui.dom.umd.min.js": "https://unpkg.com/@floating-ui/dom@1/dist/floating-ui.dom.umd.min.js"
}

for filename, url in files.items():
    filepath = os.path.join(js_dir, filename)
    if not os.path.exists(filepath):
        print(f"Infinite Canvas: Downloading {filename}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            print(f"Infinite Canvas: Successfully downloaded {filename}")
        except Exception as e:
            print(f"Infinite Canvas: Failed to download {filename}: {e}")
