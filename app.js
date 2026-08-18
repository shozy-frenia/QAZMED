// ============================================================
// 1) PK/PD model
// ============================================================
const P = {ka:1.2, Vc:45, kcp:0.8, kpc:0.6, CLpop:6.0, Dose:10,
           Emax:0.8, EC50:0.02, gamma:1.0,
           b0:-2.5, b1:0.2, b2:0.6, b3:-0.01, w1:0.8, w2:0.2};
const state = {cl:6.0, pheno:'NM', age:40, il6:0, pgx:true};

function rhs(y, cl){
  const [Ag,Ac,Ap]=y;
  return [ -P.ka*Ag,
           P.ka*Ag - (cl/P.Vc)*Ac - P.kcp*Ac + P.kpc*Ap,
           P.kcp*Ac - P.kpc*Ap ];
}
function simulate(cl, tEnd=168, dt=0.2){
  const n=Math.round(tEnd/dt)+1; const t=[], C=[];
  let y=[P.Dose,0,0];
  for(let i=0;i<n;i++){
    const tt=i*dt; t.push(tt); C.push(y[1]/P.Vc);
    const k1=rhs(y,cl);
    const k2=rhs(y.map((v,j)=>v+0.5*dt*k1[j]),cl);
    const k3=rhs(y.map((v,j)=>v+0.5*dt*k2[j]),cl);
    const k4=rhs(y.map((v,j)=>v+dt*k3[j]),cl);
    y=y.map((v,j)=>v+(dt/6)*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
  }
  return {t,C};
}
function auc(cl){ return P.Dose*56/cl; }
function phenoConv(il6){ return Math.min(0.15, 0.033*il6); }

function doseOpt(cl, il6){
  const f = phenoConv(il6);
  let d = P.Dose*(P.w1*cl/P.CLpop + P.w2*1)*1*(1-f);
  return d;
}
function remission(cl, age, pgx){
  const A = auc(cl)/1000;
  const logit = P.b0 + P.b1*A + P.b2*(pgx?1:0) + P.b3*age;
  return 1/(1+Math.exp(-logit));
}

// ============================================================
// 2) Canvas plot
// ============================================================
const cv=document.getElementById('pkchart'), cx=cv.getContext('2d');
function resizeCanvas(){ const r=cv.getBoundingClientRect(); cv.width=r.width*devicePixelRatio;
  cv.height=230*devicePixelRatio; cx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); }
function draw(){
  const W=cv.width/devicePixelRatio, H=230, padL=42, padB=26, padT=10, padR=10;
  cx.clearRect(0,0,W,H);
  const sim=simulate(state.cl), ref=simulate(P.CLpop);
  const maxC=Math.max(...sim.C, ...ref.C, 0.1);
  const x=t=>padL+(t/168)*(W-padL-padR);
  const y=c=>padT+(1-c/maxC)*(H-padT-padB);
  // grid
  cx.strokeStyle='#151515'; cx.lineWidth=1; cx.fillStyle='#89898d'; cx.font='10px Inter';
  for(let g=0;g<=4;g++){ const gy=padT+g*(H-padT-padB)/4;
    cx.beginPath();cx.moveTo(padL,gy);cx.lineTo(W-padR,gy);cx.stroke();
    cx.fillText((maxC*(1-g/4)).toFixed(2), 4, gy+3); }
  for(let h=0;h<=168;h+=24){ cx.fillText(h, x(h)-6, H-8); }
  // reference NM (gray)
  cx.strokeStyle='#4a4a4d'; cx.lineWidth=1.4; cx.beginPath();
  ref.t.forEach((t,i)=>{ i?cx.lineTo(x(t),y(ref.C[i])):cx.moveTo(x(t),y(ref.C[i])); }); cx.stroke();
  // patient (white, PM emphasized)
  cx.strokeStyle= state.pheno==='PM' ? '#ffffff' : '#dddddd';
  cx.lineWidth= state.pheno==='PM'?2.6:2; cx.beginPath();
  sim.t.forEach((t,i)=>{ i?cx.lineTo(x(t),y(sim.C[i])):cx.moveTo(x(t),y(sim.C[i])); }); cx.stroke();
  cx.fillStyle='#b3b3b5'; cx.font='11px Inter';
  cx.fillText('C(t) mg/L', padL, 12); cx.fillText('time (h)  ·  patient (white) vs NM reference (gray)', padL+70, 12);
}

