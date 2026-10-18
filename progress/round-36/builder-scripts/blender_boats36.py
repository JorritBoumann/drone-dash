# Round 36 builder: boat detail pass and new hull lids, run in Blender 5.2.2 through the Blender MCP
# (exec(open(<this file>).read())) in the unsaved round 35 scene "dd_boats35". Nothing is saved to a .blend file.
#
# Starts from the round 35 meshes (kept as fake-user backups "r35bak_<model>", so the script can run again) and keeps
# their UVs and the round 35 baked textures: every new part gets the UV of one clean texel of a matching colour in its
# boat's texture (no re-bake), and the round 35 per-corner flags (r = sail cloth, g = metalness, b = roughness).
#
#  sail:  sail faces subdivided (4 cuts) and given a belly (up to 0.30 m, to leeward); the sail-cloth flag carries a
#         flutter weight (r = 0.55 + 0.45 w, read by the game's vertex shader); forestay, two shrouds, a tack line and a sheet
#  row:   hull plan rounded to a superellipse (station cuts every 0.15 m), 10% narrower, smoothed (< 62 degrees); two thwarts, two shipped oars lying on them, two oarlocks
#  rib:   the tubes shaded smooth (every edge between two tube faces)
#  ferry: the big white faces above the boot top take one clean texel (no stair-stepped bake edges); window bands on
#         the cabin and a wrap-round wheelhouse glazing; a red name band on the hull; railings on the roof deck, the
#         side walkways and the stern
#  lids:  "<model>__cap" rebuilt from the OUTER outline of the hull at the lid height, inset 2.5 cm (inside the wall),
#         so the lid covers the whole open hull up to the gunwale with no rim gap
import bpy, bmesh, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash'
NAMES = ['boat_sail', 'boat_row', 'boat_rib', 'boat_ferry']
LOG = {}

# ---------- restore the round 35 meshes (re-runnable) ----------
for n in NAMES:
    ob = bpy.data.objects[n + '__all']
    bk = bpy.data.meshes.get('r35bak_' + n)
    if bk is None:
        bk = ob.data.copy(); bk.name = 'r35bak_' + n; bk.use_fake_user = True
    old = ob.data
    ob.data = bk.copy(); ob.data.name = n + '__all36'
    if old.users == 0 and old.name != bk.name: bpy.data.meshes.remove(old)

def uv_area(me, p):
    uv = me.uv_layers['UVMap'].data
    pts = [uv[li].uv for li in p.loop_indices]
    a = 0.0
    for i in range(1, len(pts) - 1):
        a += abs((pts[i] - pts[0]).cross(pts[i + 1] - pts[0])) / 2
    return a

def clean_uv(me, part, cond=None):
    """UV centroid of the face of this part with the largest UV area (one clean texel of that colour)."""
    pk = me.attributes['pk'].data
    best = None; ba = -1
    for p in me.polygons:
        if pk[p.index].value != part: continue
        if cond and not cond(p): continue
        a = uv_area(me, p)
        if a > ba: ba = a; best = p
    uv = me.uv_layers['UVMap'].data
    c = Vector((0, 0))
    for li in best.loop_indices: c += uv[li].uv
    return c / len(best.loop_indices)

