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
    applyImportFromUrl();
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

  // Prezzo massimo d'acquisto per centrare il ROI obiettivo.
  // ROI = ricavo/totale − 1  →  totale obiettivo = ricavo / (1 + ROI).
  // I costi si dividono in: quota proporzionale all'acquisto (k) e quota fissa (costiFissi).
  //   totale = k·acquisto + costiFissi  →  acquisto = (totaleObiettivo − costiFissi) / k
  const roiTarget = num("roiTarget");
  const hasRoiT = filled("roiTarget") && roiTarget > -100;
  const kMul = 1 + aliquotaImposte/100 + aliquotaAgenzia/100;
  const costiFissi = 100 + notaio + geometra + speseCond + arredo + interior + corrente + (hasRistr ? ristrutturazione : 0);
  const totaleObiettivo = (hasMq && hasPrezzo && hasRoiT) ? ricavo / (1 + roiTarget/100) : NaN;
  const offerta = isFinite(totaleObiettivo) ? (totaleObiettivo - costiFissi) / kMul : NaN;
  const offertaMq = (isFinite(offerta) && hasMq && mq > 0) ? offerta / mq : NaN;

  document.getElementById("calcImposte").textContent = fmtEuro(imposte);
  document.getElementById("calcAgenzia").textContent = fmtEuro(agenzia);
  document.getElementById("calcRistrutturazione").textContent = fmtEuro(ristrutturazione);

  document.getElementById("rTotale").textContent = fmtEuro(totale);
  document.getElementById("rRicavo").textContent = fmtEuro(ricavo);
  document.getElementById("rUtile").textContent = fmtEuro(utile);
  document.getElementById("rRogito").textContent = fmtEuro(capitaleRogito);
  document.getElementById("rAcquistoMq").textContent = isFinite(acquistoMq) ? groupInt(acquistoMq) + " €/mq" : "—";
  document.getElementById("rRoi").textContent = fmtPct(roi);

  const offEl = document.getElementById("rOfferta");
  offEl.textContent = fmtEuro(offerta);
  offEl.classList.toggle("neg", isFinite(offerta) && offerta <= 0);
  document.getElementById("rOffertaMq").textContent = isFinite(offertaMq) ? groupInt(offertaMq) + " €/mq d'offerta" : "—";

  const utileEl = document.getElementById("rUtile").closest(".result-item");
  utileEl.classList.toggle("neg", utile < 0);
  const roiEl = document.getElementById("rRoi").closest(".result-item");
  roiEl.classList.toggle("neg", roi < 0);
  updateContoBadge(roi);

  return { mq, prezzoMq, acquisto, notaio, geometra, speseCond, arredo, interior, corrente,
    ristrutturazioneMq, aliquotaImposte, aliquotaAgenzia, roiTarget, imposte, agenzia, ristrutturazione,
    totale, ricavo, utile, roi, capitaleRogito, acquistoMq, offerta, offertaMq };
}

GROUPED.forEach(id => document.getElementById(id).addEventListener("input", e => { formatGrouped(e.target); calcola(); }));
["aliquotaImposte","aliquotaAgenzia","roiTarget"].forEach(id => document.getElementById(id).addEventListener("input", calcola));

// "Usa come prezzo di acquisto": copia il prezzo max d'offerta nel campo acquisto.
document.getElementById("btnUsaOfferta").addEventListener("click", () => {
  const c = calcola();
  if (!isFinite(c.offerta) || c.offerta <= 0){
    alert("Per il prezzo d'offerta servono la superficie (mq) e il prezzo di vendita stimato (€/mq).");
    return;
  }
  const el = document.getElementById("acquisto");
  el.value = groupInt(Math.round(c.offerta));
  formatGrouped(el);
  calcola();
});

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

// Formatta un intervallo €/mq (min–max, oppure "da X", oppure n/d).
function fmtRange(a, b){
  if (a && b) return a === b ? `${groupInt(a)} €/mq` : `${groupInt(a)}–${groupInt(b)} €/mq`;
  if (a) return `da ${groupInt(a)} €/mq`;
  if (b) return `fino a ${groupInt(b)} €/mq`;
  return "n/d";
}

