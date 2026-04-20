// ========== 가계부 앱 메인 로직 ==========

// ---- IndexedDB 래퍼 ----
const DB_NAME = 'ledger_db';
const DB_VER = 1;
let db;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e=>{
      const d = e.target.result;
      if(!d.objectStoreNames.contains('records')){
        const s = d.createObjectStore('records',{keyPath:'id',autoIncrement:true});
        s.createIndex('date','date');
        s.createIndex('instId','instId');
      }
      if(!d.objectStoreNames.contains('categories')) d.createObjectStore('categories',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('assets')) d.createObjectStore('assets',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('keywords')) d.createObjectStore('keywords',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('fixed')) d.createObjectStore('fixed',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('favorites')) d.createObjectStore('favorites',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('photos')) d.createObjectStore('photos',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess = e=>{db = e.target.result; resolve(db);};
    req.onerror = e=>reject(e);
  });
}

function tx(store, mode='readonly'){return db.transaction(store,mode).objectStore(store);}
function prom(req){return new Promise((r,j)=>{req.onsuccess=()=>r(req.result); req.onerror=()=>j(req.error);});}

async function dbAll(store){return prom(tx(store).getAll());}
async function dbGet(store,key){return prom(tx(store).get(key));}
async function dbAdd(store,obj){return prom(tx(store,'readwrite').add(obj));}
async function dbPut(store,obj){return prom(tx(store,'readwrite').put(obj));}
async function dbDel(store,key){return prom(tx(store,'readwrite').delete(key));}
async function dbClear(store){return prom(tx(store,'readwrite').clear());}

async function setSetting(key,value){return dbPut('settings',{key,value});}
async function getSetting(key,def=null){const r = await dbGet('settings',key); return r ? r.value : def;}

// ---- 초기 데이터 ----
const DEFAULT_CATEGORIES = [
  {name:'식비',color:'#ff6b4a',icon:'🍚',type:'expense'},
  {name:'카페/간식',color:'#b47342',icon:'☕',type:'expense'},
  {name:'교통',color:'#4a90e2',icon:'🚌',type:'expense'},
  {name:'쇼핑',color:'#e85a9b',icon:'🛍️',type:'expense'},
  {name:'문화/여가',color:'#9b59d0',icon:'🎬',type:'expense'},
  {name:'주거/공과금',color:'#5d7285',icon:'🏠',type:'expense'},
  {name:'의료',color:'#2bb673',icon:'💊',type:'expense'},
  {name:'교육',color:'#f5a623',icon:'📚',type:'expense'},
  {name:'기타',color:'#8e8e93',icon:'📌',type:'expense'},
  {name:'월급',color:'#34c759',icon:'💰',type:'income'},
  {name:'부수입',color:'#30bfa8',icon:'💵',type:'income'},
];

const DEFAULT_ASSETS = [
  {name:'현금',icon:'💵'},
  {name:'체크카드',icon:'💳'},
  {name:'신용카드',icon:'💳'},
  {name:'계좌이체',icon:'🏦'},
];

const DEFAULT_KEYWORDS = [
  {keyword:'스타벅스',categoryName:'카페/간식'},
  {keyword:'스벅',categoryName:'카페/간식'},
  {keyword:'투썸',categoryName:'카페/간식'},
  {keyword:'메가커피',categoryName:'카페/간식'},
  {keyword:'이디야',categoryName:'카페/간식'},
  {keyword:'컴포즈',categoryName:'카페/간식'},
  {keyword:'커피',categoryName:'카페/간식'},
  {keyword:'버스',categoryName:'교통'},
  {keyword:'지하철',categoryName:'교통'},
  {keyword:'택시',categoryName:'교통'},
  {keyword:'카카오T',categoryName:'교통'},
  {keyword:'기차',categoryName:'교통'},
  {keyword:'KTX',categoryName:'교통'},
  {keyword:'SRT',categoryName:'교통'},
  {keyword:'주유',categoryName:'교통'},
  {keyword:'점심',categoryName:'식비'},
  {keyword:'저녁',categoryName:'식비'},
  {keyword:'아침',categoryName:'식비'},
  {keyword:'배달',categoryName:'식비'},
  {keyword:'배민',categoryName:'식비'},
  {keyword:'쿠팡이츠',categoryName:'식비'},
  {keyword:'마트',categoryName:'식비'},
  {keyword:'편의점',categoryName:'식비'},
  {keyword:'GS25',categoryName:'식비'},
  {keyword:'CU',categoryName:'식비'},
  {keyword:'세븐일레븐',categoryName:'식비'},
  {keyword:'치킨',categoryName:'식비'},
  {keyword:'피자',categoryName:'식비'},
  {keyword:'쿠팡',categoryName:'쇼핑'},
  {keyword:'올리브영',categoryName:'쇼핑'},
  {keyword:'무신사',categoryName:'쇼핑'},
  {keyword:'영화',categoryName:'문화/여가'},
  {keyword:'CGV',categoryName:'문화/여가'},
  {keyword:'메가박스',categoryName:'문화/여가'},
  {keyword:'롯데시네마',categoryName:'문화/여가'},
  {keyword:'넷플릭스',categoryName:'문화/여가'},
  {keyword:'유튜브',categoryName:'문화/여가'},
  {keyword:'월세',categoryName:'주거/공과금'},
  {keyword:'전기',categoryName:'주거/공과금'},
  {keyword:'가스',categoryName:'주거/공과금'},
  {keyword:'통신비',categoryName:'주거/공과금'},
  {keyword:'병원',categoryName:'의료'},
  {keyword:'약국',categoryName:'의료'},
];

async function firstRunSeed(){
  const seeded = await getSetting('seeded', false);
  if(seeded) return;

  for(const c of DEFAULT_CATEGORIES) await dbAdd('categories', c);
  for(const a of DEFAULT_ASSETS) await dbAdd('assets', a);

  const cats = await dbAll('categories');
  const catByName = {};
  cats.forEach(c=>catByName[c.name]=c.id);
  for(const k of DEFAULT_KEYWORDS){
    await dbAdd('keywords', {keyword:k.keyword, categoryId:catByName[k.categoryName]});
  }

  await setSetting('seeded', true);
}

// ---- 상태 ----
const state = {
  type: 'expense',
  selectedCategoryId: null,
  selectedAssetId: null,
  categories: [],
  assets: [],
  keywords: [],
  records: [],
  favorites: [],
  fixed: [],
  pendingPhotoBlob: null,
  currentDate: new Date(),
  period: 'month',
  currentView: 'calendar',
  donutChart: null,
  barChart: null,
  // 달력용
  calDate: new Date(),
  calMode: 'month',
  calSelectedDate: toISOFromDate(new Date()),
  // 편집 중인 기록 ID
  editingId: null,
};
function toISOFromDate(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

async function reloadAll(){
  state.categories = await dbAll('categories');
  state.assets = await dbAll('assets');
  state.keywords = await dbAll('keywords');
  state.records = await dbAll('records');
  state.favorites = await dbAll('favorites');
  state.fixed = await dbAll('fixed');
}

function findCat(id){return state.categories.find(c=>c.id===id);}
function findAsset(id){return state.assets.find(a=>a.id===id);}

// ---- 유틸 ----
const fmt = n => {
  n = Math.round(n||0);
  const sign = n<0?'-':'';
  n = Math.abs(n);
  return sign + n.toLocaleString('ko-KR') + '원';
};
const fmtShort = n => {
  n = Math.round(n||0);
  if(n>=100000000) return (n/100000000).toFixed(1).replace(/\.0$/,'')+'억';
  if(n>=10000) return (n/10000).toFixed(1).replace(/\.0$/,'')+'만';
  return n.toLocaleString('ko-KR');
};
const toISO = d => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const parseISO = s => {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y,m-1,d);
};