class Adder:
    def __init__(self, bm):
        self.bm = bm
        self.uv = bm.loops.layers.uv['UVMap']
        self.col = bm.loops.layers.float_color['Col']
        self.pk = bm.faces.layers.int['pk']
        self.out = bm.faces.layers.float['outer']
        self.tris = 0
    def face(self, vs, uv, flags, pk, smooth):
        f = self.bm.faces.new(vs)
        f.smooth = smooth
        f[self.pk] = pk; f[self.out] = 1.0
        for l in f.loops:
            l[self.uv].uv = uv; l[self.col] = (flags[0], flags[1], flags[2], 1.0)
        self.tris += len(vs) - 2
        return f
    def box(self, c, size, uv, flags, pk, rot=None):
        R = rot or Matrix.Identity(3)
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        P = [Vector(c) + R @ Vector((sx * hx, sy * hy, sz * hz)) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        V = [self.bm.verts.new(p) for p in P]
        idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        fs = [self.face([V[i] for i in q], uv, flags, pk, False) for q in idx]
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    def cyl(self, a, b, r, uv, flags, pk, n=6, r2=None):
        a = Vector(a); b = Vector(b); d = (b - a).normalized()
        t = d.orthogonal().normalized(); s = d.cross(t)
        r2 = r if r2 is None else r2
        A = [self.bm.verts.new(a + (t * math.cos(2 * math.pi * k / n) + s * math.sin(2 * math.pi * k / n)) * r) for k in range(n)]
        B = [self.bm.verts.new(b + (t * math.cos(2 * math.pi * k / n) + s * math.sin(2 * math.pi * k / n)) * r2) for k in range(n)]
        fs = [self.face([A[k], A[(k + 1) % n], B[(k + 1) % n], B[k]], uv, flags, pk, True) for k in range(n)]
        fs.append(self.face(A[::-1], uv, flags, pk, False)); fs.append(self.face(B, uv, flags, pk, False))
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs

def ray_x(tree, y, z, side, start=4.0):
    """x where a ray from outside (side = +1 / -1) toward the centre line first hits the mesh at (y, z)."""
    hit = tree.ray_cast(Vector((side * start, y, z)), Vector((-side, 0, 0)), 20)
    return hit[0].x if hit[0] is not None else None

def ray_y(tree, x, z, side, start=12.0):
    hit = tree.ray_cast(Vector((x, side * start, z)), Vector((0, -side, 0)), 30)
    return hit[0].y if hit[0] is not None else None

def ray_down(tree, x, y, top=9.0):
    hit = tree.ray_cast(Vector((x, y, top)), Vector((0, 0, -1)), 20)
    return hit[0].z if hit[0] is not None else None

def finish(ob, bm):
    bm.normal_update()
    me = ob.data
    bm.to_mesh(me); bm.free()
    # no custom normals: smooth / sharp flags decide (as in round 35)
    if 'custom_normal' in me.attributes:
        me.attributes.remove(me.attributes['custom_normal'])
    me.update()

# ============ SAIL ============
ob = bpy.data.objects['boat_sail__all']; me = ob.data
UV_METAL = clean_uv(me, 2); UV_SAIL = clean_uv(me, 3); UV_TRIM = clean_uv(me, 1)
bm = bmesh.new(); bm.from_mesh(me)
pkL = bm.faces.layers.int['pk']; colL = bm.loops.layers.float_color['Col']
sail_f = [f for f in bm.faces if f[pkL] == 3]
edges = list({e for f in sail_f for e in f.edges})
bmesh.ops.subdivide_edges(bm, edges=edges, cuts=4, use_grid_fill=True)
sail_f = [f for f in bm.faces if f[pkL] == 3]
# outline of the sail in (y, z): edges between a side-facing (|nx| > 0.7) sail face and anything else
bm.normal_update()
outline = []
for f in sail_f:
    if abs(f.normal.x) < 0.7: continue
    for e in f.edges:
        others = [g for g in e.link_faces if g is not f]
        if not others or any(abs(g.normal.x) < 0.7 or g[pkL] != 3 for g in others):
            outline.append(((e.verts[0].co.y, e.verts[0].co.z), (e.verts[1].co.y, e.verts[1].co.z)))
def dseg(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
    t = 0 if L < 1e-12 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)
sv = list({v for f in sail_f for v in f.verts})
dist = {v: min(dseg((v.co.y, v.co.z), a, b) for a, b in outline) for v in sv}
dmax = max(dist.values())
BELLY = 0.34
for v in sv:
    t = min(1.0, dist[v] / (1.0 * dmax)); w = t * (2 - t)
    v.co.x -= BELLY * w
w_fl = {}
for v in sv:
    t = min(1.0, dist[v] / (1.0 * dmax)); w = t * (2 - t)
    leech = max(0.0, min(1.0, (-0.5 - v.co.y) / 3.0))
    up = max(0.0, min(1.0, (v.co.z - 1.55) / 0.8))
    w_fl[v] = leech * up * (0.25 + 0.75 * w)
for f in sail_f:
    f.smooth = True
    for l in f.loops:
        c = l[colL]; l[colL] = (0.55 + 0.45 * w_fl[l.vert], c[1], c[2], 1.0)
for f in sail_f:
    for e in f.edges:
        e.smooth = all(g[pkL] == 3 and abs(g.normal.x) > 0.7 for g in e.link_faces) if abs(f.normal.x) > 0.7 else False
# mast top and the rig
mast_top = max((v for v in bm.verts if abs(v.co.x) < 0.12 and v.co.z > 5.5), key=lambda v: v.co.z).co.copy()
my = sum(v.co.y for v in bm.verts if abs(v.co.x) < 0.12 and v.co.z > 5.0) / max(1, sum(1 for v in bm.verts if abs(v.co.x) < 0.12 and v.co.z > 5.0))
A = Adder(bm)
WIRE = (0.0, 0.85, 0.32); R = 0.011
head = Vector((0, my, mast_top.z - 0.12))
# (the bow is at -y in this model: the hull is fine there and the stem head is at y -2.55, z 1.23)
A.cyl(head + Vector((0.06, 0, 0)), (0.06, -2.50, 1.24), R, UV_METAL, WIRE, 2)              # forestay
for s in (-1, 1):
    A.cyl(head + Vector((s * 0.05, 0, -0.25)), (s * 1.20, my + 0.35, 1.03), R, UV_METAL, WIRE, 2)  # shrouds
    A.cyl((s * 1.20, my + 0.35, 1.0), (s * 1.20, my + 0.35, 1.07), 0.03, UV_METAL, WIRE, 2)        # chainplates
A.cyl((0, -3.25, 1.43), (0, -2.47, 1.24), 0.013, UV_SAIL, (0, 0, 0.9), 3)                # tack line to the stem
A.cyl((0, 1.40, 2.16), (0, 3.15, 1.06), 0.013, UV_SAIL, (0, 0, 0.9), 3)                  # sheet from the clew aft
LOG['sail'] = dict(sail_verts=len(sv), outline=len(outline), dmax=round(dmax, 3), belly=BELLY, mast_top=tuple(round(c, 3) for c in mast_top), mast_y=round(my, 3), added_tris=A.tris)
finish(ob, bm)

# ============ ROW ============
ob = bpy.data.objects['boat_row__all']; me = ob.data
inside = lambda p: me.attributes['outer'].data[p.index].value < 0.5 and p.normal.z > 0.6
UV_TRIM = clean_uv(me, 0, inside)  # varnished floor boards (inside, facing up): plain wood, not the teal topsides
UV_TEAL = clean_uv(me, 1)  # the painted topsides colour, for the oar blades
bm = bmesh.new(); bm.from_mesh(me)
pkL = bm.faces.layers.int['pk']
# smooth plan: cut the hull at stations every 0.15 m, then scale each station's half-beam from the eight-sided
# outline to a superellipse (|x|/B)^3 + (|y|/L)^3 = 1 (round shoulders, full ends); the cuts interpolate UVs and flags
def max_beam(bm, y):
    b = bm.copy()
    r = bmesh.ops.bisect_plane(b, geom=b.verts[:] + b.edges[:] + b.faces[:], plane_co=(0, y, 0), plane_no=(0, 1, 0))
    xs = [abs(v.co.x) for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge) for v in e.verts]
    b.free()
    return max(xs) if xs else None
