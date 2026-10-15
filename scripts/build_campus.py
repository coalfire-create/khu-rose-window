"""Build the Hoegi campus for the Kyung Hee site from free open data.

- src/data/campus.json: OpenStreetMap (© OpenStreetMap contributors, ODbL;
  scripts/osm.json via fetch_osm.py) buildings, paths, green areas and the
  tour stops, in metres around the campus centre (x east, z south).
- public/terrain.png: AWS Terrain Tiles (Terrarium, z15) resampled on a 4 m
  grid, 16-bit height in R (high) and G (low), centimetres above HMIN.
"""
import io, json, math, os, urllib.request
from PIL import Image

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..')
M_LAT = 110540
els = json.load(open(os.path.join(HERE, 'osm.json')))['elements']

CAMPUS_ID = 326871536
camp = [(p['lat'], p['lon']) for p in next(e for e in els if e['id'] == CAMPUS_ID)['geometry']]
lat0 = sum(p[0] for p in camp) / len(camp)
lon0 = sum(p[1] for p in camp) / len(camp)
M_LON = M_LAT * math.cos(math.radians(lat0))
to_xz = lambda lat, lon: [round((lon - lon0) * M_LON, 1), round(-(lat - lat0) * M_LAT, 1)]
to_ll = lambda x, z: (lat0 - z / M_LAT, lon0 + x / M_LON)
R = 1000  # half-size of the world, metres


def inside(pt, ring):
    y, x = pt
    c = False
    for (y1, x1), (y2, x2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def centroid(g):
    return (sum(p['lat'] for p in g) / len(g), sum(p['lon'] for p in g) / len(g))


# ---------- terrain ----------
Z = 15
lat_n, lon_w = to_ll(-R - 200, -R - 200)
lat_s, lon_e = to_ll(R + 200, R + 200)


def tile(lat, lon):
    n = 2 ** Z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


x0, y0 = tile(lat_n, lon_w)
x1, y1 = tile(lat_s, lon_e)
os.makedirs(os.path.join(HERE, 'tiles'), exist_ok=True)
dem = Image.new('RGB', ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256))
for tx in range(x0, x1 + 1):
    for ty in range(y0, y1 + 1):
        p = os.path.join(HERE, 'tiles', f'{tx}-{ty}.png')
        if not os.path.exists(p):
            open(p, 'wb').write(urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png', timeout=60).read())
        dem.paste(Image.open(p).convert('RGB'), ((tx - x0) * 256, (ty - y0) * 256))
px = dem.load()


def elev(lat, lon):
    n = 2 ** Z
    fx = ((lon + 180) / 360 * n - x0) * 256
    fy = ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n - y0) * 256
    ix, iy = int(fx), int(fy)
    tx, ty = fx - ix, fy - iy
    h = lambda x, y: (lambda r, g, b: r * 256 + g + b / 256 - 32768)(*px[x, y])
    a = h(ix, iy) * (1 - tx) + h(ix + 1, iy) * tx
    b = h(ix, iy + 1) * (1 - tx) + h(ix + 1, iy + 1) * tx
    return a * (1 - ty) + b * ty


E0 = elev(lat0, lon0)
STEP = 8
N = 2 * R // STEP + 1
hs = [[elev(*to_ll(-R + i * STEP, -R + j * STEP)) - E0 for i in range(N)] for j in range(N)]
HMIN = math.floor(min(min(r) for r in hs)) - 1
img = Image.new('RGB', (N, N))
for j in range(N):
    for i in range(N):
        v = max(0, min(65535, round((hs[j][i] - HMIN) * 100)))
        img.putpixel((i, j), (v >> 8, v & 255, 0))
img.save(os.path.join(ROOT, 'public', 'terrain.png'))
print('terrain', N, 'HMIN', HMIN, 'max', round(max(max(r) for r in hs), 1))