// ============================================================
// 3) UI updates
// ============================================================
function update(){
  document.getElementById('rDose').textContent = doseOpt(state.cl, state.il6).toFixed(1);
  document.getElementById('rAuc').textContent  = Math.round(auc(state.cl));
  document.getElementById('rRem').textContent  = (remission(state.cl, state.age, state.pgx)*100).toFixed(1)+'%';
  const d = doseOpt(state.cl, state.il6);
  const warn=document.getElementById('warn');
  let msg='', alert=false;
  if(d<2.5){ msg='▲ D_opt below the 2.5 mg/day investigational floor — flag for clinician review, do not auto-switch.'; alert=true; }
  else if(d>20){ msg='▲ D_opt above the 20 mg/day investigational ceiling — flag for clinician review, do not auto-switch.'; alert=true; }
  else if(state.pheno==='PM'){ msg='Poor metabolizer — CPIC suggests ~50% lower maintenance dose, slower titration, or a non-CYP2C19 agent.'; }
  else if(state.pheno==='UM'){ msg='Ultrarapid metabolizer — risk of subtherapeutic exposure; monitor response, consider alternative if failure.'; }
  else if(state.pheno==='IM'){ msg='Intermediate metabolizer — individually tailored dose; monitor exposure.'; }
  else { msg='Reference normal metabolizer — standard 10 mg/day.'; }
  if(state.il6>=0.8 && !alert){ msg += ' Elevated IL-6: phenoconversion reduces effective clearance — consider dose reduction.'; }
  warn.textContent=msg; warn.classList.toggle('alert', alert);
  draw();
}

// Controls
document.querySelectorAll('#segPheno button').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('#segPheno button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on'); state.cl=parseFloat(b.dataset.cl); state.pheno=b.dataset.k; update();
  });
});
const age=document.getElementById('age'), il6=document.getElementById('il6');
age.addEventListener('input',()=>{ state.age=+age.value; document.getElementById('ageV').textContent=age.value; update(); });
il6.addEventListener('input',()=>{ state.il6=+il6.value; document.getElementById('ilV').textContent=(+il6.value).toFixed(1); update(); });
const pgxTog=document.getElementById('pgxTog');
function togglePgx(){ state.pgx=!state.pgx; pgxTog.classList.toggle('on',state.pgx);
  pgxTog.setAttribute('aria-checked',state.pgx); update(); }
pgxTog.addEventListener('click',togglePgx);
pgxTog.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter'){e.preventDefault();togglePgx();} });
window.addEventListener('resize',()=>{ resizeCanvas(); draw(); });
resizeCanvas(); update();

// ============================================================
// 4) AI Assistant – теперь через ваш прокси /api/chat
// ============================================================
const API_URL = '/api/chat';  // используем ваш эндпоинт вместо Stack AI

// Системный промпт теперь на сервере, но оставляем копию для fallback KB
const SYS = `You are an educational assistant embedded in a university hackathon project on
depression and escitalopram pharmacogenomics (Team Spliceosomes, QazMedicine).
SCOPE: only psychology, mental health, depression, SSRIs, and pharmacogenomics concepts, explained at an educational level.
RULES:
- You are NOT a doctor. Never diagnose, never recommend a specific dose or drug for an individual, never interpret a person's own genotype or symptoms as clinical advice.
- Keep answers concise (2-4 short paragraphs max), clear, and scientifically accurate. Use plain language.
- If asked anything outside psychology / mental health / pharmacogenomics, briefly decline and steer back.
- If a user expresses distress, hopelessness, or thoughts of self-harm: respond with warmth, encourage them to reach out to a trusted person and to local emergency services or a mental-health crisis line right away, and do not attempt to counsel or assess risk yourself.
- You may reference the project's model (CYP2C19 metabolizer types PM/IM/NM/UM, the +5% remission benefit of PGx testing seen in GUIDED) as educational context.`;

