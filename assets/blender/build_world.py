"""Reproducible original low-poly assets. Run with Blender --background --python this_file."""
import bpy, math, random, os
from mathutils import Vector
random.seed(27)
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public','models')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)
def mat(name,color):
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Roughness'].default_value=.85
 return m
cream=mat('Warm limestone',(.84,.79,.64)); path=mat('Sand paths',(.92,.85,.69)); grass=mat('Meadow sage',(.44,.58,.36)); edge=mat('Island earth',(.43,.48,.32)); white=mat('Warm plaster',(.93,.90,.79)); roof=mat('Terracotta tiles',(.68,.32,.20)); green=mat('Sage canopy',(.28,.44,.28)); lime=mat('Light canopy',(.59,.66,.36)); wood=mat('Walnut',(.33,.22,.15)); dark=mat('Ink green',(.12,.24,.21)); water=mat('Still blue pond',(.39,.65,.64)); clay=mat('Clay details',(.78,.43,.29)); gold=mat('Ochre',(.89,.65,.28))
def cube(name,loc,scale,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Soft corners','BEVEL');mod.width=bevel;mod.segments=2; o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,radius,depth,material,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material);return o
def ico(name,loc,scale,material,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material);return o
def join_occluder(name,objects):
 depsgraph=bpy.context.evaluated_depsgraph_get()
 for o in objects:
  if o.type=='MESH' and len(o.modifiers):
   mesh=bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph));o.modifiers.clear();o.data=mesh
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
 result=bpy.context.object;result.name=name;result['camera_occluder']=True
 return result
def tree(x,y,s=1):
 before=set(bpy.context.scene.objects)
 cyl('Tree trunk',(x,y,.9*s),.14*s,1.8*s,wood,7)
 ico('Faceted foliage',(x,y,2.2*s),(1.05*s,.95*s,1.3*s),green if random.random()>.35 else lime,2)
 ico('Foliage crown',(x+.3*s,y,2.95*s),(.6*s,.65*s,.65*s),lime,1)
 join_occluder('Tree_occluder',[o for o in bpy.context.scene.objects if o not in before])
def bench(x,y,rot=0):
 objs=[]
 for z,sy,dy in [(.48,.5,0),(.95,.12,.23)]:objs.append(cube('Bench timber',(x,y+dy,z),(1.35,sy,.13 if z<.5 else .55),wood,.03))
 for dx in [-.48,.48]:objs.append(cube('Bench legs',(x+dx,y,.23),(.09,.4,.45),dark))
def building(x,y,w,d):
 before=set(bpy.context.scene.objects)
 cube('School plaster',(x,y,1.25),(w,d,2.5),white,.06)
 # pitched roof mesh
 verts=[(x-w/2-.3,y-d/2-.3,2.5),(x+w/2+.3,y-d/2-.3,2.5),(x-w/2-.3,y+d/2+.3,2.5),(x+w/2+.3,y+d/2+.3,2.5),(x-w/2-.3,y,3.6),(x+w/2+.3,y,3.6)]
 mesh=bpy.data.meshes.new('RoofMesh');mesh.from_pydata(verts,[],[(0,1,5,4),(4,5,3,2),(0,4,2),(1,3,5),(0,2,3,1)]);mesh.materials.append(roof);o=bpy.data.objects.new('Pitched school roof',mesh);bpy.context.collection.objects.link(o)
 for i in range(int(w/1.6)):
  xx=x-w/2+1+i*1.6
  cube('Window frame',(xx,y-d/2-.025,1.35),(.85,.08,1.1),cream,.025);cube('Window glass',(xx,y-d/2-.075,1.35),(.68,.04,.93),dark)
  cube('Window mullion',(xx,y-d/2-.105,1.35),(.04,.02,.94),cream)
 cube('School front door',(x,y-d/2-.09,.85),(.85,.08,1.7),wood,.03)
 join_occluder('Building_occluder',[o for o in bpy.context.scene.objects if o not in before])
# Raised island with a generous, readable trail.
cube('Floating garden foundation',(0,0,-.55),(51,43,1.1),edge,.9)
cube('Meadow',(0,0,.015),(50.7,42.7,.18),grass,.65)
cube('Main promenade',(0,-.5,.13),(3,38,.12),path,.15)
cube('Cross garden path',(0,.5,.16),(46,2.3,.1),path,.15)
cube('Rear garden path',(0,7,.17),(21,2,.1),path,.15)
cyl('Central plaza',(0,1,.18),4,.15,cream,48)
cyl('Plaza inset',(0,1,.27),2.55,.06,path,48)
cyl('Fountain base',(0,1,.4),1,.28,white,24)
cyl('Fountain pool',(0,1,.56),.82,.06,water,32)
cyl('Fountain column',(0,1,.9),.18,.7,cream)
cyl('Fountain bowl',(0,1,1.24),.52,.13,white,20)
ico('Fountain water jewel',(0,1,1.45),(.14,.14,.23),water,2)
building(-6,8.4,8,3.8);building(5.4,8.4,6.5,3.8)
# Entrance arch toward foreground (negative Blender Y).
for x in [-2.1,2.1]:
 cube('Welcome gate pillar',(x,-9,1.55),(.4,.45,3),white,.08)
