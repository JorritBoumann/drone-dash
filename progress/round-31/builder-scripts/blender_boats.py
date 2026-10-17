# Round 31 builder: Blender 5.2.2 steps run through the Blender MCP (execute_blender_code), kept for the record.
# Imported first with import_asset (Poly Pizza, CC0 only): Sail Boat BgSZXwmm7k (RootNode), Small Ship W2vMzztgIi
# (RootNode.001, not used), Boat 5UEl54KsuC (RootNode.002), Boat OknDJkGeJ8 (RootNode.003, not used),
# Cruise Ship yq9EKmEmfC (RootNode.004), Lifeboat Bkd4KKQA4O (RootNode.005), Dock XViKoBh2UN (RootNode.006).
# The scene was a fresh unsaved one; nothing was saved to a .blend file.
import bpy, bmesh, os
exec(open('/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/progress/round-28/builder-scripts/blender_pipeline.py').read())

spec = {'boat_sail': 'RootNode', 'boat_row': 'RootNode.002', 'boat_ferry': 'RootNode.004', 'boat_rib': 'RootNode.005', 'pier': 'RootNode.006'}
target_len = {'boat_sail': 7.0, 'boat_row': 4.6, 'boat_ferry': 20.0, 'boat_rib': 5.2, 'pier': 8.0}
made = []
for name, root in spec.items():
    me, cols = flatten(root)                      # root space, one sRGB colour per face
    bm = bmesh.new(); bm.from_mesh(me)
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2; z0 = min(zs) if name != 'pier' else 0.0
    L = max(ys) - min(ys)
    def width(sel):
        w = [v.co.x for v in bm.verts if sel(v.co.y)]
        return (max(w) - min(w)) if w else 0
    # the narrower end of the hull is the bow; it must end up on -Y (glTF +Z, the game's forward)
    flip = width(lambda y: y > max(ys) - L * 0.12) < width(lambda y: y < min(ys) + L * 0.12) and name != 'pier'
    for v in bm.verts:
        v.co.x -= cx; v.co.y -= cy; v.co.z -= z0      # centred, keel at z = 0 (the dock keeps its own deck height)
        if flip: v.co.x = -v.co.x; v.co.y = -v.co.y
    bm.to_mesh(me); bm.free()
    s = target_len[name] / L
    for v in me.vertices: v.co *= s
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for p, c in zip(me.polygons, cols):
        lc = (s2l(c[0]), s2l(c[1]), s2l(c[2]), 1.0)
        for li in p.loop_indices: attr.data[li].color = lc
    me.materials.clear()
    ob = bpy.data.objects.new(name + '__all', me); bpy.context.scene.collection.objects.link(ob)
    made.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for ob in made: ob.select_set(True)
out = '/Users/jorritboumann/projects/browser-game-lab/games/drone-dash/public/assets/models/boats.glb'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_materials='NONE',
                          export_texcoord=False, export_normals=True, export_yup=True)
print(os.path.getsize(out))