yl = max(v.co.y for v in bm.verts); ym = min(v.co.y for v in bm.verts)
stations = []
y = ym + 0.08
while y < yl - 0.05:
    stations.append(round(y, 3)); y += 0.15
for y in stations:
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, y, 0), plane_no=(0, 1, 0))
prof = {y: max_beam(bm, y) for y in stations}
B0 = max(v for v in prof.values() if v)
scale = {}
for y, hb in prof.items():
    if not hb: continue
    L = (yl if y > 0 else -ym) + 0.03
    t = min(1.0, abs(y) / L)
    tgt = B0 * max(0.0, 1 - t ** 3) ** (1 / 3)
    scale[y] = max(0.6, min(1.3, tgt / hb))
ks = sorted(scale)
def s_at(y):
    if y <= ks[0]: return scale[ks[0]]
    if y >= ks[-1]: return scale[ks[-1]]
    for a, b in zip(ks, ks[1:]):
        if a <= y <= b:
            u = (y - a) / (b - a); return scale[a] * (1 - u) + scale[b] * u
# and a little narrower overall (2.38 -> 2.14 m beam): it read as a wide tub next to the pier (the collider keeps the
# old beam)
for v in bm.verts: v.co.x *= 0.9 * s_at(v.co.y)
for f in bm.faces: f.smooth = True
for e in bm.edges:
    e.smooth = len(e.link_faces) == 2 and e.calc_face_angle(0) < math.radians(62)
