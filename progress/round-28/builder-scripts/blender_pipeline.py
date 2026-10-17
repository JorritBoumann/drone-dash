# Round 28 builder: the Blender (5.2) pipeline used through the Blender MCP (execute_blender_code), kept for the record.
# Run inside Blender after importing the Poly Pizza models (import_asset, CC0 only) into a fresh scene "dd_assets".
# 1. flatten(root): every mesh under an imported root, in root space, with one sRGB colour per face (sampled from the
#    kit's palette texture at the face's UV centre, or the material base colour when there is no texture).
# 2. build(root, out, classify, ratios, size): scale to the game's box (cars: the round 22 VDIM sizes, length on -Y = front),
#    ground at z = 0, split faces into roles (cars: paint / glass / trim; trees: canopy / trunk; props: all), write the
#    colour as a linear corner colour attribute ("Col"), paint and canopy as a grey shade so the game can tint them per
#    instance, and add a Decimate (collapse) modifier per role (cars trim 0.38, paint 0.8; trees canopy 0.13 / 0.33,
#    trunk 0.45 / 0.55).
# 3. export(objs, out): GLB, selection only, modifiers applied, no materials, no UVs, normals, vertex colours, +Y up.
import bpy, bmesh, colorsys, mathutils, os

OUT = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/public/assets/models'

def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

_cache = {}
def img_px(img):
    if img.name not in _cache:
        _cache[img.name] = (img.size[0], img.size[1], img.pixels[:])
    return _cache[img.name]

def face_srgb(me, p, uv):
    mat = me.materials[p.material_index] if len(me.materials) else None
    img = None
    if mat and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                img = n.image
    if img and uv:
        u = sum(uv.data[l].uv[0] for l in p.loop_indices) / p.loop_total
        v = sum(uv.data[l].uv[1] for l in p.loop_indices) / p.loop_total
        w, h, px = img_px(img)
        x = min(w - 1, max(0, int((u % 1.0) * w))); y = min(h - 1, max(0, int((v % 1.0) * h))); i = (y * w + x) * 4
        return (px[i], px[i + 1], px[i + 2])
    bs = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat and mat.node_tree else None
    if bs:
        c = bs.inputs['Base Color'].default_value
        return tuple(x ** (1 / 2.2) for x in c[:3])
    return (0.8, 0.8, 0.8)

def flatten(root_name):
    root = bpy.data.objects[root_name]
    inv = root.matrix_world.inverted()
    objs = [c for c in [root] + list(root.children_recursive) if c.type == 'MESH']
    bm_all = bmesh.new(); cols = []
    for o in objs:
        me = o.data; uv = me.uv_layers.active
        fc = [face_srgb(me, p, uv) for p in me.polygons]
        tmp = me.copy(); tmp.transform(inv @ o.matrix_world)
        bm = bmesh.new(); bm.from_mesh(tmp); bm.faces.ensure_lookup_table()
        vmap = {v: bm_all.verts.new(v.co) for v in bm.verts}
        for f in bm.faces:
            try:
                bm_all.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            cols.append(fc[f.index])
        bm.free(); bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new(root_name + '_flat'); bm_all.to_mesh(me); bm_all.free()
    return me, cols

# build() and export() as described above; see the round 28 builder notes for the exact calls and the classifiers:
#   cars:  paint = saturation > 0.35 and hue within 0.07 of the body hue; glass = grey (sat < 0.22, value 0.3..0.62) in the
#          upper half; the rest trim.
#   trees: canopy = saturation > 0.4 and hue 0.12..0.4; the rest trunk.
