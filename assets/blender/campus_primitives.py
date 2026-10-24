"""Small original geometry library for the Xelograph campus; no downloaded models."""
import bpy,math

def material(name,hex_color,roughness=.8,metallic=0):
 color=[int(hex_color.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
 linear=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in color]
 m=bpy.data.materials.new(name);m.diffuse_color=(*linear,1);m.use_nodes=True
 shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 shader.inputs['Base Color'].default_value=(*linear,1);shader.inputs['Roughness'].default_value=roughness;shader.inputs['Metallic'].default_value=metallic
 return m
def cube(name,loc,size,mat,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Rounded edges','BEVEL');mod.width=bevel;mod.segments=2
  o.modifiers.new('Face normals','WEIGHTED_NORMAL')
 return o
def cylinder(name,loc,radius,depth,mat,vertices=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o
def ico(name,loc,size,mat,subdivisions=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(mat);return o
def cone(name,loc,radius,height,mat):
 bpy.ops.mesh.primitive_cone_add(vertices=8,radius1=radius,radius2=.06,depth=height,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o
def torus(name,loc,radius,thickness,mat):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,major_radius=radius,minor_radius=thickness,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(mat);return o
def text(name,label,loc,size,mat,rotation=(math.pi/2,0,0)):
 curve=bpy.data.curves.new(name,'FONT');curve.body=label;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=.004;curve.resolution_u=2
 o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rotation;o.data.materials.append(mat)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');return bpy.context.object
def apply_modifiers(o):
 if o.type=='MESH' and len(o.modifiers):
  mesh=bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()));o.modifiers.clear();o.data=mesh
def join_objects(name,objects,occluder=False):
 objects=[o for o in objects if o.type=='MESH']
 for o in objects:apply_modifiers(o)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 if occluder:o['camera_occluder']=True
 return o
def new_objects(before):return [o for o in bpy.context.scene.objects if o not in before]
