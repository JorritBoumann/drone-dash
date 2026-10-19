# Round 38 builder: smoother rib tubes. Run through the Blender MCP (execute_blender_code) in the unsaved round 35/36
# scene "dd_boats35" (no .blend file saved). Same CC0 Quaternius lifeboat as rounds 31 to 37; no new asset, no generation.
# The round 36 rib mesh is kept as a fake-user copy "boat_rib__all_r36bak" and the pass always starts from it.
import bpy, bmesh, math, os
ob = bpy.data.objects['boat_rib__all']; me = ob.data
if 'boat_rib__all_r36bak' not in bpy.data.meshes:
    bk = me.copy(); bk.name = 'boat_rib__all_r36bak'; bk.use_fake_user = True
bk = bpy.data.meshes['boat_rib__all_r36bak']
bm = bmesh.new(); bm.from_mesh(bk)
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
hull = set(max(comps, key=len))  # tubes, bands, strake, floor; the other three components are the seats
LIM = math.radians(62)
# the hull: every gently curved edge (under 62 degrees between its faces) gets one cut, the new points pulled onto the
# smooth surface (the tube cross-section goes from 8 to 16 sides and the bow cone rounds off); the creases (tube to
# floor, 90 degrees) stay. The seats (long thin cylinders: a smooth cut pinches them into peanuts) only get smooth
# shading across their sides.
edges = [e for e in bm.edges if len(e.link_faces) == 2 and all(g in hull for g in e.link_faces) and e.calc_face_angle(0) < LIM]
bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, smooth=1.0, use_grid_fill=True, use_smooth_even=True)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
for e in bm.edges:
    if len(e.link_faces) == 2 and e.calc_face_angle(0) < LIM:
        e.smooth = True
        for f in e.link_faces: f.smooth = True
bm.to_mesh(me); bm.free(); me.update()
print('rib tris', sum(len(p.vertices) - 2 for p in me.polygons))  # 626 -> 1908
# export: the round 36 export block unchanged (same objects and settings), to the scratchpad, then copied to
# public/assets/models/boats.glb
S = '/private/tmp/claude-501/-Users-jorritboumann-projects-browser-game-lab/c70bfd6f-b51c-4910-b300-7e4c0c36b628/scratchpad/r38/boats38c.glb'
pier = bpy.data.objects.get('src31_pier')
if pier: pier.name = 'pier__all'; pier.location = (0, 0, 0)
exp = [bpy.data.objects[n] for n in ['boat_sail__all', 'boat_row__all', 'boat_rib__all', 'boat_ferry__all', 'boat_sail__cap', 'boat_row__cap', 'boat_rib__cap', 'pier__all']]
hidden = {o.name: o.hide_get() for o in bpy.context.scene.objects}
for o in bpy.context.scene.objects:
    o.hide_set(False); o.select_set(False)
for o in exp:
    o.location = (0, 0, 0); o.select_set(True)
bpy.ops.export_scene.gltf(filepath=S, export_format='GLB', use_selection=True, use_active_scene=True, export_apply=True,
                          export_materials='NONE', export_texcoords=True, export_normals=True, export_yup=True,
                          export_vertex_color='ACTIVE', export_attributes=False)
if pier: pier.name = 'src31_pier'
for o in bpy.context.scene.objects:
    if o.name in hidden: o.hide_set(hidden[o.name])
print('exported', os.path.getsize(S))  # 499,976 bytes