// ---- 자동 카테고리 감지 ----
function detectCategory(memo){
  if(!memo) return null;
  const lower = memo.toLowerCase();
  // 가장 긴 키워드 우선 매칭
  const sorted = [...state.keywords].sort((a,b)=>b.keyword.length-a.keyword.length);
  for(const kw of sorted){
    if(lower.includes(kw.keyword.toLowerCase())){
      return state.categories.find(c=>c.id===kw.categoryId);
    }
  }
  return null;
}

// 금액 함께 적힌 경우 추출: "스타벅스 4500" → memo:스타벅스, amount:4500
function extractAmount(text){
  const m = text.match(/^(.+?)\s+(\d[\d,]*)\s*원?$/);
  if(m){
    return {memo: m[1].trim(), amount: parseInt(m[2].replace(/,/g,''),10)};
  }
  return null;
}

// ---- 렌더링 ----
function renderToday(){
  const now = new Date();
  const days = ['일','월','화','수','목','금','토'];
  document.getElementById('today-date').textContent = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${days[now.getDay()]})`;
  const today = toISO(now);
  const sum = state.records.filter(r=>r.date===today && r.type==='expense').reduce((s,r)=>s+r.amount,0);
  document.getElementById('today-expense').textContent = fmt(sum);
}

function renderCategorySelect(){
  const el = document.getElementById('sb-cat-value');
  const btn = document.getElementById('select-category');
  const card = document.getElementById('input-card');
  const cat = findCat(state.selectedCategoryId);
  if(cat && cat.type===state.type){
    el.innerHTML = `<span class="sb-dot" style="background:${cat.color};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;vertical-align:middle"></span>${cat.icon||''} ${cat.name}`;
    el.classList.remove('empty');
    btn.style.setProperty('--cat-color', cat.color);
    card.style.setProperty('--cat-color', cat.color);
  }else{
    el.textContent = '선택하세요';
    el.classList.add('empty');
    // 현재 타입에 맞는 첫번째 카테고리 자동 선택
    const firstCat = state.categories.find(c=>c.type===state.type);
    if(firstCat){
      state.selectedCategoryId = firstCat.id;
      renderCategorySelect();
    }
  }
}

function renderAssetSelect(){
  const el = document.getElementById('sb-asset-value');
  const asset = findAsset(state.selectedAssetId);
  if(asset){
    el.textContent = `${asset.icon||''} ${asset.name}`;
    el.classList.remove('empty');
  }else{
    el.textContent = '선택하세요';
    el.classList.add('empty');
  }
}

function updateInputCardColor(){
  const card = document.getElementById('input-card');
  const cat = findCat(state.selectedCategoryId);
  if(cat){
    card.style.setProperty('--cat-color', cat.color);
    card.classList.add('cat-flash');
  }else{
    card.classList.remove('cat-flash');
  }
}

function renderDetectedCategory(cat){
  const el = document.getElementById('detected-category');
  if(cat){
    el.innerHTML = `<span class="d-dot" style="background:${cat.color}"></span>자동 인식: ${cat.icon||''} ${cat.name}`;
    el.classList.add('show');
  }else{
    el.innerHTML = '';
    el.classList.remove('show');
  }
}

function renderFavorites(){
  const wrap = document.getElementById('quick-favorites');
  const emptyEl = document.getElementById('fav-empty');
  const sideEl = document.getElementById('fav-side');
  if(!state.favorites.length){
    wrap.innerHTML = '';
    if(emptyEl) emptyEl.style.display = 'block';
    if(sideEl) sideEl.textContent = '';
    return;
  }
  if(emptyEl) emptyEl.style.display = 'none';
  if(sideEl) sideEl.textContent = `${state.favorites.length}개`;
  wrap.innerHTML = state.favorites.map(f=>{
    const cat = findCat(f.categoryId);
    return `<button class="fav-chip" data-fav-id="${f.id}">
      <span class="fav-dot" style="background:${cat?cat.color:'#ccc'}"></span>
      ${f.memo}
      <span class="fav-amt">${fmtShort(f.amount)}원</span>
    </button>`;
  }).join('');
  wrap.querySelectorAll('.fav-chip').forEach(el=>{
    el.onclick = ()=>oneTouchRecord(parseInt(el.dataset.favId));
  });
}

async function renderRecent(){
  const wrap = document.getElementById('recent-items');
  const sideEl = document.getElementById('recent-side');
  const items = [...state.records].sort((a,b)=>{
    if(a.date!==b.date) return a.date<b.date?1:-1;
    return (b.createdAt||0)-(a.createdAt||0);
  }).slice(0,10);
  if(sideEl) sideEl.textContent = state.records.length ? `전체 ${state.records.length}건` : '';
  if(!items.length){
    wrap.innerHTML = '<div class="empty">아직 기록이 없어요</div>';
    return;
  }
  wrap.innerHTML = items.map(r=>{
    const cat = findCat(r.categoryId);
    const asset = findAsset(r.assetId);
    const ico = cat?.icon || (r.type==='income'?'💵':'📌');
    const iconStyle = cat ? `background:${cat.color}15;border-color:${cat.color}35` : '';
    return `<div class="item-row" data-rec-id="${r.id}">
      <div class="item-icon" style="${iconStyle}">${ico}</div>
      <div class="item-body">
        <div class="item-memo">${r.memo||(cat?cat.name:'기록')} ${r.photoId?'📷':''}</div>
        <div class="item-meta">
          <span>${cat?cat.name:''}</span>
          ${asset?`<span>· ${asset.name}</span>`:''}
          ${r.instId?`<span class="inst-tag">할부 ${r.instCurrent}/${r.instTotal}</span>`:''}
          <span>· ${r.date.slice(5).replace('-','/')}</span>
        </div>
      </div>
      <div class="item-amt ${r.type}">${r.type==='expense'?'-':'+'}${fmt(r.amount)}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.item-row').forEach(el=>{
    el.onclick = ()=>openRecordDialog(parseInt(el.dataset.recId));
  });
}

// ---- 기록 저장 ----
async function saveRecord(){
  const memoRaw = document.getElementById('memo-input').value.trim();
  let memo = memoRaw;
  let amount = parseInt(document.getElementById('amount-input').value||0,10);

  // "메모 + 금액" 한 줄 파싱
  if(!amount){
    const ex = extractAmount(memoRaw);
    if(ex){memo = ex.memo; amount = ex.amount;}
  }

  if(!amount){
    alert('금액을 입력해주세요');
    return;
  }
  if(!state.selectedCategoryId){
    alert('카테고리를 선택해주세요');
    return;
  }

  const instChecked = document.getElementById('inst-check').checked;
  const instMonths = parseInt(document.getElementById('inst-months').value||0,10);

  // 사진 저장
  let photoId = null;
  if(state.pendingPhotoBlob){
    photoId = await dbAdd('photos', {blob: state.pendingPhotoBlob});
  }

  const baseDate = toISO(new Date());
  const createdAt = Date.now();

  if(instChecked && instMonths>=2 && state.type==='expense'){
    // 할부 분할
    const per = Math.round(amount / instMonths);
    const instId = 'inst_' + createdAt;
    const baseD = new Date();
    for(let i=0;i<instMonths;i++){
      const d = new Date(baseD.getFullYear(), baseD.getMonth()+i, baseD.getDate());
      await dbAdd('records', {
        type: state.type,
        memo: memo || (findCat(state.selectedCategoryId)?.name||''),
        amount: per,
        categoryId: state.selectedCategoryId,
        assetId: state.selectedAssetId,
        date: toISO(d),
        createdAt,
        instId, instTotal: instMonths, instCurrent: i+1,
        originalAmount: amount,
        photoId: i===0 ? photoId : null,
      });
    }
  }else{
    await dbAdd('records', {
      type: state.type,
      memo: memo || (findCat(state.selectedCategoryId)?.name||''),
      amount,
      categoryId: state.selectedCategoryId,
      assetId: state.selectedAssetId,
      date: baseDate,
      createdAt,
      photoId,
    });
  }

  // 리셋
  document.getElementById('memo-input').value = '';
  document.getElementById('amount-input').value = '';
  document.getElementById('inst-check').checked = false;
  document.getElementById('inst-months').value = '';
  document.getElementById('inst-months').style.display = 'none';
  document.getElementById('photo-preview-name').textContent = '';
  state.pendingPhotoBlob = null;
  renderDetectedCategory(null);

  await reloadAll();
  renderToday();
  renderRecent();
  if(state.currentView==='calendar') renderCalendar();
  await checkBudgetAlert();
}

