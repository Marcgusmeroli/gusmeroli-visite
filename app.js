// ===== PASSWORD =====
// Per cambiare la password: genera il nuovo hash SHA-256 (es. via console del browser
// con crypto.subtle) e sostituisci PASSWORD_HASH qui sotto.
const PASSWORD_HASH = "3fe3f3424c3647c23c88c82e815f3628748bf0a4871651a46ee0b2b0fc77420e";
const UNLOCK_KEY = "gv_unlocked_v1";

async function sha256(text){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function tryUnlock(){
  const val = document.getElementById("lockInput").value;
  const hash = await sha256(val);
  if (hash === PASSWORD_HASH){
    localStorage.setItem(UNLOCK_KEY, "1");
    document.getElementById("lock").classList.add("hidden");
    document.getElementById("app").classList.add("visible");
  } else {
    document.getElementById("lockErr").textContent = "Password errata";
    document.getElementById("lockInput").value = "";
  }
}

if (localStorage.getItem(UNLOCK_KEY) === "1"){
  document.getElementById("lock").classList.add("hidden");
  document.getElementById("app").classList.add("visible");
}
document.getElementById("lockBtn").addEventListener("click", tryUnlock);
document.getElementById("lockInput").addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });


// ===== FORMATTAZIONE =====
// Raggruppa a mano le migliaia con il punto (3.000, 400.000) — indipendente da locale/browser.
function groupInt(n){
  const neg = n < 0 ? "-" : "";
  const s = Math.abs(Math.round(n)).toString();
  return neg + s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
const fmtEuro = n => isFinite(n) ? groupInt(n) + " €" : "—";
const fmtPct = n => isFinite(n) ? (Math.round(n*1000)/10).toString().replace(".", ",") + "%" : "—";

// Campi con separatore delle migliaia (es. 400.000). Le aliquote restano numeri semplici.
const GROUPED = ["mq","prezzoMq","acquisto","notaio","geometra","speseCond","arredo","interior","corrente","ristrutturazioneMq"];
function rawNum(id){
  let v = (document.getElementById(id).value || "");
  if (GROUPED.indexOf(id) >= 0) v = v.replace(/\./g, "");   // rimuovi i punti delle migliaia
  v = v.replace(",", ".");                                   // eventuale decimale con virgola
  const n = parseFloat(v);
  return isFinite(n) ? n : 0;
}
const num = rawNum;
function formatGrouped(el){
  if (!el) return;
  const digits = (el.value || "").replace(/[^\d]/g, "");
  el.value = digits === "" ? "" : groupInt(parseInt(digits, 10));
}
function formatAllGrouped(){ GROUPED.forEach(id => formatGrouped(document.getElementById(id))); }


// Un campo è "compilato" solo se contiene davvero un numero (vuoto ≠ 0).
function filled(id){
  let v = (document.getElementById(id).value || "");
  if (GROUPED.indexOf(id) >= 0) v = v.replace(/\./g, "");
  v = v.replace(",", ".").trim();
  return v !== "" && isFinite(parseFloat(v));
}

// ===== CALCOLATORE (stesse formule del foglio Excel "milano centrale") =====
function calcola(){
  const mq = num("mq");
  const prezzoMq = num("prezzoMq");
  const acquisto = num("acquisto");
  const notaio = num("notaio");
  const geometra = num("geometra");
  const speseCond = num("speseCond");
  const arredo = num("arredo");
  const interior = num("interior");
  const corrente = num("corrente");
  const ristrutturazioneMq = num("ristrutturazioneMq");
  const aliquotaImposte = num("aliquotaImposte");
  const aliquotaAgenzia = num("aliquotaAgenzia");

  // Se non ci sono i prezzi/mq, i risultati restano vuoti (—) invece di mostrare numeri parziali.
  const hasAcq = filled("acquisto");
  const hasMq = filled("mq");
  const hasPrezzo = filled("prezzoMq");
  const hasRistr = filled("ristrutturazioneMq") && hasMq;

  const imposte = hasAcq ? acquisto * (aliquotaImposte/100) + 100 : NaN;
  const agenzia = hasAcq ? acquisto * (aliquotaAgenzia/100) : NaN;
  const ristrutturazione = hasRistr ? ristrutturazioneMq * mq : NaN;

  const totale = hasAcq
    ? acquisto + imposte + notaio + speseCond + agenzia + (hasRistr ? ristrutturazione : 0) + geometra + corrente + arredo + interior
    : NaN;
  const ricavo = (hasMq && hasPrezzo) ? mq * prezzoMq : NaN;
  const utile = (isFinite(ricavo) && isFinite(totale)) ? ricavo - totale : NaN;
  const roi = (isFinite(utile) && totale > 0) ? utile / totale : NaN;
  const capitaleRogito = hasAcq ? acquisto + notaio + agenzia : NaN;
  const acquistoMq = (hasAcq && hasMq && mq > 0) ? acquisto / mq : NaN;

  document.getElementById("calcImposte").textContent = fmtEuro(imposte);
  document.getElementById("calcAgenzia").textContent = fmtEuro(agenzia);
  document.getElementById("calcRistrutturazione").textContent = fmtEuro(ristrutturazione);

  document.getElementById("rTotale").textContent = fmtEuro(totale);
  document.getElementById("rRicavo").textContent = fmtEuro(ricavo);
  document.getElementById("rUtile").textContent = fmtEuro(utile);
  document.getElementById("rRogito").textContent = fmtEuro(capitaleRogito);
  document.getElementById("rAcquistoMq").textContent = isFinite(acquistoMq) ? groupInt(acquistoMq) + " €/mq" : "—";
  document.getElementById("rRoi").textContent = fmtPct(roi);

  const utileEl = document.getElementById("rUtile").closest(".result-item");
  utileEl.classList.toggle("neg", utile < 0);
  const roiEl = document.getElementById("rRoi").closest(".result-item");
  roiEl.classList.toggle("neg", roi < 0);

  return { mq, prezzoMq, acquisto, notaio, geometra, speseCond, arredo, interior, corrente,
    ristrutturazioneMq, aliquotaImposte, aliquotaAgenzia, imposte, agenzia, ristrutturazione, totale, ricavo, utile, roi, capitaleRogito, acquistoMq };
}

GROUPED.forEach(id => document.getElementById(id).addEventListener("input", e => { formatGrouped(e.target); calcola(); }));
["aliquotaImposte","aliquotaAgenzia"].forEach(id => document.getElementById(id).addEventListener("input", calcola));

formatAllGrouped();
calcola();


// ===== ZONA / OMI =====
function normalizza(s){
  return (s||"").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/^(via|viale|corso|piazza|piazzale|largo|vicolo|foro|bastioni|ripa|alzaia|galleria|passaggio)\s+/,"")
    .replace(/[^a-z0-9\s]/g,"").replace(/\s+/g," ").trim();
}