// Normalizza il nome di un comune allo stesso modo delle chiavi in OMI_DATA.province.comuni.
function normComune(s){
  return (s||"").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ").trim();
}

// ===== PROVINCIA (comune -> zona OMI) =====
let selZonaProv = null;   // { key, via, idx, manual, auto }

function provNome(pr){ return ((OMI_DATA.province && OMI_DATA.province.prov_nomi) || {})[pr] || pr; }

// Indice: provincia -> { nomeComuneNormalizzato -> chiave in OMI_DATA.province.comuni }
let PROV_INDEX = null;
function provIndex(){
  if (PROV_INDEX) return PROV_INDEX;
  PROV_INDEX = {};
  const P = OMI_DATA.province;
  if (P && P.comuni){
    for (const key in P.comuni){
      const c = P.comuni[key];
      (PROV_INDEX[c.prov] = PROV_INDEX[c.prov] || {})[normComune(c.nome)] = key;
    }
  }
  return PROV_INDEX;
}

// Trova il comune nella provincia scelta dal nome digitato (match esatto o prefisso univoco).
function cercaComune(citta, prov){
  const P = OMI_DATA.province;
  if (!P || !P.comuni) return null;
  const cn = normComune(citta);
  if (!cn) return null;
  const idx = provIndex()[prov];
  if (!idx) return null;
  if (idx[cn]) return Object.assign({ key: idx[cn] }, P.comuni[idx[cn]]);
  if (cn.length >= 3){
    const hits = Object.keys(idx).filter(n => n.startsWith(cn));
    if (hits.length === 1) return Object.assign({ key: idx[hits[0]] }, P.comuni[idx[hits[0]]]);
  }
  return null;
}

// Elenco nomi comune (ordinati) di una provincia dal dataset.
function comuniDiProvincia(prov){
  const P = OMI_DATA.province;
  const list = [];
  if (P && P.comuni){
    for (const k in P.comuni) if (P.comuni[k].prov === prov) list.push(P.comuni[k].nome);
  }
  return list.sort((a, b) => a.localeCompare(b, "it"));
}

// Riempie il menu a tendina Comune per la provincia scelta (Milano città in testa per MI).
function popolaComuni(prov, selected){
  const sel = document.getElementById("citta");
  if (!sel) return;
  let opts = "";
  if (prov === "MI") opts += `<option value="Milano">Milano (città)</option>`;
  comuniDiProvincia(prov).forEach(n => {
    opts += `<option value="${n.replace(/"/g, "&quot;")}">${n}</option>`;
  });
  sel.innerHTML = opts || `<option value="">— dati comune non disponibili —</option>`;
  if (selected != null) sel.value = selected;
  if (!sel.value && sel.options.length) sel.selectedIndex = 0;
}

// Parole da ignorare nel confronto via <-> denominazione zona OMI.
const STOP_TOK = new Set(["via","viale","vicolo","corso","piazza","piazzale","largo","localita","loc",
  "frazione","fraz","strada","contrada","salita","passaggio","ripa","foro","alzaia","galleria","nucleo",
  "del","della","dei","degli","delle","dello","san","santa","sant","santo","ss"]);
function toks(s){
  return normComune(s).split(" ").filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOP_TOK.has(t));
}
// Indice della zona la cui denominazione OMI contiene la via digitata, o -1 se incerto/assente.
function matchViaZona(indirizzo, zone){
  const qt = toks(indirizzo);
  if (!qt.length) return -1;
  let best = -1, bestScore = 0, ties = 0;
  zone.forEach((z, i) => {
    const dt = toks(z.nome || "");
    if (!dt.length) return;
    let score = 0;
    qt.forEach(q => { if (dt.some(d => d === q || d.startsWith(q) || q.startsWith(d))) score++; });
    if (score > bestScore){ bestScore = score; best = i; ties = 1; }
    else if (score === bestScore && score > 0){ ties++; }
  });
  return (bestScore > 0 && ties === 1) ? best : -1;
}