async function oneTouchRecord(favId){
  const fav = state.favorites.find(f=>f.id===favId);
  if(!fav) return;
  await dbAdd('records', {
    type: 'expense',
    memo: fav.memo,
    amount: fav.amount,
    categoryId: fav.categoryId,
    assetId: fav.assetId,
    date: toISO(new Date()),
    createdAt: Date.now(),
  });
  await reloadAll();
  renderToday();
  renderRecent();
  if(state.currentView==='calendar') renderCalendar();
  // 간단 피드백
  flashFeedback(`${fav.memo} ${fmt(fav.amount)} 기록됨`);
  await checkBudgetAlert();
}

function flashFeedback(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1800);
}

// ---- 기록 상세 다이얼로그 ----
async function openRecordDialog(recId){
  const rec = state.records.find(r=>r.id===recId);
  if(!rec) return;
  const cat = findCat(rec.categoryId);
  const asset = findAsset(rec.assetId);

  let photoHtml = '';
  if(rec.photoId){
    const p = await dbGet('photos', rec.photoId);
    if(p && p.blob){
      const url = URL.createObjectURL(p.blob);
      photoHtml = `<img src="${url}" class="photo-preview-img">`;
    }
  }

  const body = `
    <h2>${rec.memo||'기록'}</h2>
    <div style="font-size:26px;font-weight:700;color:${rec.type==='expense'?'#ff3b30':'#30b856'};margin-bottom:14px;letter-spacing:-0.5px">
      ${rec.type==='expense'?'-':'+'}${fmt(rec.amount)}
    </div>
    <div style="font-size:13px;color:var(--text-2);line-height:1.9;background:rgba(255,255,255,0.5);border:0.5px solid var(--hairline);border-radius:12px;padding:12px 14px">
      <div><b style="color:var(--text-3);font-weight:600">카테고리</b> &nbsp; ${cat?cat.icon+' '+cat.name:'-'}</div>
      <div><b style="color:var(--text-3);font-weight:600">결제수단</b> &nbsp; ${asset?asset.name:'-'}</div>
      <div><b style="color:var(--text-3);font-weight:600">날짜</b> &nbsp; ${rec.date}</div>
      ${rec.instId?`<div><b style="color:var(--text-3);font-weight:600">할부</b> &nbsp; ${rec.instCurrent}/${rec.instTotal}개월 (총 ${fmt(rec.originalAmount)})</div>`:''}
    </div>
    ${photoHtml}
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">닫기</button>
      <button class="dlg-ok" onclick="openEditDialog(${rec.id})">수정</button>
      <button class="dlg-danger" onclick="deleteRecord(${rec.id}, ${rec.instId?`'${rec.instId}'`:'null'})">삭제</button>
    </div>
  `;
  showDialog(body);
}

// 편집 다이얼로그
window.openEditDialog = async function(recId){
  const rec = state.records.find(r=>r.id===recId);
  if(!rec) return;
  const cats = state.categories.filter(c=>c.type===rec.type);
  const catOpt = cats.map(c=>`<option value="${c.id}" ${c.id===rec.categoryId?'selected':''}>${c.icon||''} ${c.name}</option>`).join('');
  const assetOpt = state.assets.map(a=>`<option value="${a.id}" ${a.id===rec.assetId?'selected':''}>${a.name}</option>`).join('');

  showDialog(`
    <h2>기록 수정</h2>
    <div class="field"><label>메모</label><input id="ed-memo" value="${(rec.memo||'').replace(/"/g,'&quot;')}"></div>
    <div class="field"><label>금액</label><input id="ed-amount" type="number" inputmode="numeric" value="${rec.amount}"></div>
    <div class="field"><label>날짜</label><input id="ed-date" type="date" value="${rec.date}"></div>
    <div class="field"><label>카테고리</label><select id="ed-cat">${catOpt}</select></div>
    <div class="field"><label>결제수단</label><select id="ed-asset">${assetOpt}</select></div>
    ${rec.instId?'<p class="hint">할부 항목은 금액/날짜/할부정보는 수정할 수 없어요 (메모/카테고리/결제수단만 가능)</p>':''}
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
      <button class="dlg-ok" onclick="saveEdit(${rec.id})">저장</button>
    </div>
  `);
};

window.saveEdit = async function(recId){
  const rec = state.records.find(r=>r.id===recId);
  if(!rec) return;
  const memo = document.getElementById('ed-memo').value.trim();
  const amount = parseInt(document.getElementById('ed-amount').value||0,10);
  const date = document.getElementById('ed-date').value;
  const categoryId = parseInt(document.getElementById('ed-cat').value);
  const assetId = parseInt(document.getElementById('ed-asset').value);

  if(!amount){alert('금액을 입력해주세요');return;}

  rec.memo = memo || '';
  rec.categoryId = categoryId;
  rec.assetId = assetId;
  // 할부는 금액/날짜 변경 방지
  if(!rec.instId){
    rec.amount = amount;
    rec.date = date;
  }
  await dbPut('records', rec);
  closeDialog();
  await reloadAll();
  renderToday();
  renderRecent();
  if(state.currentView==='calendar') renderCalendar();
  if(state.currentView==='stats') renderStats();
  flashFeedback('수정 완료');
};

window.deleteRecord = async function(id, instId){
  if(instId){
    if(!confirm('할부 전체를 삭제할까요? (연결된 모든 월 포함)')){
      // 개별만 삭제
      if(!confirm('이번 건만 삭제합니다.')) return;
      await dbDel('records', id);
    }else{
      // 전체 할부 삭제
      const all = await dbAll('records');
      for(const r of all) if(r.instId===instId) await dbDel('records', r.id);
    }
  }else{
    if(!confirm('삭제할까요?')) return;
    await dbDel('records', id);
  }
  closeDialog();
  await reloadAll();
  renderToday();
  renderRecent();
  if(state.currentView==='calendar') renderCalendar();
  if(state.currentView==='stats') renderStats();
};

// ---- 통계 ----
function getPeriodRange(){
  const d = new Date(state.currentDate);
  if(state.period==='month'){
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return {from, to, label: `${d.getFullYear()}년 ${d.getMonth()+1}월`};
  }else{
    // 주: 월요일~일요일
    const day = d.getDay();
    const diff = day===0 ? -6 : 1-day;
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()+diff);
    const to = new Date(from);
    to.setDate(from.getDate()+6);
    return {from, to, label: `${from.getMonth()+1}/${from.getDate()} ~ ${to.getMonth()+1}/${to.getDate()}`};
  }
}

function recordsInRange(from, to){
  const fromS = toISO(from), toS = toISO(to);
  return state.records.filter(r=>r.date>=fromS && r.date<=toS);
}