cube('Welcome gate sign',(0,-9,3),(4.7,.5,.65),dark,.1)
cube('Welcome gate inlay',(0,-9.28,3),(3.65,.04,.08),gold)
# Seven checkpoints: exported coordinates are transformed to x, z=-y in Three.
checkpoints=[(-6,-6),(-9,-1),(-8,4),(7,4),(10,-1),(7,-6),(0,5.3)]
for i,(x,y) in enumerate(checkpoints):
 cyl('Checkpoint_%d_pad'%(i+1),(x,y,.24),1.25,.2,cream,24)
 for dx in [-.65,.65]:cyl('Checkpoint post',(x+dx,y+.3,.95),.065,1.45,wood,8)
 cube('Checkpoint_%d_board'%(i+1),(x,y+.3,1.45),(1.65,.16,.8),dark,.06)
 cube('Checkpoint accent',(x,y+.2,1.15),(1.5,.03,.055),clay)
 cyl('Checkpoint marker',(x,y+.3,2.12),.21,.1,gold,12).rotation_euler[0]=math.pi/2
# Crew pergola, supporter pond, reunion stage.
cube('Crew deck',(-9,3.8,.25),(4,4,.25),wood,.1)
for x in [-10.6,-7.4]:
 for y in [2.2,5.4]:cube('Pergola pillar',(x,y,1.4),(.12,.12,2.6),cream)
for y in [2.2,2.8,3.4,4,4.6,5.4]:cube('Pergola rafters',(-9,y,2.75),(3.7,.12,.15),wood)
cyl('Supporter pond',(10,-6,.2),2.1,.11,cream,32);cyl('Pond surface',(10,-6,.28),1.85,.05,water,32)
for dx,dy in [(.8,.5),(-.8,-.4),(.1,-1)]:cyl('Lily pad',(10+dx,-6+dy,.32),.24,.025,green,10)
cube('Stage',(7,5.7,.4),(4.5,2,.6),wood,.12)
cube('Stage backdrop',(7,6.5,1.55),(4.5,.16,2),dark,.08)
for x in [5.4,8.6]:cube('Stage speaker',(x,5.8,.95),(.4,.4,.7),dark,.05)
for x,y in [(-3,-3),(3,-3),(-4,3),(4,3),(-11,-4),(11,3)]:bench(x,y)
for x,y in [(-12,-8),(-11,7),(-12,1),(-4,-8),(4,-8),(12,8),(12,-9),(-2,9),(2,9),(-12,-2),(12,5),(-5,4),(5,-4)]:tree(x,y,random.uniform(.75,1.15))
for i in range(45):
 x=random.uniform(-13,13);y=random.choice([-10.1,10.1])+random.uniform(-.35,.35)
 ico('Garden shrub',(x,y,.5),(.45,.4,.45),lime if i%2 else green)
for x in [-3.8,3.8]:
 for y in [-6,5]:
  cyl('Lamp post',(x,y,1.1),.055,2,dark,8);ico('Lamp lantern',(x,y,2.15),(.18,.18,.24),gold,1)
# Expanded campus: outer gardens, sports court, picnic pavilion and lake.
cube('Outer north walkway',(0,15,.15),(44,2.1,.1),path,.1)
cube('Outer south walkway',(0,-14,.15),(44,2.1,.1),path,.1)
for x in [-15,15]:cube('Garden side avenue',(x,0,.155),(2,30,.1),path,.1)
court=mat('Court sage',(.32,.49,.41))
cube('Basketball court',(-19,0,.17),(7,11,.12),court,.12)
for x in [-22.1,-15.9]:cube('Court sideline',(x,0,.245),(.06,10.4,.018),white)
for y in [-5.2,0,5.2]:cube('Court baseline',(-19,y,.245),(6.25,.06,.018),white)
for y in [-3.9,3.9]:
 cube('Court key',(-19,y,.25),(2.4,.045,.02),white)
 for x in [-20.2,-17.8]:cube('Court key line',(x,y,.25),(.045,2.6,.02),white)
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=4,location=(-19,y,.25),major_radius=1.2,minor_radius=.022)
 bpy.context.object.name='Court circle';bpy.context.object.data.materials.append(white)
for y in [-5.6,5.6]:
 cyl('Basketball post',(-19,y,1.4),.065,2.5,dark,8)
 cube('Basketball backboard',(-19,y,2.6),(1.3,.1,.8),white,.04)
 cube('Backboard square',(-19,y-.06,2.6),(.5,.02,.38),clay,.02)