bm.normal_update()
tree = BVHTree.FromBMesh(bm)
A = Adder(bm)
WOOD = (0.0, 0.0, 0.6)
seats = []
for y in (0.55, -0.95):
    hit = tree.ray_cast(Vector((0, y, 0.59)), Vector((1, 0, 0)), 3.0)
    xi = hit[0].x if hit[0] is not None else 0.9
    A.box((0, y, 0.595), (2 * xi + 0.02, 0.26, 0.05), UV_TRIM, WOOD, 1)
    # a knee under each end of the thwart
    for s in (-1, 1):
        A.box((s * (xi - 0.06), y, 0.53), (0.1, 0.06, 0.09), UV_TRIM, WOOD, 1)
    seats.append((y, round(xi, 3)))
# shipped oars lying on the thwarts, blades aft
for s in (-1, 1):
    x = s * 0.34; z = 0.645
    A.cyl((x, 1.30, z + 0.005), (x, 1.05, z + 0.005), 0.02, UV_TRIM, WOOD, 1, n=6)          # grip
    A.cyl((x, 1.05, z + 0.005), (x, -1.02, z + 0.005), 0.03, UV_TRIM, WOOD, 1, n=6, r2=0.026)  # loom and shaft
    A.box((x, -1.30, z), (0.16, 0.58, 0.022), UV_TEAL, WOOD, 1)                               # painted blade
    # oarlock on the gunwale top
    hit = tree.ray_cast(Vector((s * 2.0, -0.2, 0.84)), Vector((-s, 0, 0)), 3.0)
    xo = (hit[0].x if hit[0] is not None else s * 1.1) - s * 0.06
    zt = ray_down(tree, xo, -0.2, top=2.0) or 0.86
    A.cyl((xo, -0.2, zt - 0.01), (xo, -0.2, zt + 0.09), 0.016, UV_TRIM, (0, 0.6, 0.35), 1, n=6)
    A.box((xo, -0.2, zt + 0.09), (0.02, 0.10, 0.02), UV_TRIM, (0, 0.6, 0.35), 1)
LOG['row'] = dict(seats=seats, added_tris=A.tris, B0=round(B0, 3), scale={k: round(scale[k], 2) for k in ks[::3]})
finish(ob, bm)

# ============ RIB ============
ob = bpy.data.objects['boat_rib__all']; me = ob.data
UV_ROPE = clean_uv(me, 1)
bm = bmesh.new(); bm.from_mesh(me)
pkL = bm.faces.layers.int['pk']
# the hull component (largest) only: the seats keep their crisp edges
seen = set(); comps = []
for f in bm.faces:
    if f in seen: continue
    st = [f]; c = []
    while st:
        x = st.pop()
        if x in seen: continue
        seen.add(x); c.append(x)
        for e in x.edges:
            for g in e.link_faces:
                if g not in seen: st.append(g)
    comps.append(c)
hull = set(max(comps, key=len))
n_sm = 0
for f in hull:
    if f[pkL] != 0: continue
    f.smooth = True
    for e in f.edges:
        if len(e.link_faces) == 2 and all(g[pkL] == 0 and g in hull for g in e.link_faces):
            if not e.smooth: n_sm += 1
            e.smooth = True
for f in bm.faces:
    if f in hull or f[pkL] != 0: continue
    f.smooth = True
    for e in f.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) < math.radians(50) and not e.smooth:
            e.smooth = True; n_sm += 1
# the white bands (rope part) take one clean texel: their baked diagonal hatch shimmered in motion
uvL = bm.loops.layers.uv['UVMap']
n_band = 0
for f in bm.faces:
    if f[pkL] == 1 and f in hull:
        for l in f.loops: l[uvL].uv = UV_ROPE
        n_band += 1
LOG['rib'] = dict(edges_smoothed=n_sm, clean_band_faces=n_band)
finish(ob, bm)