async function renderStats(){
  const {from, to, label} = getPeriodRange();
  document.getElementById('period-label').textContent = label;

  const recs = recordsInRange(from, to);
  const income = recs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const expense = recs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);

  document.getElementById('stat-income').textContent = fmtShort(income)+'원';
  document.getElementById('stat-expense').textContent = fmtShort(expense)+'원';
  document.getElementById('stat-net').textContent = fmtShort(income-expense)+'원';

  // 카테고리별
  const byCat = {};
  recs.filter(r=>r.type==='expense').forEach(r=>{
    byCat[r.categoryId] = (byCat[r.categoryId]||0) + r.amount;
  });
  const catArr = Object.entries(byCat).map(([cid,amt])=>{
    const c = findCat(parseInt(cid));
    return {name:c?c.name:'기타', color:c?c.color:'#ccc', amount:amt};
  }).sort((a,b)=>b.amount-a.amount);

  // 도넛
  const donutCtx = document.getElementById('donut-chart');
  if(state.donutChart) state.donutChart.destroy();
  if(catArr.length){
    state.donutChart = new Chart(donutCtx, {
      type:'doughnut',
      data:{
        labels: catArr.map(c=>c.name),
        datasets:[{data: catArr.map(c=>c.amount), backgroundColor: catArr.map(c=>c.color), borderWidth:0}]
      },
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'65%',
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${fmt(ctx.parsed)}`}}}
      }
    });
  }else{
    const ctx = donutCtx.getContext('2d');
    ctx.clearRect(0,0,donutCtx.width,donutCtx.height);
    ctx.fillStyle = '#8e8e93';
    ctx.textAlign='center';
    ctx.font='13px sans-serif';
    ctx.fillText('데이터 없음', donutCtx.width/2, donutCtx.height/2);
  }

  // 카테고리 목록
  const breakdown = document.getElementById('category-breakdown');
  breakdown.innerHTML = catArr.map(c=>{
    const pct = expense>0 ? Math.round(c.amount/expense*100) : 0;
    return `<div class="cat-row">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span class="cat-name">${c.name}</span>
      <span class="cat-pct">${pct}%</span>
      <span class="cat-amt">${fmt(c.amount)}</span>
    </div>`;
  }).join('');

  // 일별 막대
  renderBarChart(from, to, recs);

  // 예산
  await renderBudget(expense);
}

function renderBarChart(from, to, recs){
  const days = [];
  const dayMap = {};
  const cur = new Date(from);
  while(cur<=to){
    const iso = toISO(cur);
    days.push(iso);
    dayMap[iso] = 0;
    cur.setDate(cur.getDate()+1);
  }
  recs.filter(r=>r.type==='expense').forEach(r=>{
    if(dayMap[r.date]!==undefined) dayMap[r.date] += r.amount;
  });

  const barCtx = document.getElementById('bar-chart');
  if(state.barChart) state.barChart.destroy();
  state.barChart = new Chart(barCtx, {
    type:'bar',
    data:{
      labels: days.map(d=>{const [y,m,day]=d.split('-'); return state.period==='month'?day:`${m}/${day}`;}),
      datasets:[{data: days.map(d=>dayMap[d]), backgroundColor:'rgba(26,26,31,0.85)', borderRadius:6, borderSkipped:false}]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:ctx=>fmt(ctx.parsed.y)}}},
      scales:{
        x:{grid:{display:false}, ticks:{font:{size:10},color:'#8e8e95',maxRotation:0,autoSkip:true,maxTicksLimit:10}, border:{display:false}},
        y:{grid:{color:'rgba(0,0,0,.05)'}, ticks:{font:{size:10},color:'#8e8e95',callback:v=>fmtShort(v)}, border:{display:false}}
      }
    }
  });
}

async function renderBudget(currentExpense){
  const budget = await getSetting('monthBudget', 0);
  const wrap = document.getElementById('budget-progress');
  if(!budget){
    wrap.innerHTML = '<div class="empty" style="padding:8px 0">설정 탭에서 월 예산을 설정하면 여기에 표시됩니다</div>';
    return;
  }
  const pct = Math.min(100, (currentExpense/budget)*100);
  const over = currentExpense > budget;
  wrap.innerHTML = `
    <div class="budget-row">
      <div class="prog-head">
        <span>전체 예산</span>
        <span class="right">${fmtShort(currentExpense)} / ${fmtShort(budget)}원 · ${Math.round(pct)}%</span>
      </div>
      <div class="prog-bar">
        <div class="prog-fill" style="width:${pct}%;background:${over?'linear-gradient(90deg,#ff6b5f,#ff3b30)':pct>80?'linear-gradient(90deg,#ffcc40,#ff9500)':'linear-gradient(90deg,#5dd377,#30b856)'}"></div>
      </div>
      ${over?`<div class="budget-msg over">예산을 ${fmt(currentExpense-budget)} 초과했어요</div>`:pct>80?`<div class="budget-msg" style="color:#ff9500">예산 한도에 가까워지고 있어요</div>`:''}
    </div>
  `;
}

async function checkBudgetAlert(){
  const alertOn = await getSetting('budgetAlert', false);
  const budget = await getSetting('monthBudget', 0);
  if(!alertOn || !budget) return;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth()+1, 0);
  const recs = recordsInRange(from, to);
  const exp = recs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const prevAlerted = await getSetting('budgetAlerted_'+from.getMonth(), false);
  if(exp > budget && !prevAlerted){
    flashFeedback(`⚠️ 이번달 예산 ${fmt(budget)} 초과!`);
    await setSetting('budgetAlerted_'+from.getMonth(), true);
  }
}

// ---- 비교 다이얼로그 ----
function renderCompare(){
  const cur = new Date(state.currentDate);
  const curFrom = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const curTo = new Date(cur.getFullYear(), cur.getMonth()+1, 0);
  const prevFrom = new Date(cur.getFullYear(), cur.getMonth()-1, 1);
  const prevTo = new Date(cur.getFullYear(), cur.getMonth(), 0);

  const curRecs = recordsInRange(curFrom, curTo).filter(r=>r.type==='expense');
  const prevRecs = recordsInRange(prevFrom, prevTo).filter(r=>r.type==='expense');

  const curTotal = curRecs.reduce((s,r)=>s+r.amount,0);
  const prevTotal = prevRecs.reduce((s,r)=>s+r.amount,0);
  const diff = curTotal - prevTotal;
  const diffPct = prevTotal>0 ? Math.round(diff/prevTotal*100) : 0;

  const curBy = {}, prevBy = {};
  curRecs.forEach(r=>{curBy[r.categoryId]=(curBy[r.categoryId]||0)+r.amount;});
  prevRecs.forEach(r=>{prevBy[r.categoryId]=(prevBy[r.categoryId]||0)+r.amount;});

  const allCatIds = new Set([...Object.keys(curBy).map(Number), ...Object.keys(prevBy).map(Number)]);
  const rows = [...allCatIds].map(cid=>{
    const c = findCat(cid);
    const cv = curBy[cid]||0, pv = prevBy[cid]||0;
    return {cat:c, cur:cv, prev:pv, diff:cv-pv};
  }).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff));

  const body = `
    <h2>저번달 vs 이번달</h2>
    <div class="compare-totals">
      <div class="compare-cell">
        <div class="lbl">저번달</div>
        <div class="val">${fmtShort(prevTotal)}원</div>
      </div>
      <div class="compare-cell">
        <div class="lbl">이번달</div>
        <div class="val">${fmtShort(curTotal)}원</div>
      </div>
    </div>
    <div class="compare-diff ${diff>0?'up':'down'}">
      ${diff>0?'▲':'▼'} ${fmt(Math.abs(diff))} (${diff>0?'+':''}${diffPct}%)
    </div>
    <div>
      <div class="compare-block-title">카테고리별 변화</div>
      ${rows.map(r=>{
        let deltaHtml;
        if(r.prev===0) deltaHtml = `<span class="cmp-delta new">NEW +${fmtShort(r.cur)}</span>`;
        else if(r.cur===0) deltaHtml = `<span class="cmp-delta down">사라짐 -${fmtShort(r.prev)}</span>`;
        else{
          const pct = Math.round((r.cur-r.prev)/r.prev*100);
          deltaHtml = `<span class="cmp-delta ${r.diff>0?'up':'down'}">${r.diff>0?'+':''}${pct}% (${r.diff>0?'+':''}${fmtShort(r.diff)})</span>`;
        }
        return `<div class="cmp-row">
          <span class="cat-dot" style="background:${r.cat?r.cat.color:'#ccc'}"></span>
          <span class="cmp-name">${r.cat?r.cat.name:'기타'}</span>
          ${deltaHtml}
        </div>`;
      }).join('')}
    </div>
    <div class="dialog-btns">
      <button class="dlg-ok" onclick="closeDialog()">확인</button>
    </div>
  `;
  showDialog(body);
}

// ---- 고정지출 ----
function renderFixed(){
  const wrap = document.getElementById('fixed-list');
  if(!state.fixed.length){
    wrap.innerHTML = '<div class="empty">매달 자동으로 기록될 항목을 추가하세요</div>';
    return;
  }
  wrap.innerHTML = state.fixed.map(f=>{
    const cat = findCat(f.categoryId);
    return `<div class="list-row">
      <span class="row-dot" style="background:${cat?cat.color:'#ccc'}"></span>
      <div class="row-main">
        <div class="row-title">${f.memo}</div>
        <div class="row-sub">매달 ${f.day}일 · ${cat?cat.name:''} · ${fmt(f.amount)}</div>
      </div>
      <button class="row-del" data-del-fixed="${f.id}">삭제</button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-del-fixed]').forEach(el=>{
    el.onclick = async()=>{
      if(!confirm('삭제할까요?')) return;
      await dbDel('fixed', parseInt(el.dataset.delFixed));
      await reloadAll();
      renderFixed();
    };
  });
}