function tokenizzaVia(s){
  return normalizza(s).split(" ").filter(t => t && t !== "milano" && !/^\d+$/.test(t));
}

function estraiCivico(s){
  const m = (s||"").match(/\b(\d+)\b/);
  return m ? parseInt(m[1],10) : null;
}

// Trova la zona OMI da via (e civico) usando il dataset ufficiale.
function cercaZona(indirizzo, citta){
  if (!OMI_DATA || !OMI_DATA.streets) return null;
  const c = normalizza(citta);
  if (c && c !== "milano") return null;
  const qt = tokenizzaVia(indirizzo);
  if (!qt.length) return null;

  const streets = OMI_DATA.streets;
  let best = null, bestScore = -Infinity, bestExact = 0;
  for (const key in streets){
    const kt = key.split(" ");
    let exact = 0, pref = 0, ok = true;
    for (const q of qt){
      if (kt.indexOf(q) >= 0){ exact++; }
      else if (kt.some(k => k.startsWith(q) || q.startsWith(k))){ pref++; }
      else { ok = false; break; }
    }
    if (!ok) continue;
    const qlen = qt.reduce((a,q) => a + q.length, 0);
    const score = exact*1000 + pref*10 + qlen - Math.abs(kt.length - qt.length)*5;
    if (score > bestScore){ bestScore = score; best = key; bestExact = exact; }
  }
  // evita falsi positivi su digitazioni troppo corte/generiche
  if (!best) return null;
  const qlenTot = qt.reduce((a,q) => a + q.length, 0);
  if (bestExact === 0 && qlenTot < 4) return null;

  let code = streets[best];
  if (code && typeof code === "object"){
    const civ = estraiCivico(indirizzo);
    let z = code.d;                       // default: zona dominante della via
    if (civ != null && code.r && code.r.length){
      let hit = null, bestDist = Infinity;
      for (const r of code.r){
        if (civ >= r[0] && civ <= r[1]){ hit = r[2]; bestDist = 0; break; }  // civico dentro un tratto
        const d = civ < r[0] ? r[0] - civ : civ - r[1];                       // distanza dal tratto
        if (d < bestDist){ bestDist = d; hit = r[2]; }
      }
      if (hit) z = hit;                    // tratto esatto o, se assente, il più vicino per numerazione
    }
    code = z;
  }
  const zi = OMI_DATA.zones[code];
  if (!zi) return null;
  return Object.assign({ codice: code }, zi);
}