// Встроенная база знаний (fallback, если API недоступен)
const KB = {
 'what is major depressive disorder':"**Major Depressive Disorder (MDD)** is a common, disabling condition marked by persistent low mood and loss of interest or pleasure for at least two weeks, often with changes in sleep, appetite, energy, concentration and self-worth. It affects more than a billion people worldwide and is a leading cause of years lived with disability. It's treatable — but response to any single treatment varies a lot between people, which is exactly what this project studies.",
 'how does escitalopram work':"**Escitalopram** is an SSRI — a selective serotonin reuptake inhibitor. It blocks the serotonin transporter (SERT, encoded by the SLC6A4 gene), so serotonin stays longer in the synapse. Over weeks this is thought to drive adaptive changes that lift mood. It's the active S-enantiomer of citalopram, valued for high SERT selectivity and predictable pharmacokinetics — but how much drug reaches the brain still depends on how fast the liver clears it.",
 'what is a cyp2c19 poor metabolizer':"A **CYP2C19 poor metabolizer (PM)** carries two loss-of-function alleles (e.g. *2/*2), so the liver enzyme that clears escitalopram works slowly. The drug is cleared ~2.5× slower, plasma levels run higher, and the risk of dose-related side effects rises. CPIC suggests a lower starting dose, slower titration, roughly 50% lower maintenance dose, or an antidepressant not mainly metabolized by CYP2C19. The opposite type — ultrarapid (UM) — clears the drug fast and may get too little.",
 'why do people respond differently':"Two identical doses can give very different results because response is shaped by several layers at once: **pharmacokinetics** (how fast CYP2C19 clears the drug), **pharmacodynamics** (SERT expression via SLC6A4), plus **epigenetics** (promoter methylation), **neuroinflammation** (IL-6, TNF-α lowering sensitivity) and **phenoconversion** (co-medications shifting your effective metabolizer type). Genetics and environment interact — which is why a one-size dose fails most patients and why pharmacogenetic testing helps."
};
function kbLookup(text){
  const t=text.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
  for(const k in KB){ if(t.includes(k)||k.includes(t)) return KB[k]; }
  return null;
}

// Элементы чата
const log=document.getElementById('log'), qEl=document.getElementById('q'), sendBtn=document.getElementById('send');
let history=[];

function addMsg(text, who){
  const d=document.createElement('div'); d.className='msg '+who;
  d.innerHTML = text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>');
  log.appendChild(d); log.scrollTop=log.scrollHeight; return d;
}
function typing(){ const d=document.createElement('div'); d.className='msg a';
  d.innerHTML='<span class="typing"><i></i><i></i><i></i></span>'; log.appendChild(d);
  log.scrollTop=log.scrollHeight; return d; }

async function ask(text){
  addMsg(text,'u'); 
  history.push({role:'user', content:text});
  const t=typing(); 
  sendBtn.disabled=true;
  
  try{
    // Отправляем запрос к вашему прокси
    const res=await fetch(API_URL, {
      method:'POST',
      headers: {
        'Content-Type':'application/json',
      },
      body: JSON.stringify({
        messages: history  // сервер добавит system промпт сам
      })
    });
    
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const txt = data.reply || '';  // сервер возвращает { reply: "..." }
    t.remove();
    
    if(txt){
      addMsg(txt,'a');
      history.push({role:'assistant', content:txt});
    } else {
      throw new Error('empty reply');
    }
  } catch(err) {
    t.remove();
    // Fallback на встроенную базу знаний
    const fb = kbLookup(text);
    if(fb){
      addMsg(fb,'a');
    } else {
      addMsg("I can't reach the AI service right now, so I'm limited to the built‑in topics. Try one of the suggested questions, or check your API endpoint/token.\n\n_Educational only — not medical advice._",'a');
    }
  } finally { 
    sendBtn.disabled = false; 
  }
}

function submit(){ const v=qEl.value.trim(); if(!v) return; qEl.value=''; ask(v); }
sendBtn.addEventListener('click',submit);
qEl.addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
document.querySelectorAll('#chips .chip').forEach(c=>c.addEventListener('click',()=>ask(c.textContent)));

// ============================================================
// 5) Reduced motion
// ============================================================
if(matchMedia('(prefers-reduced-motion: reduce)').matches){
  document.querySelectorAll('animateMotion, animate').forEach(a=>a.remove());
}
