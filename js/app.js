/* ---------- Data model ---------- */
/* Config (FIREBASE_DB_URL, DB_PATH) comes from config/firebase.config.js,
   loaded as a separate <script> before this file in index.html. */
const STORAGE_KEY = 'inventory-items-v3';

function defaultItems(){
  const mk = (o) => {
    const base = Object.assign({
      id: o.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      critical:false, updatedAt:null, updatedBy:null, note:''
    }, o);
    if(base.parLevel === undefined) base.parLevel = base.min * 3;
    return base;
  };

  return [
    // Medical / Nutrition
    mk({name:'Fresubin Packs', category:'Medical / Nutrition', unitLabel:'packs',
        mode:'carton', cartonSize:6, packSize:4, packUnitLabel:'bottles',
        qty:10, min:12, parLevel:24, critical:true, note:'1 carton = 6 packs, 1 pack = 4 bottles. Restock as soon as it drops below 2 cartons. Target is 4 cartons on hand.'}),

    // Medical / Care
    mk({name:'Sensiva Wash Lotion', category:'Medical / Care', unitLabel:'bottles', mode:'simple', qty:2, min:2}),
    mk({name:'Desderman Hand Sanitiser', category:'Medical / Care', unitLabel:'bottles', mode:'simple', qty:8, min:3, critical:true}),
    mk({name:'FFP2 Masks', category:'Medical / Care', unitLabel:'masks', mode:'simple', qty:33, min:10, note:'Count individually'}),
    mk({name:'Disposable Gloves &ndash; MaiMed Solution 100 (Blue)', category:'Medical / Care', unitLabel:'packs', mode:'packs-only', qty:4, min:10, critical:true,
        note:'100 gloves per box = 1 pack. Tracked by pack only. Below 10 packs is an automatic restock flag.'}),

    // Personal Care
    mk({name:'Toothbrush &ndash; Dr. Best Original (Mittel)', category:'Personal Care', unitLabel:'packs', mode:'packs-fixed', packSize:3, packUnitLabel:'toothbrushes', qty:1, min:1, note:'2+1 Gratis box, so 3 toothbrushes per pack'}),

    // Cleaning
    mk({name:'Denkmit Colorwaschmittel Ultra Sensitive', category:'Cleaning', unitLabel:'bottles', mode:'simple', qty:1, min:1, note:'dm brand, fragrance and dye free'}),

    // Household
    mk({name:'Sea Salt', category:'Household', unitLabel:'packs', mode:'simple', qty:3, min:2}),
    mk({name:'Dishwasher Tablets &ndash; eco Freude Geschirr-Reiniger Tabs (All-in-One)', category:'Household', unitLabel:'boxes', mode:'simple', qty:2, min:1, note:'30 tabs per box. This was listed twice in the old spreadsheet (once as &quot;Eco Freude Tabs&quot; under Cleaning, once as &quot;Dishwasher Tablets&quot; under Household). They looked like the same product, so I combined them into one item here. Please flag if these were actually two different things.'}),
    mk({name:'Freezer &amp; Storage Bags &ndash; Rubin EasyZip Allzweckbeutel (1L)', category:'Household', unitLabel:'boxes', mode:'simple', qty:1, min:1, note:'15 zip bags per box, from Rossmann. New item, not on the original list.'}),

    // Water
    mk({name:'Volvic Water', category:'Water', unitLabel:'bottles', mode:'water-pack', packSize:6, qty:32, min:18, parLevel:24, critical:true, note:'1 pack = 6 bottles. She drinks up to 6 bottles a day, so restock as soon as it drops below 3 packs. Target is 4 packs on hand.'}),

    // Paper / Hygiene
    mk({name:'Toilet Roll &ndash; Michala (Danke, 100% Recycled)', category:'Paper / Hygiene', unitLabel:'rolls', mode:'simple', qty:5, min:4, critical:true, note:'Danke brand, 100% recycled paper, unbleached, 4 rolls per pack. This is the one Michala uses specifically.'}),
    mk({name:'Toilet Roll &ndash; PA', category:'Paper / Hygiene', unitLabel:'rolls', mode:'simple', qty:4, min:4, critical:true, note:'Any brand is fine for PA use'}),
    mk({name:'Kitchen Roll', category:'Paper / Hygiene', unitLabel:'packs', mode:'simple', qty:5, min:3, note:'Shared stock, 3 rolls per pack'}),
    mk({name:'Hand Tissues', category:'Paper / Hygiene', unitLabel:'packs', mode:'simple', qty:12, min:4}),
    mk({name:'Kitchen Towels', category:'Paper / Hygiene', unitLabel:'pieces', mode:'simple', qty:8, min:10}),

    // Bin Bags
    mk({name:'Blue Bin Bags', category:'Bin Bags', unitLabel:'packs', mode:'simple', qty:8, min:2}),
    mk({name:'White Bin Bags &ndash; Gut &amp; G&uuml;nstig M&uuml;llbeutel (35L)', category:'Bin Bags', unitLabel:'packs', mode:'simple', qty:5, min:2, note:'ASSUMED this is the White Bin Bags from your photo (35 litres, 35 bags per roll). I could not tell the bag colour from the packaging. Please correct the name here if this is actually your Blue Bin Bags, or a size not tracked before.'}),
    mk({name:'Black Bin Bags (large)', category:'Bin Bags', unitLabel:'packs', mode:'simple', qty:2, min:2}),
  ];
}