function aggiornaZona(){
  const indirizzo = document.getElementById("indirizzo").value;
  const citta = document.getElementById("citta").value;
  const box = document.getElementById("zoneBox");
  const linkRow = document.getElementById("linkRow");

  const zona = cercaZona(indirizzo, citta);
  if (zona){
    box.classList.remove("empty");
    const rng = (a,b) => {
      if (a && b) return a === b ? `${groupInt(a)} €/mq` : `${groupInt(a)}–${groupInt(b)} €/mq`;
      if (a) return `da ${groupInt(a)} €/mq`;
      return "n/d";
    };
    box.innerHTML = `
      <div class="zone-name">Zona ${zona.codice ? zona.codice + " — " : ""}${zona.nome}</div>
      <div class="zone-scenarios">
        <div class="scen da">
          <div class="scen-lbl">Da ristrutturare</div>
          <div class="scen-val">${rng(zona.dr_min, zona.dr_max)}</div>
        </div>
        <div class="scen ri">
          <div class="scen-lbl">Ristrutturato</div>
          <div class="scen-val">${rng(zona.ri_min, zona.ri_max)}</div>
        </div>
      </div>
      ${zona.ntn ? `<div class="scen mkt">
        <div class="scen-lbl">Compravendite 2025</div>
        <div class="scen-val">${groupInt(zona.ntn)}${zona.ntn_var != null ? ` <span class="mkt-var">(${zona.ntn_var >= 0 ? "+" : ""}${zona.ntn_var}% sul 2024)</span>` : ""}</div>
      </div>` : ""}
      <div class="zone-src">${OMI_DATA.fonte} · quotazioni ${OMI_DATA.periodo}${zona.ntn ? " · transazioni " + OMI_DATA.ntn_periodo : ""}${zona.solo_ottimo ? " · OMI riporta solo lo stato Ottimo per questa zona" : ""}</div>
    `;
    if (!document.getElementById("prezzoMq").dataset.userEdited && zona.ri_min){
      document.getElementById("prezzoMq").value = groupInt(Math.round((zona.ri_min + (zona.ri_max || zona.ri_min))/2));
      calcola();
    }
  } else {
    box.classList.add("empty");
    box.textContent = citta && normalizza(citta) !== "milano"
      ? "Dataset zone disponibile solo per Milano. Usa i link qui sotto per verificare manualmente."
      : "Via non trovata nel dataset. Usa i link qui sotto per verificare manualmente, oppure prova con il solo nome della via.";
  }

  linkRow.innerHTML = `
    <a href="https://www1.agenziaentrate.gov.it/servizi/Consultazione/ricerca.php" target="_blank" rel="noopener">Agenzia Entrate OMI</a>
    <a href="https://www.immobiliare.it/vendita-case/milano/" target="_blank" rel="noopener">Immobiliare.it</a>
  `;
}
document.getElementById("indirizzo").addEventListener("input", aggiornaZona);
document.getElementById("citta").addEventListener("input", aggiornaZona);
document.getElementById("prezzoMq").addEventListener("input", e => e.target.dataset.userEdited = "1");
aggiornaZona();


// ===== CHECKLIST SOPRALLUOGO =====
const CHECKLIST_ITEMS = [
  { key:"elettrico",   label:"Impianto elettrico",              group:"Impianti" },
  { key:"idraulico",   label:"Impianto idraulico",               group:"Impianti" },
  { key:"riscaldamento",label:"Riscaldamento / climatizzazione", group:"Impianti" },
  { key:"umidita",     label:"Umidità / muffa",                  group:"Stato immobile" },
  { key:"infissi",     label:"Infissi",                          group:"Stato immobile" },
  { key:"facciata",    label:"Facciata / tetto",                 group:"Stato immobile" },
  { key:"rumore",      label:"Rumore / esposizione",             group:"Stato immobile" },
  { key:"catasto",     label:"Conformità catastale / planimetria",group:"Documenti" },
  { key:"ape",         label:"Classe energetica (APE)",          group:"Documenti" },
  { key:"vincoli",     label:"Vincoli (paesaggistico/storico)",  group:"Documenti" },
  { key:"abusi",       label:"Abusi edilizi visibili",           group:"Documenti" },
  { key:"piano",       label:"Piano e ascensore",                group:"Contesto" },
  { key:"spesearretrate",label:"Spese condominiali arretrate",   group:"Contesto" },
  { key:"parcheggio",  label:"Parcheggio / box",                 group:"Contesto" },
];
const CHECK_STATES = ["", "ok", "attenzione", "problema"];
const CHECK_LABELS = { "":"Da valutare", ok:"OK", attenzione:"Da verificare", problema:"Problema" };
let checklistState = {};