# ============ FERRY ============
ob = bpy.data.objects['boat_ferry__all']; me = ob.data
up = lambda p: p.normal.z > 0.5
UV_DARK = clean_uv(me, 0); UV_WHITE = clean_uv(me, 1, up); UV_RED = clean_uv(me, 3)
bm = bmesh.new(); bm.from_mesh(me)
pkL = bm.faces.layers.int['pk']; uvL = bm.loops.layers.uv['UVMap']
# clean texel on the big white faces above the boot top (their bake edges showed stair steps up close)
n_clean = 0
for f in bm.faces:
    if f[pkL] in (0, 1, 2) and min(v.co.z for v in f.verts) > 1.65:
        for l in f.loops: l[uvL].uv = UV_WHITE if f[pkL] else UV_DARK
        n_clean += 1
bm.normal_update()
tree = BVHTree.FromBMesh(bm)
A = Adder(bm)
GLASS = (0.0, 0.25, 0.18); RAIL = (0.0, 0.55, 0.3); PAINT = (0.0, 0.0, 0.5)
win = 0
# main cabin windows (both sides): panes 0.9 m wide, 0.22 m apart
y = -5.0
while y < 7.6:
    for s in (-1, 1):
        x = ray_x(tree, y + 0.45, 3.62, s)
        if x is not None and abs(x) > 1.5 and abs(x) < 1.95:
            A.box((x + s * 0.008, y + 0.45, 3.62), (0.02, 0.9, 0.5), UV_DARK, GLASS, 0); win += 1
    y += 1.12
# wheelhouse: the forward upper cabin glazed all round (sides, front)
y = -4.65
while y < 0.0:
    for s in (-1, 1):
        x = ray_x(tree, y + 0.4, 4.9, s)
        if x is not None and 1.3 < abs(x) < 1.75:
            A.box((x + s * 0.008, y + 0.4, 4.9), (0.02, 0.8, 0.46), UV_DARK, GLASS, 0); win += 1
    y += 0.95
yf = ray_y(tree, 0, 4.9, -1)
for k in range(5):
    xx = -1.2 + k * 0.6
    yy = ray_y(tree, xx, 4.9, -1)
    if yy is not None: A.box((xx, yy - 0.008, 4.9), (0.52, 0.02, 0.48), UV_DARK, GLASS, 0); win += 1
# a visor over the wheelhouse front
A.box((0, (yf or -4.8) - 0.12, 5.2), (2.9, 0.26, 0.05), UV_WHITE, PAINT, 1)
# name band on the hull sides (flat run of the topsides)
for s in (-1, 1):
    x = ray_x(tree, 1.0, 2.4, s)
    A.box((x + s * 0.006, 1.36, 2.4), (0.012, 14.2, 0.26), UV_RED, PAINT, 3)
    A.box((x + s * 0.008, 1.36, 2.62), (0.012, 14.2, 0.04), UV_DARK, PAINT, 0)
# railings: roof deck edge, side walkways, stern
def rail(p0, p1, z0, h, step=0.9):
    p0 = Vector(p0); p1 = Vector(p1); L = (p1 - p0).length; n = max(1, round(L / step))
    for k in range(n + 1):
        p = p0 + (p1 - p0) * (k / n)
        A.cyl((p.x, p.y, z0), (p.x, p.y, z0 + h), 0.022, UV_WHITE, RAIL, 1, n=5)
    A.cyl((p0.x, p0.y, z0 + h), (p1.x, p1.y, z0 + h), 0.026, UV_WHITE, RAIL, 1, n=6)
    A.cyl((p0.x, p0.y, z0 + h * 0.5), (p1.x, p1.y, z0 + h * 0.5), 0.016, UV_WHITE, RAIL, 1, n=5)
for s in (-1, 1):
    rail((s * 2.12, -5.1, 0), (s * 2.12, 7.85, 0), 4.48, 0.62)          # roof deck sides
    rail((s * 2.12, -5.6, 0), (s * 2.12, 8.4, 0), 3.13, 0.7, step=1.3)   # side walkways
rail((-2.05, 7.85, 0), (2.05, 7.85, 0), 4.48, 0.62)                      # roof deck aft
rail((-1.95, 9.65, 0), (1.95, 9.65, 0), 3.13, 0.7)                       # stern
LOG['ferry'] = dict(clean_faces=n_clean, windows=win, added_tris=A.tris, front_y=yf)
finish(ob, bm)

# ============ LIDS ============
def comps_of(bm):
    seen = set(); out = []
    for f in bm.faces:
        if f in seen: continue
        st = [f]; c = []
        while st:
            x = st.pop()
            if x in seen: continue
            seen.add(x); c.append(x)
            for e in x.edges:
                for g in e.link_faces:
                    if g not in seen: st.append(g)
        out.append(c)
    return out
