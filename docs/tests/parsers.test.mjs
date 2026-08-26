// quick verification of the pure parser logic used in the app
function parseCSV(text){
  const rows=[]; let row=[],cur="",q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
    else { if(ch==='"')q=true;
      else if(ch===","){row.push(cur);cur="";}
      else if(ch==="\t"){row.push(cur);cur="";}
      else if(ch==="\r"){}
      else if(ch==="\n"){row.push(cur);rows.push(row);row=[];cur="";}
      else cur+=ch; } }
  if(cur.length||row.length){row.push(cur);rows.push(row);}
  return rows.filter(r=>r.some(c=>String(c).trim()!==""));
}
function rowsToVocab(rows){
  let start=0;
  const h=(rows[0]||[]).map(c=>String(c).trim().toLowerCase());
  if(h.length && /단어|word|english|영어|표제/.test(h[0]) && /뜻|meaning|kor|한글|의미/.test(h[1]||"")) start=1;
  const items=[];
  for(let i=start;i<rows.length;i++){
    const r=rows[i]; if(!r)continue;
    const w=String(r[0]||"").trim(); const m=String(r[1]!=null?r[1]:"").trim();
    if(w&&m) items.push({q:w,a:m});
  }
  return items;
}
function resolveAnswer(raw,choices){
  raw=String(raw).trim();
  let m=raw.match(/^([A-Ea-e])[.)]?$/); if(m){ const i="abcde".indexOf(m[1].toLowerCase()); if(i<choices.length)return i; }
  m=raw.match(/^([1-9])[.)]?$/); if(m){ const i=+m[1]-1; if(i>=0&&i<choices.length)return i; }
  const norm=s=>String(s).replace(/[.\s]+$/,"").trim().toLowerCase();
  const idx=choices.findIndex(c=>norm(c)===norm(raw)); if(idx>=0)return idx;
  const idx2=choices.findIndex(c=>norm(c).includes(norm(raw))&&norm(raw).length>1); if(idx2>=0)return idx2;
  return -1;
}
function rowsToQuiz(rows){
  let start=0;
  const h=(rows[0]||[]).map(c=>String(c).trim().toLowerCase());
  const hasHeader = h.some(c=>/정답|answer|ans|해답/.test(c)) || /문제|question|지문/.test(h[0]||"");
  if(hasHeader) start=1;
  const items=[];
  for(let i=start;i<rows.length;i++){
    const r=(rows[i]||[]).map(c=>String(c==null?"":c).trim());
    if(!r.length) continue;
    const q=r[0]; if(!q) continue;
    const rest=r.slice(1).filter(c=>c!=="");
    if(rest.length<2) continue;
    const ansRaw=rest[rest.length-1];
    const choices=rest.slice(0,rest.length-1);
    let ans=resolveAnswer(ansRaw,choices);
    if(ans<0) continue;
    items.push({q,choices,answer:ans});
  }
  return items;
}
function textToQuiz(text){
  const lines=text.split(/\r?\n/);
  const items=[]; let cur=null; let pendingAns=null;
  const flush=()=>{ if(cur&&cur.choices.length>=2){
      if(cur.answer<0 && pendingAns) cur.answer=resolveAnswer(pendingAns,cur.choices);
      if(cur.answer<0) cur.answer=0;
      items.push(cur);
    } cur=null; pendingAns=null; };
  for(let raw of lines){
    const line=raw.replace(/ /g," ").trim();
    if(!line){ continue; }
    let m=line.match(/^정답\s*[:：]\s*(.+)$/i)||line.match(/^answer\s*[:：]\s*(.+)$/i);
    if(m){ pendingAns=m[1].trim(); continue; }
    m=line.match(/^(\*?)\s*\(?([A-Ea-e])\)?[.)]\s+(.*\S)\s*$/);
    if(m && cur){
      const star=m[1]==="*"; const txt=m[3].replace(/\s*\*\s*$/,"").trim();
      const starred = star || /\*$/.test(m[3].trim());
      cur.choices.push(txt);
      if(starred) cur.answer=cur.choices.length-1;
      continue;
    }
    m=line.match(/^\(?(\d{1,3})\)?[.)]\s+(.*\S)\s*$/);
    if(m){ flush(); cur={q:m[2].trim(),choices:[],answer:-1}; continue; }
    if(cur && cur.choices.length===0){ cur.q+=" "+line; }
  }
  flush();
  return items;
}

let pass=0,fail=0;
const eq=(got,want,label)=>{ const g=JSON.stringify(got),w=JSON.stringify(want);
  if(g===w){pass++;console.log("✓",label);} else {fail++;console.log("✗",label,"\n   got :",g,"\n   want:",w);} };

// 1. vocab from a real .xlsx grid (cells already separated -> commas safe)
eq(rowsToVocab([["scheme","계획"],["janitor","문지기, 관리인"]]),
   [{q:"scheme",a:"계획"},{q:"janitor",a:"문지기, 관리인"}], "vocab from xlsx grid rows");
// 2. vocab CSV with quoted comma in meaning + header
eq(rowsToVocab(parseCSV('단어,뜻\nrefund,"환불, 상환"\nmerger,합병')),
   [{q:"refund",a:"환불, 상환"},{q:"merger",a:"합병"}], "vocab csv w/ header + quoted comma");
// 3. quiz structured CSV, answer as letter
eq(rowsToQuiz(parseCSV("문제,A,B,C,D,정답\nThe EEC normally operates in the:,N1 mode,N2 mode,EPR mode,EGT mode,C")),
   [{q:"The EEC normally operates in the:",choices:["N1 mode","N2 mode","EPR mode","EGT mode"],answer:2}], "quiz csv letter answer");
// 4. quiz structured, answer as full text
eq(rowsToQuiz(parseCSV("The high pressure turbine stages:,1,2,3,4,2")),
   [{q:"The high pressure turbine stages:",choices:["1","2","3","4"],answer:1}], "quiz csv numeric answer col");
// 5. numbered text w/ star
{ const r=textToQuiz("1. The EEC normally operates in the:\nA. N1 mode.\nB. N2 mode.\n*C. EPR mode.\nD. EGT mode.");
  eq([r.length,r[0].answer,r[0].choices.length],[1,2,4],"numbered text + star marks correct"); }
// 6. numbered text w/ '정답: B'
{ const r=textToQuiz("2. The EEC data entry plug:\nA. Is matched to the EEC.\nB. Is matched to the engine.\n정답: B");
  eq([r.length,r[0].answer],[1,1],"numbered text + '정답: B'"); }
// 7. two-question block, wrapped stem
{ const r=textToQuiz("1. A very long question stem that\ncontinues on next line:\nA. one\n*B. two\n\n2. Second q:\n*A. yes\nB. no");
  eq([r.length,r[0].q.includes("continues"),r[0].answer,r[1].answer],[2,true,1,0],"multi-q + wrapped stem"); }
// 8. answer text-match fallback
eq(resolveAnswer("EPR mode.",["N1 mode.","N2 mode.","EPR mode.","EGT mode."]),2,"resolveAnswer full text");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
