"""Fetch the Hoegi (Seoul) campus of Kyung Hee University and its surroundings
from OpenStreetMap (© OpenStreetMap contributors, ODbL) into scripts/osm.json."""
import json, os, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(__file__)
B = '37.5880,127.0420,37.6050,127.0640'
q = f'''[out:json][timeout:180];
(way["building"]({B}); relation["building"]({B});
 way["highway"]({B});
 way["amenity"="university"]({B}); relation["amenity"="university"]({B});
 way["landuse"]({B}); way["natural"~"wood|scrub|grassland|water"]({B}); relation["natural"~"wood|scrub"]({B});
 way["leisure"~"park|pitch|garden|track|stadium"]({B});
 node["natural"="tree"]({B});
 node["name"]({B}););
out geom tags;'''
for i in range(8):
    try:
        d = json.loads(urllib.request.urlopen(urllib.request.Request('https://overpass-api.de/api/interpreter?data=' + urllib.parse.quote(q), headers={'User-Agent': 'khu-lumen/1.0'}), timeout=240).read())
        break
    except Exception as e:
        print('retry', e, file=sys.stderr); time.sleep(12)
json.dump(d, open(os.path.join(HERE, 'osm.json'), 'w'), ensure_ascii=False)
print('elements', len(d['elements']))