const CATEGORY_ORDER = ['Medical / Nutrition','Medical / Care','Personal Care','Cleaning','Household','Water','Paper / Hygiene','Bin Bags'];

let items = [];
let activeCategory = 'All';
let currentName = null;

/* ---------- Storage helpers (self-hosted, no Claude dependency) ---------- */
async function loadItems(){
  try{
    const res = await fetch(FIREBASE_DB_URL + '/' + DB_PATH + '.json');
    if(!res.ok) throw new Error('Database request failed: ' + res.status);
    const data = await res.json();
    if(data){
      const result = patchKnownItems(data);
      items = result.items;
      if(result.changed) await saveItems();
      return;
    }
  }catch(e){
    console.error('Could not load inventory', e);
  }
  items = defaultItems();
  await saveItems();
}

/* Items that used to be tracked but are no longer needed. Listed here (rather than just
   removed from defaultItems) so that copies already saved in the shared database get
   cleaned up too, not just new ones prevented. */
const DISCONTINUED_IDS = [
  'sterile-water-ndash-aqua-b-braun',
  'universal-reiniger',
  'badreiniger',
  'wc-reiniger'
];

/* Keep already-saved items in sync with the latest known product details (names, restock
   targets, categories) without ever touching quantities PAs have already entered. Also adds
   any brand-new default items that were not in the saved list yet, and removes any
   discontinued items that are no longer wanted. */
function patchKnownItems(loadedItems){
  const defaults = defaultItems();
  const byId = {};
  defaults.forEach(d => byId[d.id] = d);
  let changed = false;

  let result = loadedItems.filter(it => {
    if(DISCONTINUED_IDS.includes(it.id)){
      changed = true;
      return false;
    }
    return true;
  });

  result.forEach(it => {
    const d = byId[it.id];
    if(!d) return;
    ['name','category','unitLabel','mode','cartonSize','packSize','packUnitLabel','min','parLevel','critical','note'].forEach(field => {
      if(d[field] !== undefined && JSON.stringify(it[field]) !== JSON.stringify(d[field])){
        it[field] = d[field];
        changed = true;
      }
    });
  });

  const existingIds = new Set(result.map(i => i.id));
  defaults.forEach(d => {
    if(!existingIds.has(d.id)){
      result.push(d);
      changed = true;
    }
  });

  return {items: result, changed};
}

async function saveItems(){
  const maxAttempts = 3;
  for(let attempt = 1; attempt <= maxAttempts; attempt++){
    try{
      const res = await fetch(FIREBASE_DB_URL + '/' + DB_PATH + '.json', {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(items)
      });
      if(!res.ok) throw new Error('Database write failed: ' + res.status);
      return;
    }catch(e){
      console.error('Could not save inventory (attempt ' + attempt + ')', e);
      if(attempt < maxAttempts){
        await new Promise(r => setTimeout(r, 600 * attempt));
      } else {
        alert('Could not save just now. Please check your connection and try again.');
      }
    }
  }
}