function setPrezzoFromZona(z, force){
  const el = document.getElementById("prezzoMq");
  if (!z) return;
  if (!force && el.dataset.userEdited) return;
  const base = z.ri_min ? [z.ri_min, z.ri_max || z.ri_min]
             : z.dr_min ? [z.dr_min, z.dr_max || z.dr_min] : null;
  if (!base) return;
  el.value = groupInt(Math.round((base[0] + base[1]) / 2));
  if (force) delete el.dataset.userEdited;
  calcola();
}

// Etichetta breve per il chip zona: codice + nome (se corto) o fascia.
function zonaLabel(z){
  const nm = (z.nome || "").trim();
  const corto = nm && nm.length <= 18 && nm.indexOf(",") < 0 && !nm.endsWith("...");
  return z.codice + (corto ? " · " + nm : (z.fascia ? " · " + z.fascia : ""));
}

function renderProvincia(box, com, indirizzo){
  box.classList.remove("empty");
  const P = OMI_DATA.province;
  if (!com.zone || !com.zone.length){
    box.classList.add("empty");
    box.textContent = `${com.nome} (${provNome(com.prov)}): OMI non riporta quotazioni residenziali per questo comune.`;
    return;
  }

  // Solo la zona OMI riconosciuta dalla via (o l'unica del comune). Nessun'altra opzione.
  const zi = com.zone.length === 1 ? com.zone[0] : (function(){
    const a = matchViaZona(indirizzo, com.zone);
    return a >= 0 ? com.zone[a] : null;
  })();

  if (!zi){
    box.innerHTML = `<div class="zone-name">${com.nome} <span class="zone-prov">${provNome(com.prov)}</span></div>
      <div class="zone-hint">${indirizzo.trim()
        ? "Via non riconosciuta nell'elenco OMI di questo comune — controlla il nome della via."
        : "Scrivi via e civico per trovare la zona OMI."}</div>`;
    return;
  }

  box.innerHTML = `
    <div class="zone-name">${com.nome} <span class="zone-prov">${provNome(com.prov)}</span></div>
    <div class="zone-scenarios">
      <div class="scen da">
        <div class="scen-lbl">Da ristrutturare</div>
        <div class="scen-val">${fmtRange(zi.dr_min, zi.dr_max)}</div>
      </div>
      <div class="scen ri">
        <div class="scen-lbl">Ristrutturato</div>
        <div class="scen-val">${fmtRange(zi.ri_min, zi.ri_max)}</div>
      </div>
    </div>
    <div class="zone-src">Zona ${zi.codice} · ${zi.fascia || ""} · ${P.fonte} ${P.periodo}${zi.eco ? " · valori su abitazioni di tipo economico (civili non quotate)" : ""}</div>
  `;
  setPrezzoFromZona(zi, false);
}

// Render della zona di Milano città (ricerca per via).
function renderMilanoZona(box, zona){
  box.classList.remove("empty");
  box.innerHTML = `
    <div class="zone-name">Zona ${zona.codice ? zona.codice + " — " : ""}${zona.nome}</div>
    <div class="zone-scenarios">
      <div class="scen da">
        <div class="scen-lbl">Da ristrutturare</div>
        <div class="scen-val">${fmtRange(zona.dr_min, zona.dr_max)}</div>
      </div>
      <div class="scen ri">
        <div class="scen-lbl">Ristrutturato</div>
        <div class="scen-val">${fmtRange(zona.ri_min, zona.ri_max)}</div>
      </div>
    </div>
    ${zona.ntn ? `<div class="scen mkt">
      <div class="scen-lbl">Compravendite 2025</div>
      <div class="scen-val">${groupInt(zona.ntn)}${zona.ntn_var != null ? ` <span class="mkt-var">(${zona.ntn_var >= 0 ? "+" : ""}${zona.ntn_var}% sul 2024)</span>` : ""}</div>
    </div>` : ""}
    <div class="zone-src">${OMI_DATA.fonte} · quotazioni ${OMI_DATA.periodo}${zona.ntn ? " · transazioni " + OMI_DATA.ntn_periodo : ""}${zona.solo_ottimo ? " · OMI riporta solo lo stato Ottimo per questa zona" : ""}</div>
  `;
  setPrezzoFromZona({ ri_min: zona.ri_min, ri_max: zona.ri_max, dr_min: zona.dr_min, dr_max: zona.dr_max }, false);
}

