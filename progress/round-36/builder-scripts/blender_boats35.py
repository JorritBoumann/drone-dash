# Round 35 builder: boat rebuild, run in Blender 5.2.2 through the Blender MCP (execute_blender_code:
# exec(open(<this file>).read())). Fresh unsaved scene "dd_boats35"; nothing is saved to a .blend file.
#
# Input: the round 31 boats.glb imported into the scene (same CC0 Quaternius meshes as Poly Pizza, full triangle counts:
# round 31 did not decimate the boats, it only flattened their palette texture to one colour per face and dropped UVs).
# Poly Haven textures imported with import_asset (CC0): brown_planks_03 and roof_planks (1k JPEG diffuse).
#
# Per boat:
#  1. weld (remove doubles), drop degenerate faces, make every closed part face outwards (signed volume), audit
#  2. classify faces by their round 31 palette colour into parts (hull wood, trim, metal, sail, tube, rope, ...)
#  3. "outer" flag per face: a ray along the normal leaves the boat (exposed outside skin), used for the waterline bands
#  4. smooth shading with sharp edges above 34 degrees (hulls read round, chines and corners stay crisp)
#  5. Smart UV project + pack, then a Cycles EMIT bake of albedo x ambient occlusion into one texture per boat:
#     Poly Haven wood grain (box projected) on hull and trim, painted bands (antifouling below the waterline, a boot top,
#     a sheer stripe), a darker wet band above the waterline, sail cloth panels and weave noise, rope and metal tones
#  6. a per-corner FLOAT colour "Col" with flags: R = sail cloth (translucency), G = metalness, B = roughness
#  7. a "hull cap" (role "cap"): the inner hull outline cut at the cap height, filled; the game draws it depth-only
#     after the boat and before the water, so the sea never shows inside an open hull
#  8. export one GLB (positions, normals, UVs, Col) without materials; textures saved as PNG then cwebp to WebP
import bpy, bmesh, math, os, time
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash'
SCRATCH = ROOT + '/asset-src/bake35'
os.makedirs(SCRATCH, exist_ok=True)
T0 = time.time()

def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lin(rgb):
    return tuple(s2l(c) for c in rgb) + (1.0,)

WOOD = bpy.data.images['brown_planks_03_Diffuse']
DECK = bpy.data.images['roof_planks_Diffuse']
for im in (WOOD, DECK):
    p = os.path.join(ROOT, 'asset-src/polyhaven', im.name + '_1k.png')
    if not os.path.exists(p):
        try:
            im.save(filepath=p.replace('.png', '.jpg'))
        except Exception as e:
            print('save src', e)

def mean_lum(img):
    px = img.pixels[:]
    n = len(px) // 4
    s = 0.0; k = 0
    for i in range(0, n, 37):
        # byte images hold sRGB values in .pixels; the shader works in linear, so average the linear luminance
        s += 0.2126 * s2l(px[i * 4]) + 0.7152 * s2l(px[i * 4 + 1]) + 0.0722 * s2l(px[i * 4 + 2]); k += 1
    return s / k
LUM = {WOOD.name: mean_lum(WOOD), DECK.name: mean_lum(DECK)}