def outer_loop(n, h):
    bm = bmesh.new(); bm.from_mesh(bpy.data.objects[n + '__all'].data)
    cs = comps_of(bm)
    def ext(c):
        vs = {v for f in c for v in f.verts}; xs = [v.co.x for v in vs]; ys = [v.co.y for v in vs]
        return (max(xs) - min(xs)) * (max(ys) - min(ys))
    keep = set(max(cs, key=ext))
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context='FACES')
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, h), plane_no=(0, 0, 1))
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    adj = {}
    for e in cut:
        a, b = e.verts; adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = set(); loops = []
    for v in adj:
        if v in seen or len(adj[v]) != 2: continue
        loop = [v]; seen.add(v); prev = None; cur = v
        while True:
            nxt = [x for x in adj[cur] if x is not prev][0]
            if nxt is v or nxt in seen: break
            loop.append(nxt); seen.add(nxt); prev, cur = cur, nxt
        pts = [Vector((p.co.x, p.co.y)) for p in loop]
        Ar = sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts))) / 2
        loops.append((Ar, pts))
    bm.free()
    Ar, pts = max(loops, key=lambda l: abs(l[0]))
    if Ar < 0: pts = pts[::-1]
    clean = []
    for p in pts:
        if not clean or (p - clean[-1]).length > 1e-4: clean.append(p)
    if (clean[0] - clean[-1]).length < 1e-4: clean.pop()
    return clean
def inset(pts, d):
    n = len(pts); out = []
    for i in range(n):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % n]
        e1 = (b - a).normalized(); e2 = (c - b).normalized()
        n1 = Vector((-e1.y, e1.x)); n2 = Vector((-e2.y, e2.x))
        m = n1 + n2
        if m.length < 1e-6: m = n1
        m.normalize()
        out.append(b + m * (d / max(m.dot(n1), 0.33)))
    return out
for n, h in [('boat_sail', 1.0), ('boat_row', 0.8), ('boat_rib', 0.5)]:
    ins = inset(outer_loop(n, h), 0.025)
    old = bpy.data.objects.get(n + '__cap')
    if old:
        mo = old.data; bpy.data.objects.remove(old)
        if mo.users == 0: bpy.data.meshes.remove(mo)
    cb = bmesh.new()
    f = cb.faces.new([cb.verts.new((p.x, p.y, h)) for p in ins])
    bmesh.ops.triangulate(cb, faces=[f], quad_method='BEAUTY', ngon_method='BEAUTY')
    for f in cb.faces:
        f.normal_update()
        if f.normal.z < 0: f.normal_flip()
    mc = bpy.data.meshes.new(n + '__cap'); cb.to_mesh(mc); cb.free()
    oc = bpy.data.objects.new(n + '__cap', mc); bpy.context.scene.collection.objects.link(oc)
    LOG[n + '_cap'] = dict(h=h, verts=len(ins), tris=len(mc.polygons), x=round(max(p.x for p in ins), 3), y=(round(min(p.y for p in ins), 3), round(max(p.y for p in ins), 3)))

for k, v in LOG.items(): print(k, v)
for n in NAMES:
    me = bpy.data.objects[n + '__all'].data
    print(n, 'tris', sum(len(p.vertices) - 2 for p in me.polygons))

# ---------- export (same objects and settings as round 35) ----------
pier = bpy.data.objects.get('src31_pier')
if pier: pier.name = 'pier__all'; pier.location = (0, 0, 0)
exp = [bpy.data.objects[n] for n in ['boat_sail__all', 'boat_row__all', 'boat_rib__all', 'boat_ferry__all', 'boat_sail__cap', 'boat_row__cap', 'boat_rib__cap', 'pier__all']]
for o in bpy.context.scene.objects:
    o.hide_set(False); o.select_set(False)
for o in exp:
    o.location = (0, 0, 0); o.select_set(True)
out = ROOT + '/public/assets/models/boats.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True,
                          export_materials='NONE', export_texcoords=True, export_normals=True, export_yup=True,
                          export_vertex_color='ACTIVE', export_attributes=False)
if pier: pier.name = 'src31_pier'
import os
print('exported', os.path.getsize(out))