function provinciaSel(){ const el = document.getElementById("provincia"); return el ? el.value : "MI"; }

function aggiornaZona(){
  const indirizzo = document.getElementById("indirizzo").value;
  const citta = document.getElementById("citta").value;
  const prov = provinciaSel();
  const box = document.getElementById("zoneBox");
  const linkRow = document.getElementById("linkRow");
  const cn = normComune(citta);

  if (prov === "MI" && (cn === "milano" || !cn)){
    // Milano città: ricerca per via/civico con dataset dedicato.
    const zona = cercaZona(indirizzo, "milano");
    if (zona){
      renderMilanoZona(box, zona);
    } else {
      box.classList.add("empty");
      box.textContent = "Via non trovata nel dataset di Milano. Usa i link qui sotto, oppure prova con il solo nome della via.";
    }
  } else {
    // Altre province / altri comuni: comune + zona (con auto-match via dove disponibile).
    if (!cn){
      box.classList.add("empty");
      box.textContent = `Scrivi il comune (provincia di ${provNome(prov)}).`;
    } else {
      const match = cercaComune(citta, prov);
      if (match){
        renderProvincia(box, match, indirizzo);
      } else {
        box.classList.add("empty");
        box.textContent = `Comune non trovato in provincia di ${provNome(prov)}. Controlla il nome, o cambia provincia.`;
      }
    }
  }

  const cittaSlug = cn.replace(/\s+/g, "-") || "milano";
  linkRow.innerHTML = `
    <a href="https://www1.agenziaentrate.gov.it/servizi/Consultazione/ricerca.php" target="_blank" rel="noopener">Agenzia Entrate OMI</a>
    <a href="https://www.immobiliare.it/vendita-case/${cittaSlug}/" target="_blank" rel="noopener">Immobiliare.it</a>
  `;
  updateImmobileRef();
}

// Intestazione "Città via civico" mostrata in cima a Checklist e Trattativa.
function updateImmobileRef(){
  const ind = document.getElementById("indirizzo").value.trim();
  const cit = document.getElementById("citta").value.trim();
  const txt = [cit, ind].filter(Boolean).join(" ");
  ["immobileRefCheck","immobileRefTratt"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (txt){ el.textContent = txt; el.classList.remove("empty"); }
    else { el.textContent = "Nessun indirizzo — inseriscilo nel Conto economico"; el.classList.add("empty"); }
  });
}

document.getElementById("indirizzo").addEventListener("input", aggiornaZona);
document.getElementById("citta").addEventListener("change", () => { selZonaProv = null; aggiornaZona(); });
document.getElementById("prezzoMq").addEventListener("input", e => e.target.dataset.userEdited = "1");
const provinciaEl = document.getElementById("provincia");
if (provinciaEl) provinciaEl.addEventListener("change", () => {
  selZonaProv = null;
  popolaComuni(provinciaEl.value);   // ripopola i comuni della provincia scelta
  aggiornaZona();
});
popolaComuni(provinciaSel(), "Milano");
aggiornaZona();