function buildChecklist(){
  const wrap = document.getElementById("checklistGroups");
  const groups = [...new Set(CHECKLIST_ITEMS.map(i => i.group))];
  wrap.innerHTML = groups.map(g => `
    <div class="check-group">
      <div class="check-group-lbl">${g}</div>
      ${CHECKLIST_ITEMS.filter(i => i.group === g).map(i => `
        <div class="check-item">
          <span>${i.label}</span>
          <button type="button" class="check-status" data-key="${i.key}" data-state="">Da valutare</button>
        </div>
      `).join("")}
    </div>
  `).join("");
  wrap.querySelectorAll(".check-status").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const cur = CHECK_STATES.indexOf(checklistState[key] || "");
      const next = CHECK_STATES[(cur + 1) % CHECK_STATES.length];
      checklistState[key] = next;
      btn.dataset.state = next;
      btn.textContent = CHECK_LABELS[next];
      updateChecklistBadge();
    });
  });
}

function updateChecklistBadge(){
  const total = CHECKLIST_ITEMS.length;
  const compiled = CHECKLIST_ITEMS.filter(i => checklistState[i.key]).length;
  const problemi = CHECKLIST_ITEMS.filter(i => checklistState[i.key] === "problema").length;
  const badge = document.getElementById("checklistBadge");
  const toggle = document.getElementById("checklistToggle");
  badge.textContent = `${compiled}/${total}`;
  toggle.classList.toggle("has-issue", problemi > 0);
  toggle.classList.toggle("all-ok", problemi === 0 && compiled === total);
}

function resetChecklistUI(){
  checklistState = {};
  buildChecklist();
  updateChecklistBadge();
  document.getElementById("checklistNote").value = "";
}

function applyChecklistState(saved){
  checklistState = Object.assign({}, saved || {});
  buildChecklist();
  document.querySelectorAll(".check-status").forEach(btn => {
    const st = checklistState[btn.dataset.key] || "";
    btn.dataset.state = st;
    btn.textContent = CHECK_LABELS[st];
  });
  updateChecklistBadge();
}

buildChecklist();
updateChecklistBadge();

document.getElementById("checklistToggle").addEventListener("click", () => {
  const card = document.getElementById("checklistCard");
  card.style.display = card.style.display === "none" ? "" : "none";
  if (card.style.display !== "none") card.scrollIntoView({ behavior:"smooth", block:"nearest" });
});


// ===== TRATTATIVA =====
const STATO_OPTIONS = [
  { key:"valutazione", label:"Da valutare" },
  { key:"offerta",      label:"Offerta fatta" },
  { key:"trattativa",   label:"In trattativa" },
  { key:"vinta",        label:"Vinta" },
  { key:"persa",        label:"Persa / scartata" },
];
let trattativaStato = "valutazione";
let allegatoDataUrl = null;

function buildStatoPills(){
  const wrap = document.getElementById("statoPills");
  wrap.innerHTML = STATO_OPTIONS.map(s =>
    `<button type="button" class="status-pill${s.key === trattativaStato ? " active" : ""}" data-stato="${s.key}">${s.label}</button>`
  ).join("");
  wrap.querySelectorAll(".status-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      trattativaStato = btn.dataset.stato;
      wrap.querySelectorAll(".status-pill").forEach(b => b.classList.toggle("active", b.dataset.stato === trattativaStato));
    });
  });
}
buildStatoPills();

function setAllegato(dataUrl){
  allegatoDataUrl = dataUrl;
  const preview = document.getElementById("allegatoPreview");
  const img = document.getElementById("allegatoImg");
  if (dataUrl){
    img.src = dataUrl;
    preview.style.display = "";
  } else {
    img.src = "";
    preview.style.display = "none";
  }
}

