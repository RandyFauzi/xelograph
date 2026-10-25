import bpy
from campus_primitives import *

def create_avatar():
 skin=material('AvatarSkin','#c78e65');shirt=material('AvatarShirt','#367fcb');pants=material('AvatarPants','#344859');hair=material('AvatarHair','#49362b');shoe=material('AvatarShoe','#f6f3e7');ink=material('AvatarEyes','#253644');hat=material('AvatarCap','#f0b168')
 cube('Torso',(0,0,.87),(.5,.31,.51),shirt,.095)
 cube('Body_female_Torso',(0,0,.88),(.43,.30,.49),shirt,.09)
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.36,radius2=.225,depth=.34,location=(0,0,.63))
 skirt=bpy.context.object;skirt.name='Body_female_Skirt';skirt.scale.y=.68;skirt.data.materials.append(shirt)
 skirt.modifiers.new('Soft hem','BEVEL').width=.018
 skirt.modifiers.new('Hem normals','WEIGHTED_NORMAL')
 cube('Collar',(0,-.012,1.105),(.24,.28,.05),shoe,.025)
 for side,x in [('L',-.145),('R',.145)]:
  before=set(bpy.context.scene.objects)
  cube('Trouser_'+side,(x,0,.39),(.19,.225,.43),pants,.045)
  cube('Sneaker_'+side,(x,-.055,.14),(.225,.33,.16),shoe,.05)
  cube('Sole_'+side,(x,-.055,.075),(.23,.335,.035),shirt,.012)
  for y in [-.07,-.12]:cube('Shoelace',(x,y,.227),(.12,.018,.014),ink)
  pivot=bpy.data.objects.new('Leg_'+side,None);bpy.context.collection.objects.link(pivot);pivot.location=(x,0,.61)
  bpy.context.view_layer.update()
  for o in new_objects(before):
   if o!=pivot:matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
 for side,x in [('L',-.34),('R',.34)]:
  before=set(bpy.context.scene.objects)
  cube('Sleeve_'+side,(x,0,.88),(.16,.24,.31),shirt,.06)
  cube('Forearm_'+side,(x,0,.66),(.13,.17,.19),skin,.045)
  ico('Hand_'+side,(x,-.015,.55),(.085,.09,.1),skin,2)
  pivot=bpy.data.objects.new('Arm_'+side,None);bpy.context.collection.objects.link(pivot);pivot.location=(x,0,1.02)
  bpy.context.view_layer.update()
  for o in new_objects(before):
   if o!=pivot:matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
 ico('Head',(0,0,1.4),(.29,.265,.32),skin,3)
 for x in [-.278,.278]:ico('Ear',(x,.015,1.39),(.045,.055,.075),skin,2)
 ico('Hair_short',(0,.015,1.59),(.3,.27,.18),hair,2)
 ico('Hair_bob',(0,.09,1.43),(.325,.235,.34),hair,2)
 ico('Hair_long_back',(0,.135,1.33),(.325,.205,.44),hair,2)
 ico('Hair_long_crown',(0,.02,1.61),(.31,.275,.17),hair,2)
 for x in [-.265,.265]:ico('Hair_long_side',(x,-.025,1.32),(.075,.19,.35),hair,2)
 ico('Hair_cap',(0,.015,1.62),(.305,.275,.145),hat,2)
 cube('Cap_brim',(0,-.22,1.64),(.38,.27,.04),hat,.035)
 for x in [-.1,.1]:
  ico('Eye',(x,-.25,1.42),(.024,.016,.03),ink,2)
  cube('Brow',(x,-.247,1.49),(.06,.015,.012),hair,.004)
 cube('Smile',(0,-.26,1.29),(.065,.012,.012),hair,.005)
 # Additional full looks: hairstyles and garments are authored together, not just relabelled.
 scarf=material('AvatarScarf','#d9c9ab')
 ico('Hair_quiff_base',(0,.015,1.59),(.30,.27,.17),hair,2)
 sweep=ico('Hair_quiff_sweep',(-.055,-.13,1.70),(.25,.16,.135),hair,2);sweep.rotation_euler.y=-.22
 ico('Hair_ponytail_crown',(0,.035,1.59),(.30,.27,.18),hair,2)
 fringe=ico('Hair_ponytail_fringe',(-.09,-.17,1.585),(.19,.13,.12),hair,2);fringe.rotation_euler.y=-.2
 ico('Hair_ponytail_tie',(.22,.19,1.49),(.12,.13,.115),hair,2)
 tail=ico('Hair_ponytail_tail',(.34,.22,1.27),(.12,.125,.25),hair,2);tail.rotation_euler.y=-.18
 cube('Hair_ponytail_band',(.23,.19,1.47),(.17,.075,.05),shirt,.018)
 ico('Hair_hijab_back',(0,.115,1.42),(.33,.24,.35),scarf,2)
 ico('Hair_hijab_crown',(0,.012,1.59),(.316,.278,.18),scarf,2)
 for x in [-.263,.263]:
  fold=ico('Hair_hijab_side',(x,-.04,1.34),(.077,.205,.30),scarf,2);fold.rotation_euler.y=.12 if x<0 else -.12
 ico('Hair_hijab_neck',(0,.015,1.125),(.27,.24,.12),scarf,2)
 # Sporty female: ponytail, hoodie, front pocket, and trousers with no dress layer.
 cube('Look_female_ponytail_Torso',(0,0,.87),(.47,.32,.52),shirt,.085)
 ico('Look_female_ponytail_Hood',(0,.08,1.075),(.255,.20,.10),shirt,2)
 cube('Look_female_ponytail_Pocket',(0,-.174,.76),(.25,.025,.11),shirt,.025)
 for x in [-.075,.075]:cube('Look_female_ponytail_Drawstring',(x,-.178,1.01),(.014,.015,.15),shoe,.005)
 cube('Look_female_ponytail_Hem',(0,0,.625),(.445,.315,.055),pants,.018)
 # Hijab female: long tunic, long skirt, and arm-attached long sleeves.
 cube('Look_female_hijab_Tunic',(0,0,.83),(.45,.32,.56),shirt,.07)
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.35,radius2=.22,depth=.56,location=(0,0,.48))
 long_skirt=bpy.context.object;long_skirt.name='Look_female_hijab_Long_skirt';long_skirt.scale.y=.68;long_skirt.data.materials.append(shirt)
 long_skirt.modifiers.new('Soft long hem','BEVEL').width=.018
 for side,x in [('L',-.34),('R',.34)]:
  sleeve=cube('Look_female_hijab_Sleeve_'+side,(x,0,.79),(.17,.245,.49),shirt,.055)
  bpy.context.view_layer.update();matrix=sleeve.matrix_world.copy();sleeve.parent=bpy.data.objects['Arm_'+side];sleeve.matrix_world=matrix
 # Male jacket: sculpted quiff, contrasting tee, zipper and lapels.
 cube('Look_male_quiff_Jacket',(0,0,.87),(.515,.33,.53),shirt,.075)
 cube('Look_male_quiff_Tee',(0,-.178,.9),(.17,.025,.38),shoe,.025)
 for x in [-.12,.12]:
  lapel=cube('Look_male_quiff_Lapel',(x,-.196,1.005),(.095,.035,.20),shirt,.015);lapel.rotation_euler.y=.30 if x<0 else -.30
 cube('Look_male_quiff_Zipper',(0,-.194,.73),(.014,.014,.20),pants,.004)
 cube('Look_male_quiff_Hem',(0,0,.625),(.50,.325,.045),pants,.014)
 # Male cap: separate relaxed hoodie geometry, keeping the same neutral sneakers.
 cube('Look_male_cap_Hoodie',(0,0,.87),(.53,.34,.54),shirt,.085)
 ico('Look_male_cap_Hood',(0,.085,1.08),(.28,.21,.115),shirt,2)
 cube('Look_male_cap_Pocket',(0,-.185,.76),(.28,.025,.13),shirt,.025)
 for x in [-.08,.08]:cube('Look_male_cap_Drawstring',(x,-.18,1.01),(.014,.014,.16),shoe,.005)