# ---------- buildings ----------
NOT_A_HALL = r'수위실|경비|온실|주차|이마트|ATM'
import re
buildings = []
for e in els:
    t = e.get('tags', {})
    if 'building' not in t or e['type'] != 'way' or 'geometry' not in e:
        continue
    ring = [(p['lat'], p['lon']) for p in e['geometry']]
    c = centroid(e['geometry'])
    xz = to_xz(*c)
    if abs(xz[0]) > R - 40 or abs(xz[1]) > R - 40:
        continue
    campus = inside(c, camp)
    try:
        lv = t.get('building:levels', '0').split(',')[-1]
        levels = float(lv)
    except ValueError:
        levels = 0
    h = levels * 3.8 if levels else (15 if campus else 11 + (hash(e['id']) % 5) * 3)
    b = {'p': [to_xz(*p) for p in ring], 'h': round(h, 1), 'c': 1 if campus else 0}
    name = t.get('name', '')
    if campus and name and not re.search(NOT_A_HALL, name):
        b['n'] = name.replace('경희대학교 ', '')
    buildings.append(b)

# ---------- paths ----------
WIDTH = {'primary': 'w', 'secondary': 'w', 'tertiary': 'w', 'trunk': 'w', 'residential': 'r', 'unclassified': 'r', 'service': 'r',
         'living_street': 'r', 'pedestrian': 'p', 'footway': 'f', 'path': 'f', 'steps': 'f', 'cycleway': 'f', 'track': 'f'}
paths = []
for e in els:
    t = e.get('tags', {})
    k = WIDTH.get(t.get('highway'))
    if k and 'geometry' in e:
        pts = [to_xz(p['lat'], p['lon']) for p in e['geometry']]
        if any(abs(x) < R and abs(z) < R for x, z in pts):
            paths.append({'k': k, 'p': pts})

# ---------- green and open areas ----------
CLASS = {'grass': 'g', 'park': 'g', 'garden': 'g', 'recreation_ground': 'g', 'pitch': 'p', 'track': 'p', 'stadium': 'p',
         'wood': 'w', 'forest': 'w', 'scrub': 'w', 'cemetery': 'g', 'grassland': 'g', 'water': 'a', 'reservoir': 'a'}
areas = []
for e in els:
    t = e.get('tags', {})
    k = CLASS.get(t.get('landuse')) or CLASS.get(t.get('natural')) or CLASS.get(t.get('leisure'))
    if not k:
        continue
    rings = []
    if e['type'] == 'way' and 'geometry' in e:
        rings = [e['geometry']]
    elif e['type'] == 'relation':
        rings = [m['geometry'] for m in e.get('members', []) if m.get('role') == 'outer' and 'geometry' in m]
    for g in rings:
        pts = [to_xz(p['lat'], p['lon']) for p in g]
        if any(abs(x) < R and abs(z) < R for x, z in pts):
            areas.append({'k': k, 'p': pts})

campus_ring = [to_xz(*p) for p in camp]


def node(name):
    return next(to_xz(e['lat'], e['lon']) for e in els if e['type'] == 'node' and e.get('tags', {}).get('name') == name)


def way(name):
    w = next(e for e in els if e['type'] == 'way' and e.get('tags', {}).get('name') == name and 'geometry' in e)
    return to_xz(*centroid(w['geometry']))


landmarks = {
    'gate': node('등용문'),
    'motto': node('교시탑'),
    'fountain': node('분수'),
    'main': way('본관'),
    'library': way('경희대학교 중앙도서관'),
    'theatre': way('노천극장 무대'),
    'palace': way('평화의전당'),
    'cheongun': way('청운관'),
    'neo': way('네오르네상스관'),
}
out = {'origin': [round(lat0, 6), round(lon0, 6)], 'size': R, 'terrain': {'n': N, 'step': STEP, 'hmin': HMIN},
       'campus': campus_ring, 'buildings': buildings, 'paths': paths, 'areas': areas, 'landmarks': landmarks}
os.makedirs(os.path.join(ROOT, 'src', 'data'), exist_ok=True)
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'campus.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('buildings', len(buildings), 'campus', sum(b['c'] for b in buildings), 'named', sum(1 for b in buildings if 'n' in b))
print('paths', len(paths), 'areas', len(areas))
print('landmarks', landmarks)
print('ground at landmarks', {k: round(hs[int((v[1] + R) / STEP)][int((v[0] + R) / STEP)], 1) for k, v in landmarks.items()})