// ===== CHECKLIST SOPRALLUOGO =====
// Ogni set di opzioni: [valore, etichetta, tono]. Tono => colore: good/amber/warn/neutral.
const OPTSETS = {
  cond:     [["rifare","Da rifare","warn"], ["acc","Accettabile","amber"], ["ok","OK","good"]],
  doc:      [["ok","OK","good"], ["verifica","Da verificare","amber"], ["problema","Problema","warn"]],
  presenza: [["presente","Presente","warn"], ["assente","Non presente","good"]],
  livello:  [["basso","Basso","good"], ["medio","Medio","amber"], ["alto","Alto","warn"]],
  sino_pos: [["si","Sì","good"], ["no","No","neutral"]],
  sino_neg: [["si","Sì","warn"], ["no","No","good"]],
};
const CHECKLIST_ITEMS = [
  { key:"elettrico",    label:"Impianto elettrico",                group:"Impianti",       opts:"cond" },
  { key:"idraulico",    label:"Impianto idraulico",                group:"Impianti",       opts:"cond" },
  { key:"riscaldamento",label:"Riscaldamento / climatizzazione",   group:"Impianti",       opts:"cond" },
  { key:"umidita",      label:"Umidità / muffa",                   group:"Stato immobile", opts:"presenza" },
  { key:"infissi",      label:"Infissi",                           group:"Stato immobile", opts:"cond" },
  { key:"facciata",     label:"Facciata / tetto",                  group:"Stato immobile", opts:"cond" },
  { key:"rumore",       label:"Rumore",                            group:"Stato immobile", opts:"livello" },
  { key:"esposizione",  label:"Esposizione",                       group:"Stato immobile", type:"select",
    choices:["Nord","Sud","Est","Ovest","Nord-Est","Nord-Ovest","Sud-Est","Sud-Ovest"] },
  { key:"catasto",      label:"Conformità catastale / planimetria",group:"Documenti",      opts:"doc" },
  { key:"ape",          label:"Classe energetica (APE)",           group:"Documenti",      opts:"doc" },
  { key:"vincoli",      label:"Vincoli (paesaggistico/storico)",   group:"Documenti",      opts:"doc" },
  { key:"abusi",        label:"Abusi edilizi visibili",            group:"Documenti",      opts:"doc" },
  { key:"piano",        label:"Piano e ascensore",                 group:"Contesto",       type:"piano", opts:"sino_pos" },
  { key:"spesearretrate",label:"Spese condominiali arretrate",     group:"Contesto",       opts:"sino_neg" },
  { key:"parcheggio",   label:"Parcheggio / box",                  group:"Contesto",       opts:"sino_pos" },
];
let checklistState = {};   // key -> valore selezionato (stringa)
let pianoText = "";        // testo libero del piano

function optInfo(item, val){
  return (OPTSETS[item.opts] || []).find(o => o[0] === val) || null;
}
function optLabel(item, val){ const o = optInfo(item, val); return o ? o[1] : "Da valutare"; }
function optTone(item, val){ const o = optInfo(item, val); return o ? o[2] : ""; }