/* ---------- Status logic ---------- */
function statusOf(item){
  if(item.qty <= 0) return 'out';
  if(item.qty <= item.min) return 'low';
  return 'ok';
}
function statusLabel(s){
  return s === 'out' ? 'Out of stock' : s === 'low' ? 'Running low' : 'OK';
}

/* ---------- Rendering: Inventory tab ---------- */
function renderChips(){
  const cats = ['All', ...CATEGORY_ORDER.filter(c => items.some(i => i.category === c))];
  const row = document.getElementById('chipRow');
  row.innerHTML = '';
  cats.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (activeCategory === cat ? ' active' : '');
    chip.textContent = cat;
    chip.onclick = () => { activeCategory = cat; renderChips(); renderList(); };
    row.appendChild(chip);
  });
}

function qtyDisplay(item){
  if(item.mode === 'carton'){
    const cartons = Math.floor(item.qty / item.cartonSize);
    const loosePacks = item.qty % item.cartonSize;
    let parts = [];
    if(cartons > 0) parts.push(cartons + (cartons===1?' carton':' cartons'));
    parts.push(loosePacks + ' ' + (loosePacks===1 ? item.unitLabel.replace(/s$/,'') : item.unitLabel) + (loosePacks===1?'':''));
    return {main: item.qty + ' ' + item.unitLabel, sub: parts.join(' + ') + ' &middot; ' + (item.qty*item.packSize) + ' ' + item.packUnitLabel + ' total'};
  }
  if(item.mode === 'water-pack'){
    const packs = Math.floor(item.qty / item.packSize);
    const loose = item.qty % item.packSize;
    return {main: item.qty + ' bottles', sub: packs + ' full packs' + (loose>0 ? ' + ' + loose + ' loose bottle'+(loose===1?'':'s') : '')};
  }
  if(item.mode === 'packs-fixed'){
    return {main: item.qty + ' ' + item.unitLabel, sub: (item.qty*item.packSize) + ' ' + item.packUnitLabel + ' total'};
  }
  return {main: item.qty + ' ' + item.unitLabel, sub: ''};
}


function timeAgo(ts){
  if(!ts) return 'not yet logged';
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs/60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins/60);
  if(hrs < 24) return hrs + 'h ago';
  const days = Math.round(hrs/24);
  return days + 'd ago';
}

function renderList(){
  const wrap = document.getElementById('listWrap');
  wrap.innerHTML = '';
  const filtered = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);
  if(filtered.length === 0){
    wrap.innerHTML = '<div class="empty-wrap">No items in this category yet.</div>';
    return;
  }

  let lastCat = null;
  const grouped = activeCategory === 'All';
  const ordered = grouped
    ? [...filtered].sort((a,b)=> CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    : filtered;

  ordered.forEach(item => {
    if(grouped && item.category !== lastCat){
      const h = document.createElement('div');
      h.className = 'cat-heading';
      h.textContent = item.category;
      wrap.appendChild(h);
      lastCat = item.category;
    }
    const s = statusOf(item);
    const pct = item.min > 0 ? Math.min(100, Math.round((item.qty/(item.min*2))*100)) : (item.qty>0?100:0);
    const q = qtyDisplay(item);

    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = () => openSheet(item.name);
    card.innerHTML = `
      <div class="card-top">
        <div class="card-name">${item.name}${item.critical ? '<span class="flag">&#9679; daily</span>' : ''}</div>
        <div class="pill ${s}">${statusLabel(s)}</div>
      </div>
      <div class="gauge-track"><div class="gauge-fill ${s}" style="width:${pct}%"></div></div>
      <div class="card-bottom">
        <div>
          <div class="qty-text">${q.main}</div>
          ${q.sub ? `<div class="qty-sub">${q.sub}</div>` : ''}
        </div>
        <div class="updated-text">${timeAgo(item.updatedAt)}</div>
      </div>
    `;
    wrap.appendChild(card);
  });
}