function renderFavList(){
  const wrap = document.getElementById('fav-list');
  if(!state.favorites.length){
    wrap.innerHTML = '<div class="empty">자주 쓰는 항목을 추가하면 원터치로 기록돼요</div>';
    return;
  }
  wrap.innerHTML = state.favorites.map(f=>{
    const cat = findCat(f.categoryId);
    return `<div class="list-row">
      <span class="row-dot" style="background:${cat?cat.color:'#ccc'}"></span>
      <div class="row-main">
        <div class="row-title">${f.memo}</div>
        <div class="row-sub">${cat?cat.name:''} · ${fmt(f.amount)}</div>
      </div>
      <button class="row-del" data-del-fav="${f.id}">삭제</button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-del-fav]').forEach(el=>{
    el.onclick = async()=>{
      if(!confirm('삭제할까요?')) return;
      await dbDel('favorites', parseInt(el.dataset.delFav));
      await reloadAll();
      renderFavList();
      renderFavorites();
    };
  });
}

// 고정지출 자동 실행
async function runFixedJob(){
  const last = await getSetting('lastFixedCheck', '');
  const today = toISO(new Date());
  if(last === today) return;

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  const existing = state.records.map(r=>r.fixedRefMonth);

  for(const f of state.fixed){
    if(day >= f.day){
      const tag = `${f.id}_${y}_${m}`;
      if(!existing.includes(tag)){
        const execDate = new Date(y, m, Math.min(f.day, new Date(y,m+1,0).getDate()));
        await dbAdd('records', {
          type: 'expense',
          memo: f.memo,
          amount: f.amount,
          categoryId: f.categoryId,
          assetId: f.assetId,
          date: toISO(execDate),
          createdAt: Date.now(),
          fixedRefMonth: tag,
        });
      }
    }
  }
  await setSetting('lastFixedCheck', today);
  await reloadAll();
}

// ---- 설정: 카테고리/자산/키워드 관리 ----
function renderCategoryManage(){
  const wrap = document.getElementById('category-manage');
  wrap.innerHTML = state.categories.map(c=>`
    <div class="list-row">
      <span class="row-dot" style="background:${c.color}"></span>
      <div class="row-main">
        <div class="row-title">${c.icon||''} ${c.name}</div>
        <div class="row-sub">${c.type==='expense'?'지출':'수입'}</div>
      </div>
      <button class="row-del" data-del-cat="${c.id}">삭제</button>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-del-cat]').forEach(el=>{
    el.onclick = async()=>{
      if(!confirm('삭제할까요? 관련 기록의 카테고리는 "기타"로 바뀝니다.')) return;
      const id = parseInt(el.dataset.delCat);
      await dbDel('categories', id);
      const etc = state.categories.find(c=>c.name==='기타')?.id;
      if(etc){
        const recs = await dbAll('records');
        for(const r of recs) if(r.categoryId===id){r.categoryId=etc; await dbPut('records', r);}
      }
      await reloadAll();
      renderCategoryManage();
    };
  });
}

function renderAssetManage(){
  const wrap = document.getElementById('asset-manage');
  wrap.innerHTML = state.assets.map(a=>`
    <div class="list-row">
      <div class="row-main">
        <div class="row-title">${a.icon||''} ${a.name}</div>
      </div>
      <button class="row-del" data-del-asset="${a.id}">삭제</button>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-del-asset]').forEach(el=>{
    el.onclick = async()=>{
      if(!confirm('삭제할까요?')) return;
      await dbDel('assets', parseInt(el.dataset.delAsset));
      await reloadAll();
      renderAssetManage();
    };
  });
}

function renderKeywordManage(){
  const wrap = document.getElementById('keyword-manage');
  wrap.innerHTML = state.keywords.map(k=>{
    const c = findCat(k.categoryId);
    return `<div class="list-row">
      <div class="row-main">
        <div class="row-title">"${k.keyword}"</div>
        <div class="row-sub">→ ${c?c.name:'(삭제됨)'}</div>
      </div>
      <button class="row-del" data-del-kw="${k.id}">삭제</button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('[data-del-kw]').forEach(el=>{
    el.onclick = async()=>{
      await dbDel('keywords', parseInt(el.dataset.delKw));
      await reloadAll();
      renderKeywordManage();
    };
  });
}

// ---- 다이얼로그 유틸 ----
function showDialog(html){
  document.getElementById('dialog').innerHTML = html;
  document.getElementById('dialog-backdrop').classList.remove('hidden');
}
function closeDialog(){
  document.getElementById('dialog-backdrop').classList.add('hidden');
}
window.closeDialog = closeDialog;

// 카테고리 옵션 HTML
function catOptions(type=null){
  return state.categories
    .filter(c=>type?c.type===type:true)
    .map(c=>`<option value="${c.id}">${c.icon||''} ${c.name}</option>`).join('');
}
function assetOptions(){
  return state.assets.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
}

// 고정지출 추가 다이얼로그
function openFixedDialog(){
  showDialog(`
    <h2>고정지출 추가</h2>
    <div class="field"><label>이름</label><input id="d-memo" placeholder="예: 넷플릭스"></div>
    <div class="field"><label>금액</label><input id="d-amt" type="number" inputmode="numeric"></div>
    <div class="field"><label>매달 며칠</label><input id="d-day" type="number" min="1" max="31" inputmode="numeric" value="1"></div>
    <div class="field"><label>카테고리</label><select id="d-cat">${catOptions('expense')}</select></div>
    <div class="field"><label>자산</label><select id="d-asset">${assetOptions()}</select></div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
      <button class="dlg-ok" onclick="saveFixedDialog()">저장</button>
    </div>
  `);
}
window.saveFixedDialog = async function(){
  const memo = document.getElementById('d-memo').value.trim();
  const amount = parseInt(document.getElementById('d-amt').value||0,10);
  const day = parseInt(document.getElementById('d-day').value||1,10);
  const categoryId = parseInt(document.getElementById('d-cat').value);
  const assetId = parseInt(document.getElementById('d-asset').value);
  if(!memo||!amount){alert('이름/금액 입력');return;}
  await dbAdd('fixed', {memo, amount, day, categoryId, assetId});
  closeDialog();
  await reloadAll();
  renderFixed();
};

// 즐겨찾기 추가
function openFavDialog(){
  showDialog(`
    <h2>즐겨찾기 추가</h2>
    <div class="field"><label>이름</label><input id="d-memo" placeholder="예: 점심 김치찌개"></div>
    <div class="field"><label>금액</label><input id="d-amt" type="number" inputmode="numeric"></div>
    <div class="field"><label>카테고리</label><select id="d-cat">${catOptions('expense')}</select></div>
    <div class="field"><label>자산</label><select id="d-asset">${assetOptions()}</select></div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
      <button class="dlg-ok" onclick="saveFavDialog()">저장</button>
    </div>
  `);
}
window.saveFavDialog = async function(){
  const memo = document.getElementById('d-memo').value.trim();
  const amount = parseInt(document.getElementById('d-amt').value||0,10);
  const categoryId = parseInt(document.getElementById('d-cat').value);
  const assetId = parseInt(document.getElementById('d-asset').value);
  if(!memo||!amount){alert('이름/금액 입력');return;}
  await dbAdd('favorites', {memo, amount, categoryId, assetId});
  closeDialog();
  await reloadAll();
  renderFavList();
  renderFavorites();
};

// 카테고리 추가
function openCatDialog(){
  const colors = ['#ff6b4a','#b47342','#4a90e2','#e85a9b','#9b59d0','#5d7285','#2bb673','#f5a623','#8e8e93','#34c759','#30bfa8','#ff3b30'];
  showDialog(`
    <h2>카테고리 추가</h2>
    <div class="field"><label>이름</label><input id="d-name"></div>
    <div class="field"><label>이모지 (선택)</label><input id="d-icon" placeholder="🍎"></div>
    <div class="field"><label>타입</label>
      <select id="d-type"><option value="expense">지출</option><option value="income">수입</option></select>
    </div>
    <div class="field"><label>색상</label>
      <div id="d-colors" class="color-grid">
        ${colors.map((c,i)=>`<button type="button" class="color-chip ${i===0?'active':''}" data-color="${c}" style="background:${c}"></button>`).join('')}
      </div>
    </div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
      <button class="dlg-ok" onclick="saveCatDialog()">저장</button>
    </div>
  `);
  let chosen = colors[0];
  document.querySelectorAll('#d-colors .color-chip').forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll('#d-colors .color-chip').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      chosen = b.dataset.color;
    };
  });
  window._chosenColor = ()=>chosen;
}
window.saveCatDialog = async function(){
  const name = document.getElementById('d-name').value.trim();
  const icon = document.getElementById('d-icon').value.trim();
  const type = document.getElementById('d-type').value;
  const color = window._chosenColor();
  if(!name){alert('이름 입력');return;}
  await dbAdd('categories', {name, icon, type, color});
  closeDialog();
  await reloadAll();
  renderCategoryManage();
};