building(19,12,4.5,3)
cube('Picnic pavilion',(19,9.7,.3),(5,2,.35),wood,.06)
for x,y in [(18,9.2),(20,9.2),(-19,9),(-19,12),(-6,-16),(6,-16)]:
 cyl('Picnic table',(x,y,.8),.8,.12,cream,12)
 cyl('Picnic pedestal',(x,y,.45),.1,.7,dark,8)
 for dx in [-1,1]:bench(x+dx,y+.9)
cyl('Outer lake bank',(18,-12,.2),2.65,.15,cream,48)
cyl('Outer lake',(18,-12,.3),2.4,.08,water,48)
for dx,dy in [(.7,.6),(-1,-.5),(.9,-1.2)]:cyl('Lake lily',(18+dx,-12+dy,.36),.3,.02,green,10)
cube('Lakeside deck',(14.5,-12,.36),(2,4,.25),wood,.07)
for y in [-13.4,-12.8,-12.2,-11.6,-11,-10.6]:cube('Deck board',(14.5,y,.51),(2,.04,.02),cream)
for x,y in [(-23,-17),(-21,-16),(-18,-18),(-12,-18),(-8,-19),(8,-19),(12,-18),(22,-17),(23,-8),(23,-3),(23,3),(23,7),(-23,-8),(-23,7),(-22,12),(-22,17),(-17,18),(-12,18),(-6,18),(0,18),(6,18),(12,18),(23,18),(-7,-12),(7,-12),(-19,-10),(-17,-11),(12,13),(-12,13)]:tree(x,y,random.uniform(.8,1.3))
for x,y in [(-10,-14),(10,-14),(-12,15),(10,15)]:
 cyl('Flower garden bed',(x,y,.25),1.45,.2,cream,16)
 for n in range(7):
  angle=n*2.4;r=.8
  ico('Flower bush',(x+math.cos(angle)*r,y+math.sin(angle)*r,.5),(.33,.33,.35),green)
  ico('Flower',(x+math.cos(angle)*r,y+math.sin(angle)*r,.8),(.13,.13,.1),clay if n%2 else gold)
for x in [-2.1,2.1]:cube('Outer entrance pillar',(x,-18,1.45),(.4,.5,2.9),white,.07)
cube('Outer entrance lintel',(0,-18,2.9),(4.7,.5,.5),dark,.08)
# Apply bevels then batch repeated scenery by material to reduce runtime draw calls.
protected={'Central plaza','Basketball court','Picnic pavilion','Outer lake'}
depsgraph=bpy.context.evaluated_depsgraph_get()
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and len(o.modifiers):
  mesh=bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph));o.modifiers.clear();o.data=mesh
groups={}
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and o.name not in protected and not o.name.startswith('Checkpoint_') and not o.get('camera_occluder',False):
  name=o.data.materials[0].name if len(o.data.materials) else 'Default'
  groups.setdefault(name,[]).append(o)
for name,objects in groups.items():
 if len(objects)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='Scenery_'+name.replace(' ','_')

# Save source + export only meshes (no lights/cameras in runtime asset).
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','blender','xelograph-world.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'world.glb'),export_format='GLB',use_selection=False,export_apply=True,export_extras=True)
# Character: original modular chibi with separate named parts for tinting / animation.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
skin=mat('AvatarSkin',(.72,.46,.29));shirt=mat('AvatarShirt',(.32,.48,.39));pants=mat('AvatarPants',(.19,.27,.25));hair=mat('AvatarHair',(.15,.11,.09));shoe=mat('AvatarShoe',(.9,.86,.73))
cube('Torso',(0,0,.83),(.48,.30,.53),shirt,.10)
for x in [-.14,.14]:
 cube('Leg_L' if x<0 else 'Leg_R',(x,0,.37),(.18,.22,.42),pants,.055)
 cube('Shoe_L' if x<0 else 'Shoe_R',(x,-.055,.12),(.21,.32,.15),shoe,.045)
for x in [-.33,.33]:
 cube('Arm_L' if x<0 else 'Arm_R',(x,0,.77),(.15,.21,.43),shirt,.06)
 ico('Hand',(x,0,.51),(.09,.09,.11),skin,2)
ico('Head',(0,0,1.38),(.29,.265,.32),skin,3)
ico('Hair_short',(0,.015,1.57),(.30,.27,.18),hair,2)
ico('Hair_bob',(0,.085,1.41),(.325,.23,.34),hair,2)
cyl('Hair_cap',(0,.015,1.62),.30,.13,clay,16)
cube('Cap_brim',(0,-.22,1.61),(.38,.27,.035),clay,.04)
for x in [-.10,.10]:ico('Eye',(x,-.248,1.40),(.025,.018,.03),dark,2)
cube('Smile',(0,-.259,1.27),(.07,.015,.018),wood,.01)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','blender','xelograph-avatar.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'avatar.glb'),export_format='GLB',export_apply=True)
print('Xelograph world and modular character exported to',OUT)