# part: tint (sRGB), texture, tex scale (m per tile), detail strength, noise, flags (sail, metal, rough), bands
#   bands: dict(wl, anti, boot, sheer=(z0, z1, col), top=(col) paints outer skin above the boot top)
SPEC = {
    'boat_sail': dict(src='boat_sail__all', res=2048, cap=1.0, wl=0.42, parts={
        (0.68, 0.49, 0.35): ('hull', (0.70, 0.50, 0.33), WOOD, 1.1, 0.75, 0.05, (0, 0, 0.62), dict(wl=0.42, anti=(0.46, 0.12, 0.10), boot=(0.92, 0.90, 0.84), sheer=(0.93, 1.06, (0.12, 0.22, 0.36)))),
        (0.43, 0.31, 0.24): ('trim', (0.47, 0.33, 0.22), DECK, 1.4, 0.7, 0.05, (0, 0, 0.5), dict(wl=0.42, anti=(0.46, 0.12, 0.10))),
        (0.6, 0.6, 0.6): ('metal', (0.70, 0.71, 0.72), None, 1, 0, 0.10, (0, 0.85, 0.32), None),
        (0.72, 0.68, 0.56): ('sail', (0.93, 0.90, 0.82), None, 1, 0, 0.06, (1, 0, 0.88), None),
    }),
    'boat_row': dict(src='boat_row__all', res=1024, cap=0.8, wl=0.32, parts={
        (0.43, 0.33, 0.29): ('hull', (0.62, 0.47, 0.34), WOOD, 0.9, 0.8, 0.05, (0, 0, 0.7), dict(wl=0.32, anti=(0.16, 0.22, 0.21), boot=(0.90, 0.88, 0.82), top=(0.30, 0.52, 0.55), sheer=(0.86, 1.1, (0.90, 0.88, 0.82)))),
        (0.35, 0.27, 0.24): ('trim', (0.45, 0.32, 0.22), DECK, 1.2, 0.75, 0.05, (0, 0, 0.6), dict(wl=0.32, anti=(0.16, 0.22, 0.21))),
    }),
    'boat_rib': dict(src='boat_rib__all', res=1024, cap=0.5, wl=0.30, parts={
        (0.81, 0.29, 0.32): ('tube', (0.80, 0.24, 0.20), None, 1, 0, 0.07, (0, 0, 0.5), dict(wl=0.30)),
        (0.81, 0.7, 0.6): ('rope', (0.86, 0.80, 0.66), None, 1, 0, 0.18, (0, 0, 0.92), None),
        (0.56, 0.22, 0.24): ('hullrib', (0.24, 0.25, 0.27), None, 1, 0, 0.08, (0, 0, 0.55), dict(wl=0.30, anti=(0.13, 0.15, 0.17))),
        (0.3, 0.3, 0.3): ('motor', (0.20, 0.21, 0.23), None, 1, 0, 0.05, (0, 0.35, 0.38), None),
    }),
    'boat_ferry': dict(src='boat_ferry__all', res=1024, cap=None, wl=1.25, parts={
        (0.28, 0.28, 0.28): ('dark', (0.20, 0.23, 0.27), None, 1, 0, 0.04, (0, 0.25, 0.22), None),
        (0.85, 0.85, 0.85): ('white', (0.90, 0.90, 0.88), None, 1, 0, 0.05, (0, 0, 0.42), dict(wl=1.25, anti=(0.55, 0.12, 0.10), boot=(0.12, 0.12, 0.13), bootw=0.12)),
        (0.9, 0.9, 0.9): ('white2', (0.94, 0.94, 0.92), None, 1, 0, 0.04, (0, 0, 0.42), dict(wl=1.25, anti=(0.55, 0.12, 0.10), boot=(0.12, 0.12, 0.13), bootw=0.12)),
        (0.81, 0.24, 0.24): ('red', (0.74, 0.17, 0.15), None, 1, 0, 0.05, (0, 0, 0.55), dict(wl=1.25, anti=(0.50, 0.11, 0.10), boot=(0.12, 0.12, 0.13), bootw=0.12)),
    }),
}

def classify(spec, srgb):
    best = None; bd = 9
    for k in spec['parts']:
        d = sum(abs(a - b) for a, b in zip(k, srgb))
        if d < bd: bd = d; best = k
    return best

# ---------- node helpers ----------
def node(nt, t, **kw):
    n = nt.nodes.new(t)
    for k, v in kw.items():
        setattr(n, k, v)
    return n

def math_n(nt, op, a, b=None, clamp=False):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: nt.links.new(v, n.inputs[i])
    return n.outputs[0]

def mix_col(nt, fac, a, b, blend='MIX'):
    n = nt.nodes.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = blend
    ins = [i for i in n.inputs if i.type == 'RGBA']
    fi = n.inputs[0]
    if isinstance(fac, (int, float)): fi.default_value = fac
    else: nt.links.new(fac, fi)
    for sock, v in zip(ins[:2], (a, b)):
        if isinstance(v, tuple): sock.default_value = v
        else: nt.links.new(v, sock)
    out = [o for o in n.outputs if o.type == 'RGBA'][0]
    return out

def band(nt, z, lo, hi):
    a = math_n(nt, 'GREATER_THAN', z, lo)
    b = math_n(nt, 'LESS_THAN', z, hi)
    return math_n(nt, 'MULTIPLY', a, b)

