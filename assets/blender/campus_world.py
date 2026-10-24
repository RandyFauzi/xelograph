"""Vivid miniature campus: original assets inspired by the feel of an explorable diorama."""
import bpy,math,random
from campus_primitives import *
random.seed(2027)

def create_world():
 M={key:material(key,color) for key,color in {
 'Grass':'#85b451','Grass light':'#a4c86d','Earth edge':'#cab78f','Path limestone':'#e2ddc9','Paving light':'#eee9db',
 'Road asphalt':'#515d66','Road markings':'#f3efdb','White plaster':'#f5f4e8','Roof slate':'#3f5264',
 'Timber':'#ae7848','Dark frame':'#283e4c','Blue accent':'#367fcb','Blue light':'#9fc9e4',
 'Leaf green':'#4d8b3e','Leaf lime':'#79ae4c','Leaf forest':'#316744','Bark':'#78543b',
 'Flower coral':'#ef9364','Flower blue':'#67afe0','Flower cream':'#f7e5a1','Clay pots':'#d79265',
 'Glass':'#a8cdd5','Silver':'#b7c5c5','Solar panel':'#274e71','Stone':'#b5bba6',
 }.items()}
 M['Water blue']=material('Water blue','#4aa7d4',.27,.08)
 def tree(x,y,scale=1,pine=False):
  before=set(bpy.context.scene.objects)
  cylinder('Tree trunk',(x,y,1.1*scale),.13*scale,2.1*scale,M['Bark'],7)
  if pine:
   for z,r in [(1.8,1),(2.5,.8),(3.15,.55)]:cone('Pine crown',(x,y,z*scale),r*scale,1.7*scale,M['Leaf forest'])
  else:
   for dx,dy,z,s in [(0,0,2.4,1),(.45,.1,3,.72),(-.43,.05,2.75,.7),(.1,-.43,2.7,.78)]:
    ico('Tree canopy',(x+dx*scale,y+dy*scale,z*scale),(s*scale,.85*s*scale,.95*s*scale),M['Leaf lime'] if random.random()<.4 else M['Leaf green'],1 if scale<.8 else 2)
  return join_objects('Tree_occluder',new_objects(before),True)
 def bench(x,y,angle=0):
  before=set(bpy.context.scene.objects)
  for dy in [-.19,0,.19]:cube('Bench slat',(x,y+dy,.6),(1.45,.15,.09),M['Timber'],.02)
  for z in [.88,1.07]:cube('Bench back',(x,y+.28,z),(1.45,.09,.13),M['Timber'],.02)
  for dx in [-.53,.53]:cube('Bench frame',(x+dx,y,.34),(.07,.52,.52),M['Dark frame'])
  if angle:
   for o in new_objects(before):
    dx,dy=o.location.x-x,o.location.y-y;o.location.x=x+dx*math.cos(angle)-dy*math.sin(angle);o.location.y=y+dx*math.sin(angle)+dy*math.cos(angle);o.rotation_euler.z=angle
 def lamp(x,y):
  cylinder('Lamp base',(x,y,.25),.17,.25,M['Dark frame'],10)
  cylinder('Lamp post',(x,y,1.45),.045,2.5,M['Dark frame'],8)
  cube('Lamp arm',(x,y-.15,2.7),(.07,.4,.06),M['Dark frame'])
  cube('Lamp lantern',(x,y-.28,2.65),(.27,.2,.09),M['Paving light'],.025)
 def planter(x,y):
  cube('Planter',(x,y,.35),(.7,.7,.5),M['White plaster'],.07)
  ico('Planter leaves',(x,y,.78),(.48,.45,.5),M['Leaf lime'],1)
 def building(x,y,w,d,label,style='school'):
  before=set(bpy.context.scene.objects)
  cube('Building plinth',(x,y,.36),(w+.35,d+.3,.4),M['Path limestone'],.06)
  cube('Building walls',(x,y,1.65),(w,d,2.6),M['White plaster'],.05)
  cube('Building base trim',(x,y,.55),(w+.04,d+.04,.2),M['Blue light'])
  for dx in [-w/2+.25,w/2-.25]:cube('Corner stone',(x+dx,y-d/2-.035,1.7),(.22,.09,2.5),M['Path limestone'])
  if style=='school':
   verts=[(x-w/2-.22,y-d/2-.25,3),(x+w/2+.22,y-d/2-.25,3),(x-w/2-.22,y+d/2+.25,3),(x+w/2+.22,y+d/2+.25,3),(x-w/2-.22,y,4.1),(x+w/2+.22,y,4.1)]
   mesh=bpy.data.meshes.new('Slate roof');mesh.from_pydata(verts,[],[(0,1,5,4),(4,5,3,2),(0,4,2),(1,3,5)]);mesh.materials.append(M['Roof slate']);roof=bpy.data.objects.new('Roof',mesh);bpy.context.collection.objects.link(roof)
   for n in range(int(w/.45)):
    xx=x-w/2+n*.45;cube('Roof seam',(xx,y-d/4-.1,3.56),(.025,d/2+.3,.025),M['Dark frame']).rotation_euler.x=math.atan2(1.1,d/2+.25)
   cube('Roof ridge',(x,y,4.1),(w+.6,.14,.12),M['Dark frame'],.03)
  else:
   cube('Flat roof',(x,y,3.03),(w+.35,d+.35,.2),M['White plaster'],.04)
   cube('Green rooftop',(x,y,3.15),(w-.15,d-.1,.07),M['Grass light'])
   for xx in [-w*.25,w*.25]:
    cube('Solar module',(x+xx,y+.35,3.25),(w*.35,d*.35,.05),M['Solar panel'],.01)
    for n in [-.2,0,.2]:cube('Solar cell grid',(x+xx+n,y+.35,3.28),(.012,d*.34,.008),M['Blue light'])
  count=max(2,int(w/1.7))
  for i in range(count):
   xx=x-w/2+.9+i*(w-1.8)/max(count-1,1)
   cube('Window surround',(xx,y-d/2-.05,1.85),(.94,.12,1.14),M['Dark frame'],.025)
   cube('Window glass',(xx,y-d/2-.12,1.85),(.78,.025,.96),M['Glass'])
   cube('Window cross',(xx,y-d/2-.145,1.85),(.045,.025,.98),M['White plaster'])
   cube('Window sill',(xx,y-d/2-.2,1.26),(1.1,.32,.1),M['White plaster'],.02)
   cube('Window awning',(xx,y-d/2-.3,2.55),(1.14,.65,.09),M['Blue accent'],.02).rotation_euler.x=.12
  cube('School door',(x,y-d/2-.19,1.25),(.8,.09,1.8),M['Dark frame'],.025)
  cube('Door glazing',(x,y-d/2-.25,1.4),(.64,.03,1.1),M['Glass'])
  cube('Door handle',(x+.22,y-d/2-.28,1.15),(.04,.03,.3),M['Silver'])
  cube('School sign',(x,y-d/2-.14,2.75),(min(w-1,4.2),.12,.4),M['White plaster'],.03)
  text('School typography',label,(x,y-d/2-.215,2.75),.19,M['Blue accent'])
  join_objects('Building_occluder',new_objects(before),True)
 def story_sign(index,x,y,title):
  cylinder('Checkpoint_%d_pad'%(index+1),(x,y,.23),1.3,.12,M['Path limestone'],40)
  torus('Story circle',(x,y,.31),1.19,.035,M['Blue accent'])
  for dx in [-.62,.62]:cube('Sign post',(x+dx,y+.35,1),(.06,.08,1.55),M['Dark frame'])
  cube('Checkpoint_%d_board'%(index+1),(x,y+.35,1.72),(1.8,.14,.93),M['White plaster'],.07)
  cube('Story blue stripe',(x,y+.266,1.34),(1.65,.02,.08),M['Blue accent'])
  text('Story title',title,(x,y+.268,1.74),.145,M['Dark frame'])
  cylinder('Story number badge',(x-.62,y+.24,2.12),.21,.045,M['Blue accent'],20).rotation_euler.x=math.pi/2
  text('Story number',str(index+1),(x-.62,y+.206,2.12),.21,M['White plaster'])
 # Ground, paths and a campus loop road. Elevations are staggered to avoid z-fighting.
 cube('Island edge',(0,-7,-.4),(51,57,.85),M['Earth edge'],1.7)
 cube('Campus lawn',(0,-7,.015),(50.7,56.7,.18),M['Grass'],1.5)
 for x in [-15,15]:
  cube('Road curb',(x,0,.145),(3.9,31,.13),M['Path limestone'],.3)
  cube('Campus loop road',(x,0,.22),(3.45,30.7,.05),M['Road asphalt'],.3)
  for y in range(-13,14,3):cube('Road centre marking',(x,y,.252),(.055,1.1,.013),M['Road markings'])
 for y in [-14,14]:
  cube('Road curb',(0,y,.146),(33,3.9,.13),M['Path limestone'],.3)
  cube('Campus loop road',(0,y,.223),(32.6,3.45,.05),M['Road asphalt'],.3)
  for x in range(-12,13,3):cube('Road centre marking',(x,y,.255),(1.1,.055,.013),M['Road markings'])
 cube('Central promenade',(0,0,.18),(3,38,.1),M['Path limestone'],.1)
 cube('Cross campus path',(0,.5,.19),(46,2.2,.1),M['Path limestone'],.1)
 cube('Rear campus path',(0,5.1,.2),(26,1.6,.1),M['Path limestone'],.1)
 for y in range(-17,17):
  for x in [-.92,0,.92]:cube('Promenade paving',(x,y+.25,.239),(.86,.92,.018),M['Paving light'],.025)
 for x in [-15,15]:
  for i in range(6):cube('Zebra crossing',(x-1.35+i*.53,.5,.268),(.29,1.8,.018),M['Road markings'])
 for y in [-14,14]:
  for i in range(5):cube('Zebra crossing',(0,y-1.15+i*.55,.269),(2.3,.28,.018),M['Road markings'])
 cylinder('Central plaza',(0,1,.25),4,.14,M['Path limestone'],64)
 torus('Plaza blue detail',(0,1,.34),3.65,.025,M['Blue accent'])
 for i in range(24):
  a=i*math.tau/24;tile=cube('Plaza edge paving',(math.sin(a)*3.8,1+math.cos(a)*3.8,.345),(.4,.28,.025),M['Paving light']);tile.rotation_euler.z=-a
 cylinder('Fountain stone',(0,1,.43),1.05,.28,M['White plaster'],32)
 cylinder('Fountain water',(0,1,.59),.9,.04,M['Water blue'],40)
 cylinder('Fountain plinth',(0,1,.8),.2,.4,M['Path limestone'],12)
 cylinder('Fountain basin',(0,1,1.03),.55,.12,M['White plaster'],24)
 ico('Fountain jet',(0,1,1.26),(.07,.07,.24),M['Water blue'],2)
 building(-6,8.4,8,3.8,'XELOGRAPH / ALUMNI')
 building(5.4,8.4,6.5,3.8,'RUMAH CERITA','modern')
 building(19,12,4.5,3,'KOPI & KENANGAN','modern')
 # Entrance, courtyard flags and a welcome plaque.
 for y in [-18,-9]:
  for x in [-2.1,2.1]:cube('Entrance pillar',(x,y,1.75),(.38,.45,3.3),M['White plaster'],.05)
  cube('Entrance arch',(0,y,3.3),(4.7,.48,.58),M['Blue accent'],.08)
  text('Entrance lettering','XELOGRAPH',(0,y-.25,3.3),.33,M['White plaster'])
 for x in [-3.2,3.2]:
  cylinder('Flagpole',(x,-9,2),.035,3.8,M['Silver'],8)
  cube('Welcome flag',(x+.33,-9,3.2),(.62,.035,.85),M['Blue accent'])
 # Mission-specific props remain separate from the navigation and questionnaire logic.
 titles=['PILIH CERITA','KALENDER REUNI','CREW CAMP','CREATIVE CORNER','PILIH TEMPAT','SUPPORT GARDEN','PESAN UNTUK KITA']
 zones=[(-6,-6),(-9,-1),(-8,4),(7,4),(10,-1),(7,-6),(0,5.3)]
 for i,((x,y),title) in enumerate(zip(zones,titles)):story_sign(i,x,y,title)
 # Calendar garden.
 cylinder('Garden clock post',(-10.7,.2,1.4),.075,2.4,M['Dark frame'],8)
 cylinder('Garden clock dial',(-10.7,.15,2.7),.47,.1,M['White plaster'],32).rotation_euler.x=math.pi/2
 cube('Clock hand',(-10.7,.08,2.84),(.025,.025,.3),M['Blue accent'])
 cube('Clock minute hand',(-10.55,.075,2.7),(.32,.025,.025),M['Dark frame'])
 # Crew pergola with worktable and crates.
 cube('Crew deck',(-9,3.8,.28),(4,4,.2),M['Timber'],.08)
 for x in [-10.6,-7.4]:
  for y in [2.2,5.4]:cube('Pergola pillar',(x,y,1.65),(.13,.13,2.8),M['White plaster'],.02)
 for y in [2.2,2.8,3.4,4,4.6,5.4]:cube('Pergola beam',(-9,y,3.04),(3.7,.13,.16),M['Timber'])
 cube('Crew worktable',(-9,4.7,.95),(2,.7,.12),M['White plaster'],.04)
 for x in [-9.7,-8.3]:cube('Table legs',(x,4.7,.6),(.07,.5,.65),M['Dark frame'])
 for x in [-11.5,-10.8]:cube('Crew supply crate',(x,4.6,.53),(.55,.55,.65),M['Timber'],.025)
 # Stage with banner, speakers, and little lights.
 cube('Reunion stage',(7,5.7,.43),(4.5,2,.6),M['Timber'],.08)
 cube('Stage backdrop',(7,6.5,1.8),(4.5,.13,2.1),M['Blue accent'],.05)
 text('Stage lettering','CERITA KITA',(7,6.41,2.1),.36,M['White plaster'])
 for x in [5.3,8.7]:
  cube('Stage speaker',(x,5.7,1.2),(.45,.4,.88),M['Dark frame'],.04)
  for z in [1,1.35]:cylinder('Speaker cone',(x,5.48,z),.12,.025,M['Roof slate'],16).rotation_euler.x=math.pi/2
 # Court and hoops.
 cube('Basketball court',(-19,0,.23),(7,11,.12),M['Blue accent'],.12)
 cube('Court playing field',(-19,0,.3),(6.45,10.4,.025),M['Blue light'])
 for x in [-22.1,-15.9]:cube('Court sideline',(x,0,.32),(.045,10.3,.012),M['White plaster'])
 for y in [-5.1,0,5.1]:cube('Court baseline',(-19,y,.32),(6.2,.045,.012),M['White plaster'])
 torus('Centre circle',(-19,0,.33),1.2,.025,M['White plaster'])
 for y in [-5.6,5.6]:
  cylinder('Hoop post',(-19,y,1.6),.06,2.8,M['Dark frame'],8)
  cube('Basketball board',(-19,y,2.9),(1.3,.08,.85),M['White plaster'],.03)
  cube('Backboard square',(-19,y-.05,2.85),(.45,.015,.35),M['Blue accent'])
  torus('Basketball rim',(-19,y-.35,2.6),.21,.025,M['Flower coral'])
 ico('Basketball',(-17,2,.52),(.18,.18,.18),M['Flower coral'],2)
 # Picnic, waterside and cafe.
 cube('Picnic pavilion',(19,9.7,.3),(5,2,.35),M['Timber'],.05)
 for x,y in [(18,9.2),(20,9.2),(-19,9),(-19,12),(-6,-16),(6,-16)]:
  cylinder('Cafe table',(x,y,.85),.65,.1,M['Timber'],16)
  cylinder('Cafe table stem',(x,y,.49),.06,.65,M['Dark frame'],8)
  for dx in [-.9,.9]:bench(x+dx,y+.7)
 for x,y,r in [(10,-6,1.85),(18,-12,2.4)]:
  cylinder('Lake bank',(x,y,.24),r+.25,.15,M['Path limestone'],48)
  cylinder('Outer lake' if x==18 else 'Supporter pond',(x,y,.33),r,.07,M['Water blue'],48)
  for dx,dy in [(.7,.6),(-.8,-.6),(.9,-1)]:cylinder('Lily pad',(x+dx,y+dy,.38),.2,.015,M['Leaf green'],10)
  for n in range(12):
   a=n*math.tau/12;ico('Shore stone',(x+math.cos(a)*(r+.15),y+math.sin(a)*(r+.15),.4),(.17,.23,.13),M['Stone'],1)
 cube('Lake deck',(14.5,-12,.35),(2,3.7,.25),M['Timber'],.05)
 for y in [-13.6,-13,-12.4,-11.8,-11.2,-10.6]:cube('Deck plank trim',(14.5,y,.49),(1.95,.035,.01),M['Path limestone'])
 # Original little sailboat in the lake, outside the walking surface.
 ico('Toy boat hull',(18,-12.3,.46),(.45,.18,.12),M['Timber'],1)
 cylinder('Boat mast',(18,-12.3,.85),.018,.8,M['White plaster'],8)
 mesh=bpy.data.meshes.new('Sail mesh');mesh.from_pydata([(18,-12.3,1.22),(18,-12.3,.6),(18.42,-12.3,.62)],[],[(0,1,2)]);mesh.materials.append(M['White plaster']);sail=bpy.data.objects.new('Toy sail',mesh);bpy.context.collection.objects.link(sail)
 # Landscape: a mix of broadleaf trees and conifers, leaving the central routes open.
 locations=[(-12,-8),(-11,7),(-12,1),(-4,-8),(4,-8),(12,8),(12,-9),(-2,11),(2,11),(-12,-2),(12,5),(-5,4),(5,-4),(-23,-17),(-21,-16),(-18,-18),(-12,-18),(-8,-19),(8,-19),(12,-18),(22,-17),(23,-8),(23,-3),(23,3),(23,7),(-23,-8),(-23,7),(-22,12),(-22,17),(-17,18),(-12,18),(-6,18),(0,18),(6,18),(12,18),(23,18),(-7,-12),(7,-12),(-19,-10),(-17,-11),(12,13),(20,17),(17,18),(-10,17),(8,17),(-23,-1),(23,-19)]
 for i,(x,y) in enumerate(locations):tree(x,y,random.uniform(.8,1.15),i%5==0)
 for x,y in [(-3,-3),(3,-3),(-4,3),(4,3),(-11,-4),(11,3),(-11,-12),(10,-12)]:bench(x,y)
 for x,y in [(-3.9,-5),(3.9,-5),(-12,.5),(12,.5),(-12,14),(12,14),(-12,-14),(12,-14)]:lamp(x,y)
 for x,y in [(-10,-14),(10,-14),(-12,15),(10,15)]:
  cylinder('Flower bed',(x,y,.27),1.15,.18,M['Path limestone'],20)
  for n in range(8):
   a=n*2.4;xx=x+math.cos(a)*.7;yy=y+math.sin(a)*.7
   ico('Flower shrub',(xx,yy,.54),(.3,.3,.3),M['Leaf green'],1)
   ico('Flower head',(xx,yy,.83),(.13,.13,.11),M[['Flower coral','Flower blue','Flower cream'][n%3]],1)
 for x,y in [(-2.5,6.1),(2.5,6.1),(-8.8,6.1),(8.2,6.1),(17,10),(21,10),(-3,-9),(3,-9)]:planter(x,y)
 for _ in range(45):
  x=random.choice([-1,1])*random.uniform(17,23);y=random.uniform(-19,19)
  if (x+19)**2+y*y<45:continue
  for dx in [-.06,.06]:cone('Grass tuft',(x+dx,y,.28),.045,.3,M['Grass light'])
 # Reunion Commons: a generous 29 x 13 m square with space for 50+ persistent alumni.
 cube('Commons avenue',(0,-26,.19),(3,17,.1),M['Path limestone'],.08)
 cube('Reunion Commons',(0,-26,.22),(29,13,.18),M['Path limestone'],.7)
 cube('Commons paving',(0,-26,.32),(27.8,11.9,.035),M['Paving light'],.6)
 for x in range(-13,14,2):cube('Commons tile seam',(x,-26,.342),(.018,11.5,.007),M['Path limestone'])
 for y in [-31,-29,-27,-25,-23,-21]:cube('Commons tile seam',(0,y,.343),(27.5,.018,.007),M['Path limestone'])
 for x,label in [(-9,'CREW CAMP'),(0,'ALUMNI COMMONS'),(9,'SUPPORTER GARDEN')]:
  cube('Commons sign base',(x,-19.6,.35),(5,.7,.14),M['White plaster'],.05)
  text('Commons area lettering',label,(x,-19.7,.44),.23,M['Blue accent'],(0,0,0))
 for x in [-15.5,15.5]:
  for y in [-22,-26,-30]:bench(x,y,math.pi/2 if x<0 else -math.pi/2)
 for x,y in [(-16.5,-21),(-17,-26),(-17,-31),(17,-21),(17,-26),(17,-31),(-22,-23),(-22,-30),(22,-23),(22,-30),(-10,-34),(10,-34)]:tree(x,y,random.uniform(.8,1.05),abs(x)>20)
 for x,y in [(-13,-20),(-13,-32),(13,-20),(13,-32)]:lamp(x,y)
 before=set(bpy.context.scene.objects)
 cube('Commons reunion stage',(0,-33.5,.35),(10,2,.45),M['Timber'],.09)
 cube('Commons stage backdrop',(0,-34.2,1.9),(10,.15,2.8),M['White plaster'],.08)
 cube('Commons stage stripe',(0,-34.3,1.1),(9.8,.03,.28),M['Blue accent'])
 text('Reunion stage lettering','SAMPAI BERTEMU KEMBALI',(0,-34.31,2.4),.37,M['Blue accent'])
 text('Reunion stage subtitle','XELOGRAPH / REUNION 2027',(0,-34.32,1.75),.24,M['Dark frame'])
 for x in [-4.3,4.3]:cube('Commons speaker',(x,-33,1.05),(.55,.55,1),M['Dark frame'],.05)
 join_objects('Reunion_stage',new_objects(before),True)
 for x in [-12,12]:
  cylinder('Bunting pole',(x,-32.2,1.8),.04,3.1,M['Dark frame'],8)
 for i in range(20):
  x=-11.5+i*1.2;y=-32.2
  mesh=bpy.data.meshes.new('Bunting triangle');mesh.from_pydata([(x,y,3.3),(x+.6,y,3.3),(x+.3,y,2.86)],[],[(0,1,2)]);mesh.materials.append(M['Blue accent'] if i%2 else M['Flower coral']);o=bpy.data.objects.new('Reunion bunting',mesh);bpy.context.collection.objects.link(o)
 # Batch non-occluding scenery by material; keep individual trees/buildings for camera fading.
 protected={'Central plaza','Basketball court','Picnic pavilion','Outer lake','Reunion Commons'}
 groups={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH' and not o.get('camera_occluder',False) and o.name not in protected and not o.name.startswith('Checkpoint_'):
   groups.setdefault(o.data.materials[0].name,[]).append(o)
 for name,objects in groups.items():
  if len(objects)>1:join_objects('Scenery_'+name.replace(' ','_'),objects)
 return M
