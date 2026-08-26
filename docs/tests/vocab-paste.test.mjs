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
console.log(`\n${pass} passed, ${fail} failed`);
