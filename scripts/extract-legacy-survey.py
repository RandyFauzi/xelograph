"""Read-only XLSX extraction to a private JSON payload. Uses Python standard library only."""
import sys, zipfile, xml.etree.ElementTree as ET, json, hashlib, os, argparse
parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('output');args=parser.parse_args()
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with open(args.source,'rb') as stream: fingerprint=hashlib.sha256(stream.read()).hexdigest()
with zipfile.ZipFile(args.source) as archive:
 strings=[]
 if 'xl/sharedStrings.xml' in archive.namelist():
  strings=[''.join(t.text or '' for t in item.findall('.//m:t',ns)) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si',ns)]
 workbook=ET.fromstring(archive.read('xl/workbook.xml'))
 names=[sheet.get('name') for sheet in workbook.find('m:sheets',ns)]
 sheets=[]
 for index,name in enumerate(names,1):
  path='xl/worksheets/sheet%d.xml'%index
  if path not in archive.namelist():continue
  rows=[]
  for row in ET.fromstring(archive.read(path)).findall('.//m:sheetData/m:row',ns):
   cells={}
   for cell in row.findall('m:c',ns):
    value=cell.find('m:v',ns);value=value.text or '' if value is not None else ''
    if cell.get('t')=='s':value=strings[int(value)]
    elif cell.get('t')=='inlineStr':value=''.join(t.text or '' for t in cell.findall('.//m:t',ns))
    cells[''.join(c for c in cell.get('r') if c.isalpha())]=value
   rows.append((int(row.get('r')),cells))
  if not rows:continue
  headers=rows[0][1]
  records=[{'rowNumber':number,'cells':{label:cells.get(column,'') for column,label in headers.items()}} for number,cells in rows[1:] if any(v.strip() for v in cells.values())]
  sheets.append({'name':name,'rows':records})
payload={'version':1,'sourceName':os.path.basename(args.source),'fingerprint':fingerprint,'sheets':sheets}
parent=os.path.dirname(os.path.abspath(args.output));os.makedirs(parent,exist_ok=True)
with open(args.output,'w',encoding='utf-8') as stream:json.dump(payload,stream,ensure_ascii=False)
print(json.dumps({'sheets':len(sheets),'rows':sum(len(s['rows']) for s in sheets),'output':args.output}))