/* ---------- Update sheet ---------- */
function openSheet(name){
  currentName = name;
  const item = items.find(i => i.name === name);
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');

  let fieldsHtml = '';
  if(item.mode === 'carton'){
    const cartons = Math.floor(item.qty / item.cartonSize);
    const loosePacks = item.qty % item.cartonSize;
    fieldsHtml = `
      <div class="helper-note">1 carton = ${item.cartonSize} packs &middot; 1 pack = ${item.packSize} ${item.packUnitLabel}</div>
      <div class="field-row">
        <div class="field"><label>Full cartons</label><input type="number" id="inCarton" min="0" value="${cartons}"></div>
        <div class="field"><label>Loose packs</label><input type="number" id="inLoosePack" min="0" value="${loosePacks}"></div>
      </div>
    `;
  } else if(item.mode === 'water-pack'){
    const packs = Math.floor(item.qty / item.packSize);
    const loose = item.qty % item.packSize;
    fieldsHtml = `
      <div class="helper-note">1 pack = ${item.packSize} bottles</div>
      <div class="field-row">
        <div class="field"><label>Full packs</label><input type="number" id="inPack" min="0" value="${packs}"></div>
        <div class="field"><label>Loose bottles</label><input type="number" id="inLoose" min="0" value="${loose}"></div>
      </div>
    `;
  } else if(item.mode === 'packs-fixed'){
    fieldsHtml = `
      <div class="helper-note">1 pack = ${item.packSize} ${item.packUnitLabel}</div>
      <div class="field-row">
        <div class="field"><label>Packs available</label><input type="number" id="inSimple" min="0" value="${item.qty}"></div>
      </div>
    `;
  } else if(item.mode === 'packs-only'){
    fieldsHtml = `
      <div class="helper-note">${item.note || 'Tracked by pack only.'}</div>
      <div class="field-row">
        <div class="field"><label>Packs available</label><input type="number" id="inSimple" min="0" value="${item.qty}"></div>
      </div>
    `;
  } else {
    fieldsHtml = `
      <div class="field-row">
        <div class="field"><label>${item.unitLabel.charAt(0).toUpperCase()+item.unitLabel.slice(1)} available</label><input type="number" id="inSimple" min="0" value="${item.qty}"></div>
      </div>
    `;
  }

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>${item.name}</h3>
    <div class="sheet-sub">${item.category}${item.note && item.mode==='simple' ? ' &middot; ' + item.note : ''}</div>
    ${fieldsHtml}
    <div class="min-row">
      <label>Restock at or below</label>
      <input type="number" id="inMin" min="0" value="${item.min}">
      <span style="font-size:12px;color:var(--ink-soft)">${item.mode==='carton'?'packs':(item.mode==='water-pack'?'bottles':item.unitLabel)}</span>
    </div>
    <div class="sheet-actions">
      <button class="btn secondary" id="btnCancel">Cancel</button>
      <button class="btn primary" id="btnSave">Save update</button>
    </div>
  `;
  overlay.classList.add('show');
  document.getElementById('btnCancel').onclick = closeSheet;
  overlay.onclick = (e) => { if(e.target === overlay) closeSheet(); };
  document.getElementById('btnSave').onclick = () => saveSheet(name);
}

function closeSheet(){
  document.getElementById('overlay').classList.remove('show');
  currentName = null;
}

async function saveSheet(name){
  const item = items.find(i => i.name === name);
  let newQty = item.qty;

  if(item.mode === 'carton'){
    const cartons = parseInt(document.getElementById('inCarton').value) || 0;
    const loosePacks = parseInt(document.getElementById('inLoosePack').value) || 0;
    newQty = cartons * item.cartonSize + loosePacks;
  } else if(item.mode === 'water-pack'){
    const packs = parseInt(document.getElementById('inPack').value) || 0;
    const loose = parseInt(document.getElementById('inLoose').value) || 0;
    newQty = packs * item.packSize + loose;
  } else {
    newQty = parseInt(document.getElementById('inSimple').value) || 0;
  }
  const newMin = parseInt(document.getElementById('inMin').value);
  if(!isNaN(newMin)) item.min = newMin;

  item.qty = newQty;
  item.updatedAt = Date.now();
  item.updatedBy = getWho();

  await saveItems();
  closeSheet();
  renderList();
  if(document.getElementById('summaryView').style.display !== 'none') renderSummary();
}

/* ---------- Who is updating (session only) ---------- */
let whoName = '';
function getWho(){ return whoName || 'A carer'; }
function askWho(){
  const val = prompt('Your first name, so we know who logged this update:', whoName);
  if(val && val.trim()){
    whoName = val.trim();
    document.getElementById('whoChip').textContent = 'Signed in as: ' + whoName;
  }
}

/* ---------- Summary tab ---------- */
function renderSummary(){
  const wrap = document.getElementById('summaryWrap');
  const out = items.filter(i => statusOf(i) === 'out');
  const urgent = items.filter(i => statusOf(i) === 'low' && i.critical);
  const low = items.filter(i => statusOf(i) === 'low' && !i.critical);
  const okCount = items.length - out.length - urgent.length - low.length;

  const dateStr = new Date().toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'});

  function renderSectionItems(list){
    return list.map(i => {
      const q = qtyDisplay(i);
      return `<div class="sum-item">
        <div>
          <div class="name">${i.name}</div>
          <div class="detail">${q.main}${q.sub ? ' &middot; ' + q.sub : ''} &middot; restock at ${i.min}</div>
        </div>
      </div>`;
    }).join('');
  }

  let html = `
    <div class="summary-head">
      <h2 style="margin:0 0 2px;font-size:20px;">Today's Report</h2>
      <div class="date">${dateStr}</div>
    </div>
  `;

  if(out.length){
    html += `
      <div class="sum-section">
        <div class="sum-section-title" style="color:var(--urgent);">
          &#9940; Out of stock <span class="sum-count" style="background:var(--urgent-soft);color:var(--urgent);">${out.length}</span>
        </div>
        <div class="sum-list">${renderSectionItems(out)}</div>
      </div>
    `;
  }
  if(urgent.length){
    html += `
      <div class="sum-section">
        <div class="sum-section-title" style="color:var(--urgent);">
          &#9888; Urgent, used every day <span class="sum-count" style="background:var(--urgent-soft);color:var(--urgent);">${urgent.length}</span>
        </div>
        <div class="sum-list">${renderSectionItems(urgent)}</div>
      </div>
    `;
  }
  if(low.length){
    html += `
      <div class="sum-section">
        <div class="sum-section-title" style="color:var(--low);">
          &#9679; Running low <span class="sum-count" style="background:var(--low-soft);color:var(--low);">${low.length}</span>
        </div>
        <div class="sum-list">${renderSectionItems(low)}</div>
      </div>
    `;
  }
  if(!out.length && !urgent.length && !low.length){
    html += `<div class="ok-banner">Everything is stocked. Nothing needs buying today.</div>`;
  } else {
    html += `<div style="font-size:12.5px;color:var(--ink-soft);margin:2px 2px 14px;">${okCount} other item${okCount===1?'':'s'} still fine.</div>`;
    html += `
      <div class="export-row">
        <button class="copy-btn" id="copyListBtn">&#128203; Copy list</button>
      </div>
    `;
  }

  wrap.innerHTML = html;

  function decodeHtml(str){
    const el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  }

  function buildSections(){
    const line = (i) => decodeHtml(i.name) + '  (' + qtyDisplay(i).main + ' left)';
    return [
      {title:'OUT OF STOCK', items: out.map(line)},
      {title:'URGENT, used every day', items: urgent.map(line)},
      {title:'Running low', items: low.map(line)}
    ].filter(s => s.items.length);
  }

  function buildShoppingListText(){
    const lines = ['Shopping list \u2013 Michala\'s home supplies', dateStr, ''];
    buildSections().forEach(sec => {
      lines.push(sec.title + ':');
      sec.items.forEach(line => lines.push('- ' + line));
      lines.push('');
    });
    return lines.join('\n');
  }

  function showToast(msg){
    const toast = document.getElementById('copyToast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function fallbackCopy(text){
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try{ ok = document.execCommand('copy'); }catch(e){ ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function showManualCopySheet(text){
    const overlay = document.getElementById('overlay');
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <h3>Copy this list</h3>
      <div class="sheet-sub">Your phone would not let me copy this automatically. Tap inside the box below, select all, then copy.</div>
      <textarea id="manualCopyArea" style="width:100%;min-height:220px;padding:12px;border-radius:12px;border:1.5px solid var(--border);font-size:16px;font-family:inherit;background:var(--surface-2);color:var(--ink);">${text}</textarea>
      <div class="sheet-actions">
        <button class="btn primary" id="btnCloseManual">Done</button>
      </div>
    `;
    overlay.classList.add('show');
    const area = document.getElementById('manualCopyArea');
    area.focus();
    area.select();
    document.getElementById('btnCloseManual').onclick = closeSheet;
    overlay.onclick = (e) => { if(e.target === overlay) closeSheet(); };
  }

  const copyBtn = document.getElementById('copyListBtn');
  if(copyBtn){
    copyBtn.onclick = async () => {
      const text = buildShoppingListText();
      let success = false;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(text);
          success = true;
        }
      }catch(e){ success = false; }
      if(!success){ success = fallbackCopy(text); }
      if(success){
        showToast('Shopping list copied');
      } else {
        showManualCopySheet(text);
      }
    };
  }
}