// 자산 추가
function openAssetDialog(){
  showDialog(`
    <h2>자산 추가</h2>
    <div class="field"><label>이름</label><input id="d-name" placeholder="예: 국민은행 체크"></div>
    <div class="field"><label>이모지 (선택)</label><input id="d-icon" placeholder="💳"></div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
      <button class="dlg-ok" onclick="saveAssetDialog()">저장</button>
    </div>
  `);
}
window.saveAssetDialog = async function(){
  const name = document.getElementById('d-name').value.trim();
  const icon = document.getElementById('d-icon').value.trim();
  if(!name){alert('이름 입력');return;}
  await dbAdd('assets', {name, icon});
  closeDialog();
  await reloadAll();
  renderAssetManage();
};

// 키워드 추가
function openKwDialog(){
  showDialog(`
    <h2>자동인식 키워드 추가</h2>
    <div class="field"><label>키워드 (예: 올리브영)</label><input id="d-kw"></div>
    <div class="field"><label>연결할 카테고리</label><select id="d-cat">${catOptions()}</select></div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
      <button class="dlg-ok" onclick="saveKwDialog()">저장</button>
    </div>
  `);
}
window.saveKwDialog = async function(){
  const keyword = document.getElementById('d-kw').value.trim();
  const categoryId = parseInt(document.getElementById('d-cat').value);
  if(!keyword){alert('키워드 입력');return;}
  await dbAdd('keywords', {keyword, categoryId});
  closeDialog();
  await reloadAll();
  renderKeywordManage();
};

