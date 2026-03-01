"""Extract the full error traceback from the Werkzeug HTML."""
import requests
import re

r = requests.post(
    "http://localhost:5001/api/analyze",
    json={"address": "54 Turnbury Lane, Irvine, CA 92620"},
    timeout=120,
)

print(f"HTTP Status: {r.status_code}")
if r.status_code != 200:
    html = r.text
    # Extract traceback from Werkzeug debugger HTML
    # The traceback is inside <div class="traceback"> or <pre class="traceback">
    # Let's grab all text between <pre> tags
    pre_blocks = re.findall(r'<pre[^>]*>(.*?)</pre>', html, re.DOTALL)
    for i, block in enumerate(pre_blocks):
        # Clean HTML entities
        clean = block.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&#39;', "'").replace('&#34;', '"')
        clean = re.sub(r'<[^>]+>', '', clean)  # strip remaining tags
        if clean.strip():
            print(f"\n--- Block {i} ---")
            print(clean.strip()[:2000])
    
    # Also try to find the traceback in the title
    title_match = re.search(r'<title>(.*?)</title>', html)
    if title_match:
        print(f"\nTitle: {title_match.group(1)}")
    
    # Look for "traceback" div
    tb_match = re.findall(r'class="line">(.*?)</pre>', html, re.DOTALL)
    for m in tb_match[:5]:
        clean = re.sub(r'<[^>]+>', '', m).strip()
        if clean:
            print(f"\nTraceback line: {clean[:500]}")
else:
    d = r.json()
    print(f"Success! Score: {d.get('risk', {}).get('overall_score')}")