/* ---------- Add new item ---------- */
function openAddSheet(){
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <h3>Add a new item</h3>
    <div class="sheet-sub">It will appear in the inventory straight away</div>
    <div class="field-row">
      <div class="field"><label>Item name</label><input type="text" id="newName" placeholder="e.g. Cotton Wool"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Category</label><input type="text" id="newCategory" placeholder="e.g. Medical / Care"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Unit (e.g. packs, bottles)</label><input type="text" id="newUnit" placeholder="packs"></div>
      <div class="field"><label>Current qty</label><input type="number" id="newQty" min="0" value="0"></div>
    </div>
    <div class="min-row">
      <label>Restock at or below</label>
      <input type="number" id="newMin" min="0" value="1">
    </div>
    <div class="sheet-actions">
      <button class="btn secondary" id="btnCancelAdd">Cancel</button>
      <button class="btn primary" id="btnSaveAdd">Add item</button>
    </div>
  `;
  overlay.classList.add('show');
  document.getElementById('btnCancelAdd').onclick = closeSheet;
  overlay.onclick = (e) => { if(e.target === overlay) closeSheet(); };
  document.getElementById('btnSaveAdd').onclick = async () => {
    const name = document.getElementById('newName').value.trim();
    const category = document.getElementById('newCategory').value.trim() || 'Other';
    const unit = document.getElementById('newUnit').value.trim() || 'pieces';
    const qty = parseInt(document.getElementById('newQty').value) || 0;
    const min = parseInt(document.getElementById('newMin').value) || 0;
    if(!name){ alert('Please give the item a name.'); return; }
    items.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      name, category, unitLabel: unit, mode:'simple',
      qty, min, critical:false, note:'', updatedAt: Date.now(), updatedBy: getWho()
    });
    await saveItems();
    closeSheet();
    renderChips();
    renderList();
  };
}

/* ---------- Tabs ---------- */
async function switchTab(tab){
  document.querySelectorAll('.maintab, .navbtn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.getElementById('inventoryView').style.display = tab === 'inventory' ? 'block' : 'none';
  document.getElementById('summaryView').style.display = tab === 'summary' ? 'block' : 'none';
  document.getElementById('addFab').style.display = tab === 'inventory' ? 'flex' : 'none';

  await loadItems();
  renderChips();
  renderList();
  if(tab === 'summary') renderSummary();
}

/* ---------- Init ---------- */
async function init(){
  await loadItems();
  renderChips();
  renderList();

  document.querySelectorAll('.maintab, .navbtn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  document.getElementById('whoChip').addEventListener('click', askWho);
  document.getElementById('addFab').addEventListener('click', openAddSheet);

  startBackgroundSync();
}

/* Quietly checks for updates from other PAs every so often, so a PA who already has the
   page open still sees fresh numbers without needing to tap anything. Skips refreshing
   while someone is actively typing in a sheet, so it never interrupts an update in progress. */
function startBackgroundSync(){
  setInterval(async () => {
    const overlayOpen = document.getElementById('overlay').classList.contains('show');
    if(overlayOpen) return;
    const before = JSON.stringify(items);
    await loadItems();
    const after = JSON.stringify(items);
    if(before !== after){
      renderChips();
      renderList();
      if(document.getElementById('summaryView').style.display !== 'none') renderSummary();
    }
  }, 15000);
}

init();