def make_material(name, part, bake_img):
    label, tint, tex, tscale, kdet, noise_amt, flags, bands = part
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial')
    em = node(nt, 'ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    tc = node(nt, 'ShaderNodeTexCoord')
    obj = tc.outputs['Object']
    sep = node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(obj, sep.inputs[0])
    z = sep.outputs['Z']
    col = lin(tint)
    cur = mix_col(nt, 0.0, col, col)
    outer = node(nt, 'ShaderNodeAttribute', attribute_type='GEOMETRY', attribute_name='outer').outputs['Fac']
    if bands:
        wl = bands['wl']
        if 'top' in bands:
            cur = mix_col(nt, math_n(nt, 'MULTIPLY', outer, math_n(nt, 'GREATER_THAN', z, wl)), cur, lin(bands['top']))
        if 'sheer' in bands:
            z0, z1, sc = bands['sheer']
            cur = mix_col(nt, math_n(nt, 'MULTIPLY', outer, band(nt, z, z0, z1)), cur, lin(sc))
        if 'anti' in bands:
            cur = mix_col(nt, math_n(nt, 'MULTIPLY', outer, math_n(nt, 'LESS_THAN', z, wl)), cur, lin(bands['anti']))
        bw = bands.get('bootw', 0.06)
        if 'boot' in bands:
            cur = mix_col(nt, math_n(nt, 'MULTIPLY', outer, band(nt, z, wl, wl + bw)), cur, lin(bands['boot']))
        # wet band: darker from the waterline up, fading out over 0.2 m (and the whole wetted bottom a little darker)
        w = math_n(nt, 'SUBTRACT', 1.0, math_n(nt, 'DIVIDE', math_n(nt, 'SUBTRACT', z, wl), 0.2), clamp=True)
        w = math_n(nt, 'MULTIPLY', w, outer)
        dark = math_n(nt, 'SUBTRACT', 1.0, math_n(nt, 'MULTIPLY', w, 0.32))
        cur = mix_col(nt, 1.0, cur, (1, 1, 1, 1), 'MULTIPLY')
        mul = nt.nodes.new('ShaderNodeCombineColor')
        for i in range(3): nt.links.new(dark, mul.inputs[i])
        cur = mix_col(nt, 1.0, cur, mul.outputs[0], 'MULTIPLY')
    if tex is not None:
        # triplanar with the planks running along the boat on the sides and the floor, across on the transoms
        geo = node(nt, 'ShaderNodeNewGeometry')
        sn = node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sn.inputs[0])
        X, Y, Z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
        lum = None; wsum = None
        for axis, (u, v) in (('X', (Z, Y)), ('Y', (Z, X)), ('Z', (X, Y))):
            cx = nt.nodes.new('ShaderNodeCombineXYZ')
            nt.links.new(math_n(nt, 'DIVIDE', u, tscale), cx.inputs[0]); nt.links.new(math_n(nt, 'DIVIDE', v, tscale), cx.inputs[1])
            it = node(nt, 'ShaderNodeTexImage', image=tex, interpolation='Cubic')
            nt.links.new(cx.outputs[0], it.inputs[0])
            bw_ = node(nt, 'ShaderNodeRGBToBW'); nt.links.new(it.outputs['Color'], bw_.inputs[0])
            w = math_n(nt, 'POWER', math_n(nt, 'ABSOLUTE', sn.outputs[axis]), 4.0)
            term = math_n(nt, 'MULTIPLY', bw_.outputs[0], w)
            lum = term if lum is None else math_n(nt, 'ADD', lum, term)
            wsum = w if wsum is None else math_n(nt, 'ADD', wsum, w)
        lumv = math_n(nt, 'DIVIDE', lum, math_n(nt, 'MAXIMUM', wsum, 1e-4))
        d = math_n(nt, 'ADD', math_n(nt, 'MULTIPLY', lumv, kdet / LUM[tex.name]), 1 - kdet)
        dc = nt.nodes.new('ShaderNodeCombineColor')
        for i in range(3): nt.links.new(d, dc.inputs[i])
        # a hint of the texture's own hue variation too
        cur = mix_col(nt, 1.0, cur, dc.outputs[0], 'MULTIPLY')
    if noise_amt:
        nz = node(nt, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 7.0; nz.inputs['Detail'].default_value = 6.0
        nt.links.new(obj, nz.inputs['Vector'])
        f = math_n(nt, 'ADD', math_n(nt, 'MULTIPLY', nz.outputs['Fac'], 2 * noise_amt), 1 - noise_amt)
        fc = nt.nodes.new('ShaderNodeCombineColor')
        for i in range(3): nt.links.new(f, fc.inputs[i])
        cur = mix_col(nt, 1.0, cur, fc.outputs[0], 'MULTIPLY')
    if label == 'sail':
        # cloth panels: a seam every 0.55 m up the sail, slightly darker; fine weave noise; grime toward the foot
        seam = math_n(nt, 'LESS_THAN', math_n(nt, 'FRACT', math_n(nt, 'DIVIDE', z, 0.55)), 0.045)
        s1 = math_n(nt, 'SUBTRACT', 1.0, math_n(nt, 'MULTIPLY', seam, 0.16))
        wv = node(nt, 'ShaderNodeTexNoise'); wv.inputs['Scale'].default_value = 90.0; wv.inputs['Detail'].default_value = 2.0
        nt.links.new(obj, wv.inputs['Vector'])
        s2 = math_n(nt, 'MULTIPLY', s1, math_n(nt, 'ADD', math_n(nt, 'MULTIPLY', wv.outputs['Fac'], 0.08), 0.96))
        foot = math_n(nt, 'ADD', math_n(nt, 'MULTIPLY', math_n(nt, 'SUBTRACT', z, 1.7), 0.06, clamp=False), 0.9)
        s3 = math_n(nt, 'MULTIPLY', s2, math_n(nt, 'MINIMUM', foot, 1.0))
        sc_ = nt.nodes.new('ShaderNodeCombineColor')
        for i in range(3): nt.links.new(s3, sc_.inputs[i])
        cur = mix_col(nt, 1.0, cur, sc_.outputs[0], 'MULTIPLY')
    if label == 'rope':
        # twisted rope: diagonal stripes
        wv = node(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL')
        wv.inputs['Scale'].default_value = 9.0
        nt.links.new(obj, wv.inputs['Vector'])
        r = math_n(nt, 'ADD', math_n(nt, 'MULTIPLY', wv.outputs['Fac'], 0.25), 0.8)
        rc = nt.nodes.new('ShaderNodeCombineColor')
        for i in range(3): nt.links.new(r, rc.inputs[i])
        cur = mix_col(nt, 1.0, cur, rc.outputs[0], 'MULTIPLY')
    if label in ('tube',):
        # glued seams round the tube every 0.9 m along the boat
        sep2 = sep.outputs['Y']
        seam = math_n(nt, 'LESS_THAN', math_n(nt, 'FRACT', math_n(nt, 'DIVIDE', sep2, 0.9)), 0.03)
        f = math_n(nt, 'SUBTRACT', 1.0, math_n(nt, 'MULTIPLY', seam, 0.22))
        fc = nt.nodes.new('ShaderNodeCombineColor')
        for i in range(3): nt.links.new(f, fc.inputs[i])
        cur = mix_col(nt, 1.0, cur, fc.outputs[0], 'MULTIPLY')
    ao = node(nt, 'ShaderNodeAmbientOcclusion', only_local=True, inside=False, samples=24)
    ao.inputs['Distance'].default_value = 0.55
    a = math_n(nt, 'ADD', math_n(nt, 'MULTIPLY', ao.outputs['AO'], 0.62), 0.38)
    ac = nt.nodes.new('ShaderNodeCombineColor')
    for i in range(3): nt.links.new(a, ac.inputs[i])
    cur = mix_col(nt, 1.0, cur, ac.outputs[0], 'MULTIPLY')
    nt.links.new(cur, em.inputs['Color'])
    ti = node(nt, 'ShaderNodeTexImage', image=bake_img)
    nt.nodes.active = ti
    return m

# ---------- geometry ----------
def signed_volume(faces):
    v = 0.0
    for f in faces:
        vs = [x.co for x in f.verts]
        for i in range(1, len(vs) - 1):
            v += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
    return v

def components(bm):
    seen = set(); comps = []
    for f in bm.faces:
        if f in seen: continue
        st = [f]; comp = []
        while st:
            x = st.pop()
            if x in seen: continue
            seen.add(x); comp.append(x)
            for e in x.edges:
                for g in e.link_faces:
                    if g not in seen: st.append(g)
        comps.append(comp)
    return comps

def audit(bm):
    bd = sum(1 for e in bm.edges if e.is_boundary)
    nm = sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary)
    wind = 0
    for e in bm.edges:
        if len(e.link_faces) == 2:
            f1, f2 = e.link_faces; v1, v2 = e.verts
            def fw(f):
                vs = list(f.verts); i = vs.index(v1); return vs[(i + 1) % len(vs)] == v2
            if fw(f1) == fw(f2): wind += 1
    inv = 0; closed = 0
    for c in components(bm):
        if all(e.is_manifold for f in c for e in f.edges):
            closed += 1
            if signed_volume(c) < 0: inv += 1
    zero = sum(1 for f in bm.faces if f.calc_area() < 1e-8)
    return dict(faces=len(bm.faces), boundary=bd, nonmanifold=nm, wind_conflicts=wind, closed_parts=closed, inside_out_parts=inv, zero_area=zero)

def cap_mesh(name, src_bm, h, beam):
    bm = src_bm.copy()
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, h), plane_no=(0, 0, 1))
    cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    adj = {}
    for e in cut:
        a, b = e.verts; adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = set(); loops = []
    for v in adj:
        if v in seen: continue
        if len(adj[v]) != 2: continue
        loop = [v]; seen.add(v); prev = None; cur = v
        ok = True
        while True:
            nb = [x for x in adj[cur] if x is not prev]
            if not nb or len(adj[cur]) != 2: ok = False; break
            nxt = nb[0]
            if nxt is v: break
            if nxt in seen: ok = False; break
            loop.append(nxt); seen.add(nxt); prev, cur = cur, nxt
        if ok and len(loop) > 5:
            pts = [Vector((p.co.x, p.co.y)) for p in loop]
            area = 0.0
            for i in range(len(pts)):
                a, b = pts[i], pts[(i + 1) % len(pts)]
                area += a.x * b.y - b.x * a.y
            w = max(p.x for p in pts) - min(p.x for p in pts)
            loops.append((abs(area) / 2, w, pts))
    bm.free()
    big = sorted([l for l in loops if l[1] > beam * 0.45], key=lambda l: -l[0])
    inner = big[1] if len(big) > 1 else big[0]
    pts = inner[2]
    c = sum(pts, Vector((0, 0))) / len(pts)
    shrunk = [p - (p - c).normalized() * 0.02 for p in pts]
    cb = bmesh.new()
    vs = [cb.verts.new((p.x, p.y, h)) for p in shrunk]
    f = cb.faces.new(vs)
    bmesh.ops.triangulate(cb, faces=[f], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.recalc_face_normals(cb, faces=cb.faces[:])
    for f in cb.faces:
        if f.normal.z < 0: f.normal_flip()
    me = bpy.data.meshes.new(name + '__cap'); cb.to_mesh(me); cb.free()
    ob = bpy.data.objects.new(name + '__cap', me); bpy.context.scene.collection.objects.link(ob)
    return ob, inner[0], inner[1], len(pts)

# re-runnable: drop what an earlier run made
for o in list(bpy.data.objects):
    if o.name.startswith('pv_') or o.name.endswith('__cap') or (o.name.startswith('boat_') and '__all' in o.name):
        bpy.data.objects.remove(o)
for m in list(bpy.data.materials):
    if m.name.startswith('boat_') or m.name.startswith('pv_'): bpy.data.materials.remove(m)
for i in list(bpy.data.images):
    if i.name.startswith('boat_'): bpy.data.images.remove(i)
for me_ in list(bpy.data.meshes):
    if me_.users == 0: bpy.data.meshes.remove(me_)
report = {}
made = []
# the round 31 import carries the same object names: rename the sources first
for n in list(SPEC) + ['pier']:
    o = bpy.data.objects.get(n + '__all')
    if o and not o.name.startswith('src31_') and o.data.name.startswith('RootNode'):
        o.name = 'src31_' + n
for k in SPEC: SPEC[k]['src'] = 'src31_' + k
for name, spec in SPEC.items():
    src = bpy.data.objects[spec['src']]
    me = src.data.copy()
    me.name = name + '_35'
    col = me.color_attributes[0]
    # face key from the round 31 colour (read on the mesh, linear, shown as x^(1/2.2) like the palette table above)
    keys = list(spec['parts'].keys())
    pka0 = me.attributes.new('pk', 'INT', 'FACE')
    for p in me.polygons:
        c = col.data[p.loop_indices[0]].color
        pka0.data[p.index].value = keys.index(classify(spec, tuple(max(0, x) ** (1 / 2.2) for x in c[:3])))
    bm = bmesh.new(); bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    pk = bm.faces.layers.int.get('pk')
    before = audit(bm)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=1e-6)
    # closed parts must face outwards
    flipped = 0
    for c in components(bm):
        if all(e.is_manifold for f in c for e in f.edges):
            bmesh.ops.recalc_face_normals(bm, faces=c)
            if signed_volume(c) < 0:
                for f in c: f.normal_flip()
                flipped += 1
    after = audit(bm)
    # outer skin flag (a ray along the face normal leaves the boat)
    bm.faces.ensure_lookup_table(); bm.normal_update()
    tree = BVHTree.FromBMesh(bm)
    outer_l = bm.faces.layers.float.new('outer')
    for f in bm.faces:
        n = f.normal; cpos = f.calc_center_median()
        o = 0.0
        if n.z < 0.6:
            # shoot along the normal with any upward part removed: an inner wall or a mast hits the far side of the
            # hull, the outside skin and the bottom escape
            d = Vector((n.x, n.y, min(n.z, 0.0)))
            if d.length < 1e-4: d = Vector((0, 0, -1))
            d.normalize()
            hit = tree.ray_cast(cpos + d * 0.004, d, 30.0)
            if hit[0] is None: o = 1.0
        f[outer_l] = o
    # smooth with sharp edges over 34 degrees
    for f in bm.faces: f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0) < math.radians(34)
        else:
            e.smooth = False
    # cap
    cap_info = None
    if spec['cap']:
        xs = [v.co.x for v in bm.verts]
        capo, area, w, nv = cap_mesh(name, bm, spec['cap'], max(xs) - min(xs))
        cap_info = dict(h=spec['cap'], area=round(area, 2), width=round(w, 2), verts=nv)
        made.append(capo)
    # write mesh
    me2 = bpy.data.meshes.new(name + '__all')
    bm.to_mesh(me2); bm.free()
    for a in list(me2.color_attributes): me2.color_attributes.remove(a)
    ob = bpy.data.objects.new(name + '__all', me2); bpy.context.scene.collection.objects.link(ob)
    # outer and part ids as face attributes for the bake
    # flags per corner
    fl = me2.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    pka = me2.attributes['pk'].data
    for p in me2.polygons:
        part = spec['parts'][keys[pka[p.index].value]]
        s_, m_, r_ = part[6]
        for li in p.loop_indices: fl.data[li].color = (s_, m_, r_, 1.0)
    me2.color_attributes.active_color = fl
    # materials per part
    img = bpy.data.images.new(name + '_albedo', spec['res'], spec['res'], alpha=False)
    img.colorspace_settings.name = 'sRGB'
    for i, k in enumerate(keys):
        me2.materials.append(make_material(name + '_' + spec['parts'][k][0], spec['parts'][k], img))
    for p in me2.polygons: p.material_index = pka[p.index].value
    # UVs
    while me2.uv_layers: me2.uv_layers.remove(me2.uv_layers[0])
    uvl = me2.uv_layers.new(name='UVMap'); me2.uv_layers.active = uvl; uvl.active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(58), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    try:
        bpy.ops.uv.pack_islands(margin=0.004, rotate=True)
    except Exception as e:
        print('pack', e)
    bpy.ops.object.mode_set(mode='OBJECT')
    report[name] = dict(before=before, after=after, flipped_parts=flipped, cap=cap_info, tris=sum(len(p.vertices) - 2 for p in me2.polygons))
    made.append(ob)