// Ridimensiona/comprime l'immagine lato client (localStorage ha spazio limitato).
function comprimiImmagine(file, maxSide, quality){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxSide){ height = Math.round(height * maxSide / width); width = maxSide; }
      else if (height > maxSide){ width = Math.round(width * maxSide / height); height = maxSide; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

document.getElementById("allegatoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const label = document.getElementById("allegatoLabel");
  const orig = label.textContent;
  label.textContent = "Elaborazione...";
  try {
    const dataUrl = await comprimiImmagine(file, 1280, 0.72);
    setAllegato(dataUrl);
  } catch(e){
    alert("Non sono riuscito a leggere il file. Riprova con un'altra foto.");
  }
  label.textContent = orig;
  e.target.value = "";
});
document.getElementById("allegatoRemove").addEventListener("click", () => setAllegato(null));


// ===== TABS =====
function setTab(tab){
  document.getElementById("tabNew").classList.toggle("active", tab === "new");
  document.getElementById("tabSaved").classList.toggle("active", tab === "saved");
  document.getElementById("viewNew").style.display = tab === "new" ? "" : "none";
  document.getElementById("viewSaved").style.display = tab === "saved" ? "" : "none";
  if (tab === "saved") renderSaved();
}
document.getElementById("tabNew").addEventListener("click", () => setTab("new"));
document.getElementById("tabSaved").addEventListener("click", () => setTab("saved"));


// ===== SALVATAGGIO VISITE (localStorage) =====
const STORAGE_KEY = "gv_visite_v1";

