"""Original small 3D easter egg inspired by the owner's wooden sign illustration.
Blender --background --python assets/blender/build_creator_relic.py
"""
import bpy, math, os, sys
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from campus_primitives import material, cube, cylinder, ico, torus, text, join_objects
ROOT = os.path.abspath(os.path.join(HERE, '../..'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
wood = material('Relic walnut', '#91603e')
wood_light = material('Relic timber', '#b17b4d')
stone = material('Relic stone', '#7b8990')
gold = material('Relic old gold', '#c7a459', .65, .2)
rope = material('Relic rope', '#d4bd8c')
leaf = material('Relic leaves', '#537d45')
ink = material('Relic lettering', '#f5deb0')
crystal = material('Relic crystal', '#73c8d3', .32, .08)
shader = crystal.node_tree.nodes.get('Principled BSDF')
shader.inputs['Emission Color'].default_value = (.13, .44, .5, 1)
shader.inputs['Emission Strength'].default_value = .18

# Actual dimensions: 1.04 m wide, 1.12 m high; smaller than a player.
cylinder('Relic pedestal', (0,0,.065), .46, .13, stone, 12)
torus('Relic gold inlay', (0,0,.14), .36, .014, gold)
for i in range(9):
 a = math.tau*i/9
 rock = ico('Relic edge stone', (.40*math.cos(a), .40*math.sin(a), .115), (.12,.10,.095), stone, 1)
 rock.rotation_euler.z = a
for x in [-.39,.39]:
 cylinder('Relic wooden post', (x,.13,.61), .057, 1.02, wood, 8)
 cube('Relic post cap', (x,.13,1.10), (.14,.14,.055), wood_light, .012)
 for z in [.35,.39,1.015,1.045]: torus('Relic rope wrap', (x,.13,z), .064, .011, rope)
for i in range(3):
 cube('Relic sign plank', (0,.11,.75+i*.12), (.87,.085,.113), wood_light if i%2 else wood, .013)
for x in [-.35,.35]:
 for z in [.77,.98]:
  bolt=ico('Relic brass bolt', (x,.054,z), (.021,.012,.021), gold, 1)
text('Relic small credit', 'DIBUAT OLEH', (0,.057,.974), .048, ink)
text('Relic creator name', 'Randy Fauzi', (0,.055,.866), .088, ink)
text('Relic maker signature', 'DEVELOPHER', (0,.055,.766), .032, gold)
# Tiny crown emblem at the upper edge, with true thickness.
vertices=[(-.085,.07,1.04),(.085,.07,1.04),(.11,.07,1.135),(.035,.07,1.09),(0,.07,1.16),(-.035,.07,1.09),(-.11,.07,1.135)]
mesh=bpy.data.meshes.new('Relic crown mesh');mesh.from_pydata(vertices,[],[tuple(range(7))]);mesh.materials.append(gold)
crown=bpy.data.objects.new('Relic crown',mesh);bpy.context.collection.objects.link(crown)
crown.modifiers.new('Emblem thickness','SOLIDIFY').thickness=.018
# Low-poly crystal: genuine faceted geometry, no image planes or textures.
vertices=[(0,0,.26),(0,0,-.16),(-.10,-.075,0),(.10,-.075,0),(.10,.075,0),(-.10,.075,0)]
faces=[(0,2,3),(0,3,4),(0,4,5),(0,5,2),(1,3,2),(1,4,3),(1,5,4),(1,2,5)]
mesh=bpy.data.meshes.new('Relic cut crystal');mesh.from_pydata(vertices,[],faces);mesh.materials.append(crystal)
gem=bpy.data.objects.new('CreatorCrystal',mesh);bpy.context.collection.objects.link(gem);gem.location=(0,-.16,.40)
for x,y in [(-.27,-.22),(.27,-.18),(-.34,.23),(.31,.26)]:
 ico('Relic little moss',(x,y,.19),(.085,.075,.055),leaf,1)
 cylinder('Relic rune', (x*.8,y*.8,.14), .022, .009, gold, 6)
# Merge static meshes by material, preserving only the crystal for subtle runtime motion.
groups={}
for obj in list(bpy.context.scene.objects):
 if obj.type=='MESH' and obj != gem: groups.setdefault(obj.data.materials[0].name,[]).append(obj)
for name,objects in groups.items(): join_objects(name.replace(' ','_'),objects)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE,'creator-relic.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/creator-relic.glb'),export_format='GLB',export_apply=True)

# Render a preview of the actual geometry for the credit popup and visual verification.
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world.color=(.65,.72,.78)
bpy.ops.object.light_add(type='AREA',location=(-2,-3,5));bpy.context.object.data.energy=350;bpy.context.object.data.size=4
bpy.ops.object.light_add(type='AREA',location=(2,1,3));bpy.context.object.data.energy=180;bpy.context.object.data.size=3
bpy.ops.object.camera_add(location=(1.65,-2.8,1.8));camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,.57))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=1.55;scene.camera=camera
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.filepath=os.path.join(ROOT,'public/branding/creator-relic-preview.png')
bpy.ops.render.render(write_still=True)
print('Small creator relic exported and rendered.')