print('prep done', round(time.time() - T0, 1))
for k, v in report.items(): print(k, v)
BOATS35 = made
REPORT35 = report

# ---------- bake (Cycles, GPU when there is one): EMIT = albedo x AO ----------
s = bpy.context.scene
try:
    s.render.engine = 'CYCLES'
except TypeError as e:
    print(e)
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    s.cycles.device = 'GPU'
except Exception as e:
    print('gpu', e)
s.cycles.samples = 16
for m in bpy.data.materials:
    if m.name.startswith('boat_') and m.node_tree:
        for nd in m.node_tree.nodes:
            if nd.type == 'AMBIENT_OCCLUSION': nd.samples = 32
for n in SPEC:
    t = time.time()
    ob = bpy.data.objects[n + '__all']
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='EMIT', margin=8, use_clear=True)
    img = bpy.data.images[n + '_albedo']
    img.filepath_raw = f'{SCRATCH}/{n}_albedo.png'; img.file_format = 'PNG'; img.save()
    print('baked', n, round(time.time() - t, 1), os.path.getsize(img.filepath_raw))

# ---------- export (positions, normals, UVs, the flags colour; no materials) ----------
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
print('exported', os.path.getsize(out))
# then, in a shell: cwebp -q 80 -m 6 asset-src/bake35/<model>_albedo.png -o public/assets/textures/<model>_albedo.webp