function getVisite(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function setVisite(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

function raccogliScheda(){
  const c = calcola();
  return {
    id: Date.now(),
    data: new Date().toISOString(),
    indirizzo: document.getElementById("indirizzo").value,
    citta: document.getElementById("citta").value,
    descrizione: document.getElementById("descrizione").value,
    checklist: Object.assign({}, checklistState),
    checklistNote: document.getElementById("checklistNote").value,
    trattativaStato: trattativaStato,
    trattativaNote: document.getElementById("trattativaNote").value,
    allegato: allegatoDataUrl,
    ...c
  };
}

document.getElementById("btnSave").addEventListener("click", () => {
  const scheda = raccogliScheda();
  if (!scheda.indirizzo){ alert("Inserisci almeno l'indirizzo prima di salvare."); return; }
  const list = getVisite();
  list.unshift(scheda);
  setVisite(list);
  const btn = document.getElementById("btnSave");
  const orig = btn.textContent;
  btn.textContent = "Salvata ✓";
  setTimeout(() => btn.textContent = orig, 1400);
});

document.getElementById("btnReset").addEventListener("click", () => {
  if (!confirm("Svuotare tutti i campi della scheda corrente?")) return;
  ["indirizzo","descrizione","mq","prezzoMq","acquisto","notaio","geometra","speseCond","arredo","interior","corrente","ristrutturazioneMq"]
    .forEach(id => document.getElementById(id).value = "");
  document.getElementById("citta").value = "Milano";
  document.getElementById("aliquotaImposte").value = 9;
  document.getElementById("aliquotaAgenzia").value = 4.88;
  delete document.getElementById("prezzoMq").dataset.userEdited;
  formatAllGrouped();
  calcola();
  aggiornaZona();
  resetChecklistUI();
  document.getElementById("checklistCard").style.display = "none";
  trattativaStato = "valutazione";
  buildStatoPills();
  document.getElementById("trattativaNote").value = "";
  setAllegato(null);
});

document.getElementById("btnShare").addEventListener("click", async () => {
  const c = calcola();
  const indirizzo = document.getElementById("indirizzo").value || "Immobile";
  const citta = document.getElementById("citta").value;
  const descrizione = document.getElementById("descrizione").value;
  const statoLbl = (STATO_OPTIONS.find(s => s.key === trattativaStato) || {}).label || "";
  const problemi = CHECKLIST_ITEMS.filter(i => checklistState[i.key] === "problema").map(i => i.label);
  const testo = `${indirizzo}${citta ? ", " + citta : ""}\n${descrizione || ""}\n\n` +
    `Superficie: ${c.mq} mq\n` +
    `Acquisto: ${fmtEuro(c.acquisto)} (${isFinite(c.acquistoMq) ? c.acquistoMq.toLocaleString("it-IT",{maximumFractionDigits:0}) : "—"} €/mq)\n` +
    `Ristrutturazione: ${fmtEuro(c.ristrutturazione)} (${c.ristrutturazioneMq} €/mq)\n` +
    `Totale costi: ${fmtEuro(c.totale)}\n` +
    `Ricavo stimato: ${fmtEuro(c.ricavo)} (${c.prezzoMq} €/mq)\n` +
    `Utile stimato: ${fmtEuro(c.utile)}\n` +
    `ROI: ${fmtPct(c.roi)}\n` +
    `Capitale al rogito: ${fmtEuro(c.capitaleRogito)}\n` +
    `\nTrattativa: ${statoLbl}` +
    (problemi.length ? `\n⚠ Problemi rilevati: ${problemi.join(", ")}` : "");

  if (navigator.share){
    try { await navigator.share({ title: indirizzo, text: testo }); } catch(e){}
  } else {
    await navigator.clipboard.writeText(testo);
    alert("Riepilogo copiato negli appunti.");
  }
});

function renderSaved(){
  const list = getVisite();
  const el = document.getElementById("savedList");
  if (!list.length){
    el.innerHTML = `<div class="empty-state">Nessuna visita salvata.<br>Compila una scheda e premi "Salva questa visita".</div>`;
    return;
  }
  el.innerHTML = list.map(v => {
    const dt = new Date(v.data);
    const dataStr = dt.toLocaleDateString("it-IT",{day:"2-digit",month:"short",year:"numeric"});
    const statoInfo = STATO_OPTIONS.find(s => s.key === v.trattativaStato);
    const problemi = CHECKLIST_ITEMS.filter(i => (v.checklist || {})[i.key] === "problema").length;
    return `
      <div class="visit-item" data-id="${v.id}">
        <div class="vi-top">
          <div class="vi-addr">${v.indirizzo || "Senza indirizzo"}</div>
          <div class="vi-date">${dataStr}</div>
        </div>
        <div class="vi-sub">${v.citta || ""}${v.descrizione ? " · " + v.descrizione : ""}
          ${statoInfo ? `<span class="vi-stato ${statoInfo.key}">${statoInfo.label}</span>` : ""}
        </div>
        <div class="vi-stats">
          <span>Utile <b>${fmtEuro(v.utile)}</b></span>
          <span>ROI <b>${fmtPct(v.roi)}</b></span>
          ${problemi ? `<span class="vi-issue">⚠ ${problemi} problem${problemi > 1 ? "i" : "a"}</span>` : ""}
        </div>
      </div>
    `;
  }).join("");

  el.querySelectorAll(".visit-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = Number(item.dataset.id);
      const v = getVisite().find(x => x.id === id);
      if (!v) return;
      if (!confirm(`Caricare la scheda "${v.indirizzo}"?\n(Verrà sostituita la scheda corrente. Scegli Annulla per eliminarla invece.)`)){
        if (confirm("Eliminare questa visita salvata?")){
          setVisite(getVisite().filter(x => x.id !== id));
          renderSaved();
        }
        return;
      }
      document.getElementById("indirizzo").value = v.indirizzo || "";
      document.getElementById("citta").value = v.citta || "Milano";
      document.getElementById("descrizione").value = v.descrizione || "";
      document.getElementById("mq").value = v.mq || "";
      document.getElementById("prezzoMq").value = v.prezzoMq || "";
      document.getElementById("prezzoMq").dataset.userEdited = "1";
      document.getElementById("acquisto").value = v.acquisto || "";
      document.getElementById("notaio").value = v.notaio;
      document.getElementById("geometra").value = v.geometra;
      document.getElementById("speseCond").value = v.speseCond;
      document.getElementById("arredo").value = v.arredo;
      document.getElementById("interior").value = v.interior;
      document.getElementById("corrente").value = v.corrente;
      document.getElementById("ristrutturazioneMq").value = v.ristrutturazioneMq;
      document.getElementById("aliquotaImposte").value = v.aliquotaImposte ?? 9;
      document.getElementById("aliquotaAgenzia").value = v.aliquotaAgenzia ?? 4.88;
      formatAllGrouped();
      calcola();
      aggiornaZona();
      applyChecklistState(v.checklist);
      document.getElementById("checklistNote").value = v.checklistNote || "";
      trattativaStato = v.trattativaStato || "valutazione";
      buildStatoPills();
      document.getElementById("trattativaNote").value = v.trattativaNote || "";
      setAllegato(v.allegato || null);
      setTab("new");
    });
  });
}