function buildChecklist(){
  const wrap = document.getElementById("checklistGroups");
  const groups = [...new Set(CHECKLIST_ITEMS.map(i => i.group))];
  wrap.innerHTML = groups.map(g => `
    <div class="check-group">
      <div class="check-group-lbl">${g}</div>
      ${CHECKLIST_ITEMS.filter(i => i.group === g).map(i => {
        const val = checklistState[i.key] || "";
        if (i.type === "piano"){
          return `
        <div class="check-item piano-item">
          <span>${i.label}</span>
          <div class="piano-controls">
            <button type="button" class="check-status piano-asc" data-key="${i.key}" data-tone="${optTone(i,val)}">${val ? "Ascensore: " + optLabel(i,val) : "Ascensore?"}</button>
            <input type="text" class="piano-input" id="pianoInput" placeholder="Piano es. 2°" value="${pianoText.replace(/"/g,'&quot;')}">
          </div>
        </div>`;
        }
        if (i.type === "select"){
          return `
        <div class="check-item">
          <span>${i.label}</span>
          <select class="check-select" data-key="${i.key}">
            <option value="">—</option>
            ${i.choices.map(c => `<option value="${c}" ${val === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>`;
        }
        return `
        <div class="check-item">
          <span>${i.label}</span>
          <button type="button" class="check-status" data-key="${i.key}" data-tone="${optTone(i,val)}">${val ? optLabel(i,val) : "Da valutare"}</button>
        </div>`;
      }).join("")}
    </div>
  `).join("");

  wrap.querySelectorAll(".check-status").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      const item = CHECKLIST_ITEMS.find(i => i.key === key);
      const seq = ["", ...OPTSETS[item.opts].map(o => o[0])];
      const cur = seq.indexOf(checklistState[key] || "");
      const next = seq[(cur + 1) % seq.length];
      checklistState[key] = next;
      btn.dataset.tone = optTone(item, next);
      btn.textContent = item.type === "piano"
        ? (next ? "Ascensore: " + optLabel(item, next) : "Ascensore?")
        : (next ? optLabel(item, next) : "Da valutare");
      updateChecklistBadge();
    });
  });
  wrap.querySelectorAll(".check-select").forEach(sel => {
    sel.addEventListener("change", () => { checklistState[sel.dataset.key] = sel.value; });
  });
  const pi = document.getElementById("pianoInput");
  if (pi) pi.addEventListener("input", e => pianoText = e.target.value);
}

function countIssues(state){
  return CHECKLIST_ITEMS.filter(i => optTone(i, (state || {})[i.key]) === "warn").length;
}

function updateChecklistBadge(){
  const tab = document.querySelector('.panel-tab[data-panel="checklist"]');
  tab.classList.toggle("has-issue", countIssues(checklistState) > 0);
}

function resetChecklistUI(){
  checklistState = {};
  pianoText = "";
  buildChecklist();
  updateChecklistBadge();
  document.getElementById("checklistNote").value = "";
}

function applyChecklistState(saved, pianoSaved){
  checklistState = Object.assign({}, saved || {});
  pianoText = pianoSaved || "";
  buildChecklist();
  updateChecklistBadge();
}

buildChecklist();
updateChecklistBadge();


// ===== SELETTORE PAGINA (Checklist / Trattativa / Conto economico) =====
const PANEL_CARDS = { checklist:"checklistCard", trattativa:"trattativaCard", conto:"contoEconomicoCard" };

function updateContoBadge(roi){
  const badge = document.getElementById("contoBadge");
  const tab = document.querySelector('.panel-tab[data-panel="conto"]');
  if (!badge || !tab) return;
  badge.textContent = fmtPct(roi);
  tab.classList.toggle("roi-pos", isFinite(roi) && roi >= 0);
  tab.classList.toggle("roi-neg", isFinite(roi) && roi < 0);
}

function showPanel(name){
  Object.keys(PANEL_CARDS).forEach(key => {
    document.getElementById(PANEL_CARDS[key]).style.display = key === name ? "" : "none";
  });
  document.querySelectorAll(".panel-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.panel === name));
}

document.querySelectorAll(".panel-tab").forEach(btn => {
  btn.addEventListener("click", () => showPanel(btn.dataset.panel));
});

// Click sul logo Gusmeroli -> torna alla pagina principale (Conto economico)
const topLogo = document.getElementById("topLogo");
if (topLogo) topLogo.addEventListener("click", () => { setTab("new"); showPanel("conto"); });


// ===== TRATTATIVA =====
const STATO_OPTIONS = [
  { key:"valutazione", label:"Da valutare" },
  { key:"offerta",      label:"Offerta fatta" },
  { key:"trattativa",   label:"In trattativa" },
];
let trattativaStato = "valutazione";
let allegatoDataUrl = null;

function updateTrattativaBadge(){
  const info = STATO_OPTIONS.find(s => s.key === trattativaStato) || STATO_OPTIONS[0];
  const badge = document.getElementById("trattativaBadge");
  const tab = document.querySelector('.panel-tab[data-panel="trattativa"]');
  badge.textContent = info.label;
  tab.classList.toggle("stato-offerta", trattativaStato === "offerta");
  tab.classList.toggle("stato-trattativa", trattativaStato === "trattativa");
}

function buildStatoPills(){
  const wrap = document.getElementById("statoPills");
  wrap.innerHTML = STATO_OPTIONS.map(s =>
    `<button type="button" class="status-pill${s.key === trattativaStato ? " active" : ""}" data-stato="${s.key}">${s.label}</button>`
  ).join("");
  wrap.querySelectorAll(".status-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      trattativaStato = btn.dataset.stato;
      wrap.querySelectorAll(".status-pill").forEach(b => b.classList.toggle("active", b.dataset.stato === trattativaStato));
      updateTrattativaBadge();
    });
  });
}
buildStatoPills();
updateTrattativaBadge();

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
    provincia: provinciaSel(),
    citta: document.getElementById("citta").value,
    descrizione: document.getElementById("descrizione").value,
    checklist: Object.assign({}, checklistState),
    pianoText: pianoText,
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
  if (document.getElementById("provincia")) document.getElementById("provincia").value = "MI";
  popolaComuni("MI", "Milano");
  selZonaProv = null;
  document.getElementById("ristrutturazioneMq").value = "680";
  document.getElementById("roiTarget").value = 30;
  document.getElementById("aliquotaImposte").value = 9;
  document.getElementById("aliquotaAgenzia").value = 4.88;
  document.getElementById("importBanner").style.display = "none";
  delete document.getElementById("prezzoMq").dataset.userEdited;
  formatAllGrouped();
  calcola();
  aggiornaZona();
  resetChecklistUI();
  trattativaStato = "valutazione";
  buildStatoPills();
  updateTrattativaBadge();
  document.getElementById("trattativaNote").value = "";
  setAllegato(null);
  showPanel("conto");
});

document.getElementById("btnShare").addEventListener("click", async () => {
  const c = calcola();
  const indirizzo = document.getElementById("indirizzo").value || "Immobile";
  const citta = document.getElementById("citta").value;
  const descrizione = document.getElementById("descrizione").value;
  const statoLbl = (STATO_OPTIONS.find(s => s.key === trattativaStato) || {}).label || "";
  const problemi = CHECKLIST_ITEMS.filter(i => optTone(i, checklistState[i.key]) === "warn").map(i => i.label);
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
    const problemi = countIssues(v.checklist);
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
      const provV = v.provincia || "MI";
      if (document.getElementById("provincia")) document.getElementById("provincia").value = provV;
      popolaComuni(provV, v.citta || "Milano");
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
      document.getElementById("ristrutturazioneMq").value = v.ristrutturazioneMq || "680";
      document.getElementById("aliquotaImposte").value = v.aliquotaImposte ?? 9;
      document.getElementById("aliquotaAgenzia").value = v.aliquotaAgenzia ?? 4.88;
      document.getElementById("roiTarget").value = v.roiTarget ?? 30;
      formatAllGrouped();
      calcola();
      aggiornaZona();
      applyChecklistState(v.checklist, v.pianoText);
      document.getElementById("checklistNote").value = v.checklistNote || "";
      trattativaStato = v.trattativaStato || "valutazione";
      buildStatoPills();
      updateTrattativaBadge();
      document.getElementById("trattativaNote").value = v.trattativaNote || "";
      setAllegato(v.allegato || null);
      showPanel("conto");
      setTab("new");
    });
  });
}


// ===== IMPORT DA IMMOBILIARE (parametri in URL passati dal bookmarklet) =====
function applyImportFromUrl(){
  const p = new URLSearchParams(location.search);
  const mqP = p.get("mq"), prezzoP = p.get("prezzo"), addrP = p.get("addr"), cittaP = p.get("citta");
  if (!mqP && !prezzoP && !addrP && !cittaP) return;
  const onlyDigits = s => (s || "").replace(/[^0-9]/g, "");

  if (addrP) document.getElementById("indirizzo").value = addrP.trim();
  if (cittaP) document.getElementById("citta").value = cittaP.trim();
  if (onlyDigits(mqP)) document.getElementById("mq").value = onlyDigits(mqP);
  if (onlyDigits(prezzoP)) document.getElementById("acquisto").value = onlyDigits(prezzoP);

  formatAllGrouped();
  aggiornaZona();   // trova la zona e, se non toccato a mano, precompila il prezzo di vendita
  calcola();

  const parts = [];
  if (onlyDigits(mqP)) parts.push(onlyDigits(mqP) + " mq");
  if (onlyDigits(prezzoP)) parts.push(groupInt(parseInt(onlyDigits(prezzoP), 10)) + " € richiesti");
  document.getElementById("importBannerTxt").textContent =
    "Importato da Immobiliare.it" + (parts.length ? ": " + parts.join(" · ") : "") + ". Controlla i valori.";
  document.getElementById("importBanner").style.display = "";

  setTab("new");
  showPanel("conto");
  history.replaceState({}, "", location.pathname);   // un refresh non re-importa
}
document.getElementById("importBannerX").addEventListener("click", () => {
  document.getElementById("importBanner").style.display = "none";
});


// ===== PULSANTE "MANDA A VISITE" (bookmarklet) =====
// Gira DENTRO la pagina di Immobiliare.it (dove i dati ci sono e non c'è blocco anti-bot):
// legge superficie/prezzo/indirizzo dai dati strutturati della pagina e riapre questo
// strumento con i valori in coda all'URL. __BASE__ viene sostituito con l'URL reale del tool.
const BOOKMARKLET_SRC = `(function(){var B="__BASE__";function d(x){return(""+x).replace(/[^0-9]/g,"");}var price=null,mq=null,addr=null,city=null;var L=document.querySelectorAll('script[type="application/ld+json"]');for(var i=0;i<L.length;i++){try{var j=JSON.parse(L[i].textContent);var ns=Array.isArray(j)?j:(j["@graph"]?j["@graph"]:[j]);for(var k=0;k<ns.length;k++){var n=ns[k];if(!n||typeof n!="object")continue;var of=n.offers;if(of){if(Array.isArray(of))of=of[0];var pv=of&&(of.price||(of.priceSpecification&&of.priceSpecification.price));if(pv&&!price)price=pv;}if(n.price&&!price)price=n.price;var fs=n.floorSize;if(fs){var fv=(typeof fs=="object")?(fs.value||fs["@value"]):fs;if(fv&&!mq)mq=fv;}if(n.address&&typeof n.address=="object"){if(n.address.streetAddress&&!addr)addr=n.address.streetAddress;if(n.address.addressLocality&&!city)city=n.address.addressLocality;}}}catch(e){}}var t=document.body?document.body.innerText:"";if(!price){var pm=t.match(/€\\s*([0-9][0-9.]{3,})/g);if(pm){for(var x=0;x<pm.length;x++){var pn=parseInt(pm[x].replace(/[^0-9]/g,""),10);if(pn>10000){price=pn;break;}}}}if(!mq){var sm=t.match(/([0-9]{1,4})\\s*m(?:²|q)(?![a-z])/ig);if(sm){var bm=0;for(var y=0;y<sm.length;y++){var sn=parseInt(sm[y].replace(/[^0-9]/g,""),10);if(sn>bm)bm=sn;}if(bm>0)mq=bm;}}price=price?d(price):"";mq=mq?d(mq):"";var Q=[];if(mq)Q.push("mq="+mq);if(price)Q.push("prezzo="+price);if(addr)Q.push("addr="+encodeURIComponent(addr));if(city)Q.push("citta="+encodeURIComponent(city));Q.push("src=imm");var u=B+"?"+Q.join("&");if(!mq&&!price)alert("Non ho trovato superficie e prezzo in questa pagina. Apro comunque lo strumento: inseriscili a mano.");var w=window.open(u,"_blank");if(!w)location.href=u;})();`;

function buildBookmarklet(){
  const base = location.origin + location.pathname;
  return "javascript:" + BOOKMARKLET_SRC.replace("__BASE__", () => base);
}

const bmModal = document.getElementById("bmModal");
document.getElementById("bmOpen").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("bmCode").value = buildBookmarklet();
  bmModal.classList.remove("hidden");
});
document.getElementById("bmClose").addEventListener("click", () => bmModal.classList.add("hidden"));
bmModal.addEventListener("click", (e) => { if (e.target === bmModal) bmModal.classList.add("hidden"); });
document.getElementById("bmCopy").addEventListener("click", async () => {
  const ta = document.getElementById("bmCode");
  ta.focus(); ta.select();
  let ok = false;
  try { await navigator.clipboard.writeText(ta.value); ok = true; }
  catch(e){ try { ok = document.execCommand("copy"); } catch(e2){} }
  const btn = document.getElementById("bmCopy");
  const orig = btn.textContent;
  btn.textContent = ok ? "Copiato ✓" : "Selezionato: ora tocca Copia";
  setTimeout(() => btn.textContent = orig, 1800);
});


// Import all'avvio se l'app è già sbloccata su questo dispositivo.
if (localStorage.getItem(UNLOCK_KEY) === "1") applyImportFromUrl();
