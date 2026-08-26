// re-test the fixed vocab paste + verify xlsx reader against a real xlsx
function parseVocabPaste(text){
  const items=[];
  text.split(/\r?\n/).forEach((line,idx)=>{
    line=line.replace(/\r/g,"").trim();
    if(!line) return;
    let word,mean;
    if(line.includes("\t")){ const i=line.indexOf("\t"); word=line.slice(0,i).trim(); mean=line.slice(i+1).replace(/\t/g,", ").trim(); }
    else { const i=line.indexOf(","); if(i<0) return; word=line.slice(0,i).trim(); mean=line.slice(i+1).trim(); }
    if(idx===0 && /^(단어|word|english|영어|표제어?)$/i.test(word) && /(뜻|meaning|의미|한글|kor)/i.test(mean)) return;
    if(word&&mean) items.push({q:word,a:mean});
  });
  return items;
}
let pass=0,fail=0;const eq=(g,w,l)=>{const a=JSON.stringify(g),b=JSON.stringify(w);if(a===b){pass++;console.log("✓",l);}else{fail++;console.log("✗",l,"\n got:",a,"\n want:",b);}};
eq(parseVocabPaste("scheme\t계획\njanitor\t문지기, 관리인"),[{q:"scheme",a:"계획"},{q:"janitor",a:"문지기, 관리인"}],"tab paste keeps comma in meaning");
eq(parseVocabPaste("단어\t뜻\nrefund\t환불, 상환"),[{q:"refund",a:"환불, 상환"}],"tab paste skips header");
eq(parseVocabPaste("scheme,계획\njanitor,문지기, 관리인"),[{q:"scheme",a:"계획"},{q:"janitor",a:"문지기, 관리인"}],"comma paste: first comma only");

// ---- vocab FILE path: parseCSV + rowsToVocab (quoted CSV, empty trailing cols) ----
function parseCSV(text){const rows=[];let row=[],cur="",q=false;for(let i=0;i<text.length;i++){const ch=text[i];if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=ch;}else{if(ch==='"')q=true;else if(ch===","){row.push(cur);cur="";}else if(ch==="\t"){row.push(cur);cur="";}else if(ch==="\r"){}else if(ch==="\n"){row.push(cur);rows.push(row);row=[];cur="";}else cur+=ch;}}if(cur.length||row.length){row.push(cur);rows.push(row);}return rows.filter(r=>r.some(c=>String(c).trim()!==""));}
function rowsToVocab(rows){if(!rows.length)return[];const first=(rows[0]||[]).map(c=>String(c==null?"":c).trim());const n0=first.filter(c=>c!=="");const kw=/단어|word|english|영어|표제|term/i.test(first[0]||"")&&/뜻|meaning|kor|한글|의미|definition|def/i.test(first[1]||"");const code=n0.length>=2&&n0.every(c=>/^[A-Za-z]{1,3}$/.test(c));const start=(kw||code)?1:0;const items=[];for(let i=start;i<rows.length;i++){const r=(rows[i]||[]).map(c=>String(c==null?"":c).trim());const w=r[0];if(!w)continue;const m=r.slice(1).filter(c=>c!=="").join(", ").replace(/\s*,\s*$/,"").trim();if(w&&m)items.push({q:w,a:m});}return items;}
const V=t=>rowsToVocab(parseCSV(t));
eq(V(`"T","D","P","E"\n"waive","면제하다","",""\n"notice","고지, 알림 / 인지하다","",""`),
   [{q:"waive",a:"면제하다"},{q:"notice",a:"고지, 알림 / 인지하다"}],
   "quoted 4-col CSV: strips quotes+empty cols, skips T/D/P/E header");
eq(V(`"exceptional","우수한, 뛰어난","",""`),[{q:"exceptional",a:"우수한, 뛰어난"}],"quoted meaning keeps inner comma");
eq(V("janitor,문지기, 관리리다"),[{q:"janitor",a:"문지기, 관리리다"}],"unquoted split meaning rejoined");
eq(V(`"announce","~을 알리게 되어 기쁩니다,","",""`),[{q:"announce",a:"~을 알리게 되어 기쁩니다"}],"trailing comma in meaning trimmed");
eq(V("단어,뜻\nrefund,환불"),[{q:"refund",a:"환불"}],"keyword header skipped");

console.log(`\n${pass} passed, ${fail} failed`);