// ---- 내보내기/가져오기 ----
async function exportData(){
  const data = {
    records: await dbAll('records'),
    categories: await dbAll('categories'),
    assets: await dbAll('assets'),
    keywords: await dbAll('keywords'),
    fixed: await dbAll('fixed'),
    favorites: await dbAll('favorites'),
    exported: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledger_${toISO(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
async function importData(file){
  const text = await file.text();
  const data = JSON.parse(text);
  if(!confirm('기존 데이터를 모두 대체합니다. 계속할까요?')) return;
  for(const s of ['records','categories','assets','keywords','fixed','favorites']){
    await dbClear(s);
    if(data[s]){
      for(const item of data[s]){
        const copy = {...item};
        delete copy.id;
        await dbAdd(s, copy);
      }
    }
  }
  await reloadAll();
  alert('가져오기 완료');
  location.reload();
}

// ---- 초기화/네비게이션 ----
function switchView(name){
  state.currentView = name;
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===name));
  window.scrollTo(0,0);
  if(name==='calendar') renderCalendar();
  if(name==='stats') renderStats();
  if(name==='fixed'){renderFixed();renderFavList();}
  if(name==='settings'){
    renderCategoryManage();renderAssetManage();renderKeywordManage();
    getSetting('monthBudget',0).then(v=>document.getElementById('budget-input').value = v||'');
    getSetting('budgetAlert',false).then(v=>document.getElementById('alert-check').checked = v);
  }
}

// ---- 이벤트 바인딩 ----
async function init(){
  await openDB();
  await firstRunSeed();
  await reloadAll();
  await runFixedJob();
  await reloadAll();

  // 기본 선택
  state.selectedCategoryId = state.categories.find(c=>c.type==='expense')?.id;
  state.selectedAssetId = state.assets[0]?.id;

  renderToday();
  renderCategorySelect();
  renderAssetSelect();
  renderFavorites();
  renderRecent();
  renderCalendar();

  // 탭
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>switchView(t.dataset.view));

  // 타입 토글
  document.querySelectorAll('.seg-btn').forEach(b=>{
    b.onclick = ()=>{
      state.type = b.dataset.type;
      document.querySelectorAll('.seg-btn').forEach(x=>x.classList.toggle('active', x.dataset.type===state.type));
      state.selectedCategoryId = state.categories.find(c=>c.type===state.type)?.id;
      renderCategorySelect();
      updateInputCardColor();
    };
  });

  // 카테고리/결제수단 선택 버튼
  document.getElementById('select-category').onclick = openCategorySheet;
  document.getElementById('select-asset').onclick = openAssetSheet;

  // 메모 입력 - 자동인식
  const memoInput = document.getElementById('memo-input');
  memoInput.addEventListener('input', ()=>{
    const text = memoInput.value;
    const ex = extractAmount(text);
    const memo = ex ? ex.memo : text;
    const cat = detectCategory(memo);
    if(cat && cat.type===state.type){
      state.selectedCategoryId = cat.id;
      renderCategorySelect();
      updateInputCardColor();
      renderDetectedCategory(cat);
      if(ex) document.getElementById('amount-input').value = ex.amount;
    }else{
      renderDetectedCategory(null);
    }
  });

  // 할부 체크박스
  document.getElementById('inst-check').onchange = e=>{
    document.getElementById('inst-months').style.display = e.target.checked?'block':'none';
  };

  // 사진
  document.getElementById('photo-input').addEventListener('change', async e=>{
    const file = e.target.files[0];
    if(!file) return;
    const resized = await resizeImage(file, 1200, 0.8);
    state.pendingPhotoBlob = resized;
    document.getElementById('photo-preview-name').textContent = '✓ 첨부됨';
  });

  // 저장
  document.getElementById('submit-btn').onclick = saveRecord;

  // 통계 기간 이동
  document.getElementById('prev-period').onclick = ()=>{
    const d = new Date(state.currentDate);
    if(state.period==='month') d.setMonth(d.getMonth()-1);
    else d.setDate(d.getDate()-7);
    state.currentDate = d; renderStats();
  };
  document.getElementById('next-period').onclick = ()=>{
    const d = new Date(state.currentDate);
    if(state.period==='month') d.setMonth(d.getMonth()+1);
    else d.setDate(d.getDate()+7);
    state.currentDate = d; renderStats();
  };
  document.querySelectorAll('.seg-mini button').forEach(b=>{
    b.onclick = ()=>{
      state.period = b.dataset.period;
      document.querySelectorAll('.seg-mini button').forEach(x=>x.classList.toggle('active', x.dataset.period===state.period));
      renderStats();
    };
  });

  document.getElementById('compare-btn').onclick = renderCompare;

  // 고정/즐찾 추가
  document.getElementById('add-fixed-btn').onclick = openFixedDialog;
  document.getElementById('add-fav-btn').onclick = openFavDialog;
  document.getElementById('add-cat-btn').onclick = openCatDialog;
  document.getElementById('add-asset-btn').onclick = openAssetDialog;
  document.getElementById('add-keyword-btn').onclick = openKwDialog;

  // 예산
  document.getElementById('save-budget').onclick = async()=>{
    const v = parseInt(document.getElementById('budget-input').value||0,10);
    await setSetting('monthBudget', v);
    flashFeedback('예산 저장됨');
  };
  document.getElementById('alert-check').onchange = async e=>{
    await setSetting('budgetAlert', e.target.checked);
  };

  // 데이터
  document.getElementById('export-btn').onclick = exportData;
  document.getElementById('import-btn').onclick = ()=>document.getElementById('import-file').click();
  document.getElementById('import-file').onchange = e=>{
    if(e.target.files[0]) importData(e.target.files[0]);
  };
  document.getElementById('reset-btn').onclick = async()=>{
    if(!confirm('정말 모든 데이터를 삭제할까요? 되돌릴 수 없습니다.')) return;
    if(!confirm('마지막 확인. 전체 초기화 하시겠습니까?')) return;
    for(const s of ['records','categories','assets','keywords','fixed','favorites','photos','settings']){
      await dbClear(s);
    }
    location.reload();
  };

  // 배경 클릭시 다이얼로그 닫기
  document.getElementById('dialog-backdrop').onclick = e=>{
    if(e.target.id==='dialog-backdrop') closeDialog();
  };

  // 달력 네비게이션
  document.getElementById('cal-prev').onclick = ()=>{
    if(state.calMode==='month') state.calDate.setMonth(state.calDate.getMonth()-1);
    else state.calDate.setDate(state.calDate.getDate()-7);
    state.calDate = new Date(state.calDate);
    renderCalendar();
  };
  document.getElementById('cal-next').onclick = ()=>{
    if(state.calMode==='month') state.calDate.setMonth(state.calDate.getMonth()+1);
    else state.calDate.setDate(state.calDate.getDate()+7);
    state.calDate = new Date(state.calDate);
    renderCalendar();
  };
  document.querySelectorAll('[data-cal-mode]').forEach(b=>{
    b.onclick = ()=>{
      state.calMode = b.dataset.calMode;
      document.querySelectorAll('[data-cal-mode]').forEach(x=>x.classList.toggle('active', x.dataset.calMode===state.calMode));
      renderCalendar();
    };
  });

  // 접히는 섹션
  setupCollapsibles();

  // SW 등록 + 업데이트 감지
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').then(reg=>{
      // 1시간마다 업데이트 체크
      setInterval(()=>reg.update(), 60*60*1000);
      // 새 SW가 대기 중이면 즉시 활성화
      reg.addEventListener('updatefound', ()=>{
        const newSW = reg.installing;
        if(newSW){
          newSW.addEventListener('statechange', ()=>{
            if(newSW.state === 'installed' && navigator.serviceWorker.controller){
              // 이미 페이지 로드된 상태에서 새 SW 설치됨 → 새로고침
              newSW.postMessage({type:'SKIP_WAITING'});
              window.location.reload();
            }
          });
        }
      });
    }).catch(()=>{});
  }
}

