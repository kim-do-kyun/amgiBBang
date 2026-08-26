import {readFile} from 'node:fs/promises';
// ---- app's actual xlsx code ----
async function inflateRaw(bytes){
  const ds=new DecompressionStream("deflate-raw");
  const stream=new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await stream.arrayBuffer());
}
function colNum(ref){ let n=0; for(const ch of ref){ n=n*26+(ch.charCodeAt(0)-64);} return n-1; }
function unxml(s){ return String(s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&amp;/g,"&"); }
async function readXlsx(buf){
  const dv=new DataView(buf); const bytes=new Uint8Array(buf);
  let eocd=-1;
  for(let i=bytes.length-22;i>=0;i--){ if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;} }
  if(eocd<0) throw new Error("not a zip");
  const cdCount=dv.getUint16(eocd+10,true);
  let off=dv.getUint32(eocd+16,true);
  const files={};
  for(let n=0;n<cdCount;n++){
    if(dv.getUint32(off,true)!==0x02014b50) break;
    const method=dv.getUint16(off+10,true);
    const compSize=dv.getUint32(off+20,true);
    const nameLen=dv.getUint16(off+28,true);
    const extraLen=dv.getUint16(off+30,true);
    const commLen=dv.getUint16(off+32,true);
    const localOff=dv.getUint32(off+42,true);
    const name=new TextDecoder().decode(bytes.subarray(off+46,off+46+nameLen));
    files[name]={method,compSize,localOff};
    off+=46+nameLen+extraLen+commLen;
  }
  async function extract(name){
    const f=files[name]; if(!f)return null;
    const lh=f.localOff;
    if(dv.getUint32(lh,true)!==0x04034b50) return null;
    const nLen=dv.getUint16(lh+26,true); const eLen=dv.getUint16(lh+28,true);
    const dataStart=lh+30+nLen+eLen;
    const raw=bytes.subarray(dataStart,dataStart+f.compSize);
    const out = f.method===0? raw : await inflateRaw(raw);
    return new TextDecoder().decode(out);
  }
  const shared=[]; const ssXml=await extract("xl/sharedStrings.xml");
  if(ssXml){ const re=/<si>([\s\S]*?)<\/si>/g; let m;
    while((m=re.exec(ssXml))){ const ts=[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]); shared.push(unxml(ts.join(""))); } }
  const sheetXml=await extract("xl/worksheets/sheet1.xml") || await extract("xl/worksheets/sheet01.xml");
  if(!sheetXml) throw new Error("no sheet");
  const rows=[]; const rowRe=/<row[^>]*>([\s\S]*?)<\/row>/g; let rm;
  while((rm=rowRe.exec(sheetXml))){
    const cells=[]; const cRe=/<c([^>]*)>([\s\S]*?)<\/c>|<c([^>]*)\/>/g; let cm;
    while((cm=cRe.exec(rm[1]))){
      const attr=(cm[1]||cm[3]||""); const inner=cm[2]||"";
      const ref=(attr.match(/r="([A-Z]+)\d+"/)||[])[1];
      const type=(attr.match(/t="([^"]+)"/)||[])[1];
      let val=""; const vM=inner.match(/<v[^>]*>([\s\S]*?)<\/v>/); const isM=inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
      if(type==="s" && vM){ val=shared[+vM[1]]||""; }
      else if(type==="inlineStr" && isM){ val=unxml(isM[1]); }
      else if(vM){ val=unxml(vM[1]); }
      const col=ref?colNum(ref):cells.length; cells[col]=val;
    }
    for(let i=0;i<cells.length;i++) if(cells[i]==null)cells[i]="";
    rows.push(cells);
  }
  return rows.filter(r=>r.some(c=>String(c).trim()!==""));
}
const toAB = b => b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
const v = await readXlsx(toAB(await readFile(new URL("../../samples/vocab_sample.xlsx",import.meta.url))));
const q = await readXlsx(toAB(await readFile(new URL("../../samples/quiz_sample.xlsx",import.meta.url))));
console.log("VOCAB rows:",JSON.stringify(v));
console.log("QUIZ  rows:",JSON.stringify(q));
console.log("DecompressionStream:", typeof DecompressionStream);