function resizeImage(file, maxSize, quality){
  return new Promise(resolve=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e=>{
      img.onload = ()=>{
        let {width, height} = img;
        if(width>height && width>maxSize){height*=maxSize/width; width=maxSize;}
        else if(height>maxSize){width*=maxSize/height; height=maxSize;}
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(b=>resolve(b), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ========== 카테고리/결제수단 선택 시트 ==========
function openCategorySheet(){
  const cats = state.categories.filter(c=>c.type===state.type);
  const items = cats.map(c=>`
    <div class="sheet-item ${state.selectedCategoryId===c.id?'selected':''}" data-cat-id="${c.id}">
      <span class="si-dot" style="background:${c.color}"></span>
      <span class="si-name">${c.icon||''} ${c.name}</span>
      <span class="si-check">✓</span>
    </div>
  `).join('');
  showDialog(`
    <h2>카테고리 선택</h2>
    <div class="sheet-list">${items}</div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
    </div>
  `);
  document.querySelectorAll('.sheet-item[data-cat-id]').forEach(el=>{
    el.onclick = ()=>{
      state.selectedCategoryId = parseInt(el.dataset.catId);
      renderCategorySelect();
      updateInputCardColor();
      closeDialog();
    };
  });
}

function openAssetSheet(){
  const items = state.assets.map(a=>`
    <div class="sheet-item ${state.selectedAssetId===a.id?'selected':''}" data-asset-id="${a.id}">
      <span class="si-name" style="padding-left:0">${a.icon||'💳'} &nbsp; ${a.name}</span>
      <span class="si-check">✓</span>
    </div>
  `).join('');
  showDialog(`
    <h2>결제수단 선택</h2>
    <div class="sheet-list">${items}</div>
    <div class="dialog-btns">
      <button class="dlg-cancel" onclick="closeDialog()">취소</button>
    </div>
  `);
  document.querySelectorAll('.sheet-item[data-asset-id]').forEach(el=>{
    el.onclick = ()=>{
      state.selectedAssetId = parseInt(el.dataset.assetId);
      renderAssetSelect();
      closeDialog();
    };
  });
}

// ========== 달력 ==========
function renderCalendar(){
  if(state.calMode==='month') renderCalendarMonth();
  else renderCalendarWeek();
  renderCalDay();
}

function renderCalendarMonth(){
  const d = state.calDate;
  const y = d.getFullYear(), m = d.getMonth();
  document.getElementById('cal-label').textContent = `${y}년 ${m+1}월`;
  document.getElementById('cal-grid-title').textContent = '달력';

  // 월 요약
  const monthFrom = new Date(y,m,1);
  const monthTo = new Date(y,m+1,0);
  const monthRecs = recordsInRange(monthFrom, monthTo);
  const monthInc = monthRecs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const monthExp = monthRecs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  document.getElementById('cal-income').textContent = fmtShort(monthInc)+'원';
  document.getElementById('cal-expense').textContent = fmtShort(monthExp)+'원';
  document.getElementById('cal-net').textContent = fmtShort(monthInc-monthExp)+'원';

  // 날짜별 집계
  const byDate = {};
  monthRecs.forEach(r=>{
    if(!byDate[r.date]) byDate[r.date] = {inc:0,exp:0};
    if(r.type==='income') byDate[r.date].inc += r.amount;
    else byDate[r.date].exp += r.amount;
  });

  // 달력 그리드 생성
  const firstDay = new Date(y,m,1).getDay(); // 일=0
  const lastDay = new Date(y,m+1,0).getDate();
  const prevLastDay = new Date(y,m,0).getDate();
  const todayISO = toISO(new Date());

  let html = `<div class="cal-weekdays">
    <div class="cal-wd sun">일</div>
    <div class="cal-wd">월</div>
    <div class="cal-wd">화</div>
    <div class="cal-wd">수</div>
    <div class="cal-wd">목</div>
    <div class="cal-wd">금</div>
    <div class="cal-wd sat">토</div>
  </div><div class="cal-days">`;

  // 이전 달 빈칸
  for(let i=firstDay-1;i>=0;i--){
    const day = prevLastDay - i;
    const prevD = new Date(y,m-1,day);
    const iso = toISOFromDate(prevD);
    const data = byDate[iso] || {inc:0,exp:0};
    const dayOfWeek = prevD.getDay();
    html += renderCalDayCell(iso, day, data, dayOfWeek, true, todayISO);
  }
  // 현재 달
  for(let day=1;day<=lastDay;day++){
    const curD = new Date(y,m,day);
    const iso = toISOFromDate(curD);
    const data = byDate[iso] || {inc:0,exp:0};
    const dayOfWeek = curD.getDay();
    html += renderCalDayCell(iso, day, data, dayOfWeek, false, todayISO);
  }
  // 다음 달 빈칸 (6줄까지 채움)
  const totalCells = firstDay + lastDay;
  const remaining = (7 - totalCells % 7) % 7;
  for(let i=1;i<=remaining;i++){
    const nextD = new Date(y,m+1,i);
    const iso = toISOFromDate(nextD);
    const data = byDate[iso] || {inc:0,exp:0};
    const dayOfWeek = nextD.getDay();
    html += renderCalDayCell(iso, i, data, dayOfWeek, true, todayISO);
  }

  html += '</div>';
  document.getElementById('cal-grid').innerHTML = html;

  document.querySelectorAll('.cal-day').forEach(el=>{
    el.onclick = ()=>{
      state.calSelectedDate = el.dataset.iso;
      renderCalendarMonth();
    };
  });
}

function renderCalDayCell(iso, day, data, dayOfWeek, isOut, todayISO){
  const classes = ['cal-day'];
  if(isOut) classes.push('out');
  if(iso === todayISO) classes.push('today');
  if(iso === state.calSelectedDate) classes.push('selected');
  if(dayOfWeek === 0) classes.push('sun');
  if(dayOfWeek === 6) classes.push('sat');
  let bottom = '';
  if(data.exp>0) bottom += `<div class="cal-d-expense">${fmtShort(data.exp)}</div>`;
  if(data.inc>0 && !data.exp) bottom += `<div class="cal-d-income">+${fmtShort(data.inc)}</div>`;
  else if(data.inc>0 && data.exp) bottom += `<div class="cal-d-income">+${fmtShort(data.inc)}</div>`;
  return `<button class="${classes.join(' ')}" data-iso="${iso}">
    <div class="cal-d-num">${day}</div>
    ${bottom}
  </button>`;
}

function renderCalendarWeek(){
  const d = new Date(state.calDate);
  const day = d.getDay();
  const diff = day===0 ? -6 : 1-day; // 월요일 시작
  const weekFrom = new Date(d.getFullYear(), d.getMonth(), d.getDate()+diff);
  const weekTo = new Date(weekFrom); weekTo.setDate(weekFrom.getDate()+6);
  document.getElementById('cal-label').textContent = `${weekFrom.getMonth()+1}/${weekFrom.getDate()} ~ ${weekTo.getMonth()+1}/${weekTo.getDate()}`;
  document.getElementById('cal-grid-title').textContent = '이번 주';

  const weekRecs = recordsInRange(weekFrom, weekTo);
  const weekInc = weekRecs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const weekExp = weekRecs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  document.getElementById('cal-income').textContent = fmtShort(weekInc)+'원';
  document.getElementById('cal-expense').textContent = fmtShort(weekExp)+'원';
  document.getElementById('cal-net').textContent = fmtShort(weekInc-weekExp)+'원';

  const byDate = {};
  weekRecs.forEach(r=>{
    if(!byDate[r.date]) byDate[r.date] = {inc:0,exp:0};
    if(r.type==='income') byDate[r.date].inc += r.amount;
    else byDate[r.date].exp += r.amount;
  });

  const todayISO = toISO(new Date());
  const dayNames = ['일','월','화','수','목','금','토'];
  let html = '<div class="cal-week-list">';
  for(let i=0;i<7;i++){
    const curD = new Date(weekFrom); curD.setDate(weekFrom.getDate()+i);
    const iso = toISOFromDate(curD);
    const data = byDate[iso] || {inc:0,exp:0};
    const dow = curD.getDay();
    const classes = ['cal-week-row'];
    if(iso === todayISO) classes.push('today');
    if(iso === state.calSelectedDate) classes.push('selected');
    if(dow===0) classes.push('sun');
    if(dow===6) classes.push('sat');
    html += `<div class="${classes.join(' ')}" data-iso="${iso}">
      <div class="wr-date">
        <div class="wr-day">${dayNames[dow]}</div>
        <div class="wr-num">${curD.getDate()}</div>
      </div>
      <div class="wr-sums">
        ${data.exp?`<div class="wr-exp">-${fmt(data.exp)}</div>`:''}
        ${data.inc?`<div class="wr-inc">+${fmt(data.inc)}</div>`:''}
        ${!data.exp&&!data.inc?`<div class="wr-empty">기록 없음</div>`:''}
      </div>
    </div>`;
  }
  html += '</div>';
  document.getElementById('cal-grid').innerHTML = html;

  document.querySelectorAll('.cal-week-row').forEach(el=>{
    el.onclick = ()=>{
      state.calSelectedDate = el.dataset.iso;
      renderCalendarWeek();
    };
  });
}

function renderCalDay(){
  const iso = state.calSelectedDate;
  const d = parseISO(iso);
  const dayNames = ['일','월','화','수','목','금','토'];
  document.getElementById('cal-day-title').textContent = `${d.getMonth()+1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;

  const items = state.records.filter(r=>r.date===iso).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  document.getElementById('cal-day-count').textContent = items.length ? `${items.length}건` : '';
  const wrap = document.getElementById('cal-day-items');
  if(!items.length){
    wrap.innerHTML = '<div class="empty">이 날 기록이 없어요</div>';
    return;
  }
  wrap.innerHTML = items.map(r=>{
    const cat = findCat(r.categoryId);
    const asset = findAsset(r.assetId);
    const ico = cat?.icon || (r.type==='income'?'💵':'📌');
    const iconStyle = cat ? `background:${cat.color}15;border-color:${cat.color}35` : '';
    return `<div class="item-row" data-rec-id="${r.id}">
      <div class="item-icon" style="${iconStyle}">${ico}</div>
      <div class="item-body">
        <div class="item-memo">${r.memo||(cat?cat.name:'기록')} ${r.photoId?'📷':''}</div>
        <div class="item-meta">
          <span>${cat?cat.name:''}</span>
          ${asset?`<span>· ${asset.name}</span>`:''}
          ${r.instId?`<span class="inst-tag">할부 ${r.instCurrent}/${r.instTotal}</span>`:''}
        </div>
      </div>
      <div class="item-amt ${r.type}">${r.type==='expense'?'-':'+'}${fmt(r.amount)}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.item-row').forEach(el=>{
    el.onclick = ()=>openRecordDialog(parseInt(el.dataset.recId));
  });
}

// ========== collapsible toggle ==========
function setupCollapsibles(){
  document.querySelectorAll('.collapsible .sec-head-btn').forEach(h=>{
    h.onclick = ()=>{
      const sec = h.closest('.collapsible');
      sec.classList.toggle('collapsed');
    };
  });
}

init();
