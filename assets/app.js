/* 懋略设计规则库 — 前端逻辑（无依赖，GitHub Pages 直接可用） */
'use strict';

const DATA = {
  docs: {},      // id -> doc json
  parts: [],     // parts.json
  surface: null, // surface.json
};
const CAT_LABELS = {
  '结构件': ['sheet-metal', 'extrusion', 'die-casting', 'injection', 'machining-busbar', 'endplate-tiebar'],
  '电气件': ['fpc', 'ccs', 'harness-cable', 'connector', 'bmu-ntc', 'electrical-devices', 'ess-architecture'],
  '热管理与安全': ['cold-plate', 'fire-explosion'],
  '密封胶粘': ['sealing', 'adhesive-thermal'],
  '绝缘隔热': ['insulation'],
  '紧固件': ['fasteners'],
  '表面处理': ['surface-treatment'],
  '焊接': ['welding'],
  '通用': ['overview'],
};
const CAT_ICONS = { '结构件': '🏗', '电气件': '⚡', '热管理与安全': '🔥', '密封胶粘': '💧', '绝缘隔热': '🧱', '紧固件': '🔩', '表面处理': '🛡', '焊接': '🪄', '通用': '📖' };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------------- 访问令牌解锁与数据解密 ---------------- */
async function unlock() {
  const input = document.getElementById('lockInput');
  const btn = document.getElementById('lockBtn');
  const err = document.getElementById('lockErr');
  const pass = (input.value || '').trim();
  if (!pass) { err.textContent = '请输入访问令牌'; return; }
  btn.disabled = true;
  btn.textContent = '验证中…';
  err.textContent = '';
  try {
    const r = await fetch('data/bundle.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.json();
    const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const salt = bytes(b.salt);
    const iv = bytes(b.iv);
    const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: b.iter, hash: 'SHA-256' }, baseKey, 256);
    const key = await crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, bytes(b.data));
    const payload = JSON.parse(new TextDecoder().decode(pt));
    if (payload.marker !== 'MORLUS-LOCK-V1') throw new Error('BAD MARKER');
    DATA.docs = payload.docs || {};
    DATA.techspec = payload.techspec || {};
    DATA.parts = (payload.parts && payload.parts.parts) || [];
    DATA.surface = payload.surface;
    DATA.change = payload.change;
    document.getElementById('lock').classList.add('hide');
    input.value = '';
    renderNav();
    route();
  } catch (e) {
    err.textContent = '令牌不正确，或数据无法解密，请重试';
    const card = document.getElementById('lockCard');
    if (card) {
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
    btn.disabled = false;
    btn.textContent = '进入';
  }
}

function lockInputKey(e) {
  if (e.key === 'Enter') unlock();
}

/* ---------------- 导航 ---------------- */
function renderNav() {
  const box = $('#nav-process');
  const order = Object.keys(CAT_LABELS);
  box.innerHTML = order.map(cat => {
    const ids = CAT_LABELS[cat].filter(id => DATA.docs[id]);
    if (!ids.length) return '';
    return `<div class="nav-group" data-cat="${cat}">
      ${ids.map(id => {
        const d = DATA.docs[id];
        return `<a class="nav-item" href="#/doc/${id}" data-view="doc" data-id="${id}">
          <span class="ico">${CAT_ICONS[cat]}</span>${esc(d ? d.title.replace('设计规范', '').replace('选用规范', '') : id)}</a>`;
      }).join('')}
    </div>`;
  }).join('');
  // 展开当前分类
  const cur = location.hash.match(/#\/doc\/([a-z-]+)/);
  if (cur && DATA.docs[cur[1]]) {
    const cat = Object.keys(CAT_LABELS).find(c => CAT_LABELS[c].includes(cur[1]));
    if (cat) {
      const g = box.querySelector(`[data-cat="${cat}"]`);
      if (g) g.prepend(`<div class="nav-group-title">${CAT_ICONS[cat]} ${cat}</div>`);
    }
  }
  markActive();
}

function markActive() {
  document.querySelectorAll('.nav-item[data-view]').forEach(a => {
    const id = a.dataset.id;
    let on;
    if (a.dataset.view === 'doc') on = location.hash === `#/doc/${id}`;
    else if (a.dataset.view === 'techspec') on = location.hash.startsWith('#/techspec');
    else on = location.hash === `#/${a.dataset.view}`;
    a.classList.toggle('active', on);
  });
}

/* ---------------- 路由 ---------------- */
function route() {
  const h = location.hash || '#/home';
  const content = $('#content');
  markActive();
  $('#menuBtn') && ($('#sidebar').classList.remove('open'));
  window.scrollTo(0, 0);
  let m;
  if (h.startsWith('#/doc/')) {
    const raw = h.slice(6);
    const [id, anchor] = raw.split('#');
    renderDoc(content, id);
    if (anchor) setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView(); }, 120);
    return;
  }
  if (h.startsWith('#/parts')) { renderParts(content, decodeURIComponent(h.slice(7).replace(/^\//, ''))); return; }
  if (h.startsWith('#/surface')) { renderSurface(content); return; }
  if (h.startsWith('#/change')) { renderChange(content); return; }
  if (h.startsWith('#/techspec')) { renderTechspec(content, h.slice(10).replace(/^\//, '')); return; }
  if (h.startsWith('#/checklist')) { renderChecklist(content, h.slice(11).replace(/^\//, '')); return; }
  if (h.startsWith('#/about')) { renderAbout(content); return; }
  if ((m = h.match(/^#\/search\/(.+)$/))) { renderSearch(content, decodeURIComponent(m[1])); return; }
  renderHome(content);
}

/* ---------------- 首页 ---------------- */
function renderHome(c) {
  const docs = Object.values(DATA.docs);
  const ruleCount = docs.reduce((n, d) => n + (d.blocks || []).filter(b => b.type === 'rule').length, 0);
  const checkCount = docs.reduce((n, d) => n + (d.blocks || []).filter(b => b.type === 'checklist').reduce((m, cb) => m + (cb.items || []).length, 0), 0);
  const groups = {};
  DATA.parts.forEach(p => { (groups[p.group] = groups[p.group] || []).push(p); });

  c.innerHTML = `
    <div class="page-head">
      <div class="page-title">电池包零部件设计规范 · 在线自查库</div>
      <div class="page-desc">按制造工艺与零件类型分类的设计规范集 —— 设计阶段查阅、图纸下发前自查，减少 DFM 问题与反复改图。</div>
    </div>
    <div class="stat-row">
      <div class="stat"><div class="num">${docs.length}</div><div class="lbl">份设计规范</div></div>
      <div class="stat"><div class="num">${ruleCount}</div><div class="lbl">条设计规则</div></div>
      <div class="stat"><div class="num">${DATA.parts.length}</div><div class="lbl">个零件类型</div></div>
      <div class="stat"><div class="num">${checkCount}</div><div class="lbl">项自查条目</div></div>
    </div>

    <div class="sec-title"><span class="bar"></span>防腐位置分级总则（所有零件的表面处理都从这里出发）</div>
    <div class="grid cols-2">
      ${['p1', 'p2', 'p3', 'p4'].map(pid => {
        const e = DATA.surface.environments.find(x => x.id === pid);
        return `<div class="card pad"><div class="card-title">${esc(e.name)}　<span class="badge ${pid === 'p1' ? 'must' : pid === 'p4' ? 'rec' : ''}">${esc(e.nss)}</span></div>
        <div class="muted">${esc(e.desc)}</div></div>`;
      }).join('')}
      <div class="card pad"><div class="card-title">⚡ 导电/搭铁面 <span class="badge must">720h 无红锈</span></div>
      <div class="muted">搭铁螺孔、busbar 连接面、屏蔽环接面：镀锌镍/镀锡/镀银，禁用不导电涂层。</div></div>
      <div class="card pad"><div class="card-title">🔗 快捷工具</div>
      <div class="muted" style="margin-bottom:10px">不确定零件该做什么表面处理？用选型器一键得出推荐。</div>
      <a class="btn" href="#/surface">打开表面处理选型器 →</a>
      <a class="btn ghost" href="#/checklist" style="margin-left:8px">图纸下发前自查 →</a></div>
    </div>

    <div class="sec-title"><span class="bar"></span>按制造工艺分类（${docs.length} 份规范）</div>
    <div class="grid cols-2">
      ${Object.keys(CAT_LABELS).map(cat => {
        const ids = CAT_LABELS[cat].filter(id => DATA.docs[id]);
        return ids.map(id => {
          const d = DATA.docs[id];
          return `<a class="doc-card" href="#/doc/${id}">
            <div class="dc-no">${esc(d.doc_no)} · ${CAT_ICONS[cat]} ${cat}</div>
            <div class="dc-title">${esc(d.title)}</div>
            <div class="dc-sub">${esc(d.subtitle || d.applies_to.join('、'))}</div>
          </a>`;
        }).join('');
      }).join('')}
    </div>

    <div class="sec-title"><span class="bar"></span>按零件类型检索</div>
    ${Object.keys(groups).map(g => `
      <h3 style="font-size:15px;margin:16px 0 10px;color:var(--brand-dark)">${esc(g)}</h3>
      <div class="grid cols-3">
        ${groups[g].map(p => partCard(p)).join('')}
      </div>`).join('')}
  `;
}

function partCard(p) {
  const envCls = p.env === '包外' ? 'env-out' : p.env === '包内' ? 'env-in' : 'env-both';
  return `<a class="part-card" href="#/parts/${encodeURIComponent(p.name)}">
    <div class="pc-name">${esc(p.name)}</div>
    <div class="pc-note">${esc(p.note)}</div>
    <div class="pc-docs">
      <span class="chip ${envCls}">${esc(p.env)}</span>
      ${p.docs.slice(0, 3).map(id => `<span class="chip">${esc(docShort(id))}</span>`).join('')}
    </div>
  </a>`;
}

function docShort(id) {
  const d = DATA.docs[id];
  if (!d) return id;
  return d.title.replace('设计规范', '').replace('选用规范', '').replace('与防腐设计规范', '').replace('与导热材料', '');
}

/* ---------------- 文档页 ---------------- */
function renderDoc(c, id) {
  const d = DATA.docs[id];
  if (!d) { c.innerHTML = `<div class="empty">未找到规范 ${esc(id)}（内容文件缺失）</div>`; return; }
  const cat = Object.keys(CAT_LABELS).find(k => CAT_LABELS[k].includes(id));
  const ruleN = (d.blocks || []).filter(b => b.type === 'rule').length;
  const mustN = (d.blocks || []).filter(b => b.type === 'rule' && b.level === '强制').length;
  const checkN = (d.blocks || []).filter(b => b.type === 'checklist').reduce((n, cb) => n + (cb.items || []).length, 0);

  c.innerHTML = `
    <div class="crumb"><a href="#/home">首页</a> / ${esc(cat || '')} / ${esc(d.title)}</div>
    <div class="doc-header">
      <div class="dh-no">${esc(d.doc_no)} · ${esc(d.process)} · 版本 A/0</div>
      <h1>${esc(d.title)}</h1>
      <div class="dh-sub">${esc(d.subtitle || '')}</div>
      <div class="dh-meta">
        <span class="chip">📐 ${ruleN} 条规则</span>
        <span class="chip">🔴 强制 ${mustN}</span>
        <span class="chip">☑ 自查 ${checkN} 项</span>
        ${(d.applies_to || []).slice(0, 6).map(x => `<span class="chip">${esc(x)}</span>`).join('')}
      </div>
    </div>
    <div class="doc-tabs">
      <a href="#/doc/${id}#sec-norm">规范正文</a>
      <a href="#/doc/${id}#sec-check">自查清单</a>
      <a href="#/doc/${id}#sec-mistake">常见错误</a>
      <a href="#/doc/${id}#sec-surface">表面处理</a>
      <a href="#/doc/${id}#sec-check-live">☑ 在线打勾自查</a>
    </div>
    <div class="doc-section" id="sec-norm">${renderBlocks(d.blocks || [])}</div>
    ${(d.mistakes || []).length ? `
    <div class="doc-section" id="sec-mistake">
      <h2>常见设计错误与纠正</h2>
      <ol style="padding-left:22px">${d.mistakes.map(m => `<li style="margin-bottom:8px">${esc(m)}</li>`).join('')}</ol>
    </div>` : ''}
    <div class="doc-section" id="sec-surface">
      <h2>表面处理与防腐要求</h2>
      ${renderSurfaceTable(d.surface)}
      <div class="callout tip"><b>💡</b>完整选型逻辑与工艺对比见 <a href="#/surface">表面处理选型器</a>（按 P1~P4 位置分级 + 材料 + 导电需求推荐）。</div>
    </div>
    <div class="doc-section" id="sec-check-live">
      <h2>在线自查清单（打勾自动保存）</h2>
      ${renderLiveCheck(id)}
    </div>
    ${(d.sources || []).length ? `
    <div class="doc-section" id="sec-src">
      <h2>编制参考来源</h2>
      <ul>${d.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>` : ''}
    <div style="display:flex;gap:10px;margin-top:6px">
      <button class="btn ghost" onclick="window.print()">🖨 打印本页</button>
      <a class="btn ghost" href="#/home">← 返回首页</a>
    </div>
  `;
}

function renderBlocks(blocks) {
  let html = '', lastWasTable = false;
  blocks.forEach(b => {
    const t = b.type;
    if (t === 'h1') { html += `<h2 class="anchor" id="b-${esc(b.no || '')}">${esc(b.no || '')} ${esc(b.title || '')}</h2>`; lastWasTable = false; }
    else if (t === 'h2') { html += `<h3>${esc(b.no || '')} ${esc(b.title || '')}</h3>`; lastWasTable = false; }
    else if (t === 'h3') { html += `<h4 style="font-size:14.5px;margin:14px 0 6px">${esc(b.no || '')} ${esc(b.title || '')}</h4>`; lastWasTable = false; }
    else if (t === 'p') { html += `<p>${esc(b.text)}</p>`; lastWasTable = false; }
    else if (t === 'table') {
      html += `<div class="tbl-wrap"><table class="tbl">${b.caption ? `<caption>${esc(b.caption)}</caption>` : ''}
        <thead><tr>${b.header.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${(b.rows || []).map(r => `<tr>${b.header.map((_, j) => `<td>${esc(r[j] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`; lastWasTable = true;
    }
    else if (t === 'rule') { html += renderRule(b); lastWasTable = false; }
    else if (t === 'warn') { html += `<div class="callout warn"><b>⚠ 警告</b>${esc(b.text)}</div>`; lastWasTable = false; }
    else if (t === 'tip') { html += `<div class="callout tip"><b>💡 提示</b>${esc(b.text)}</div>`; lastWasTable = false; }
    else if (t === 'checklist') {
      html += `<div class="check-group" id="sec-check"><h4>${esc(b.title || '自查清单')}</h4>`;
      html += `<div class="ci-live">${(b.items || []).map((it, i) => `<label class="check-item" data-ck="${esc(b.title)}|${esc(it)}">
        <input type="checkbox" onchange="toggleCk(this)"><span class="ci-text">${esc(it)}</span></label>`).join('')}</div></div>`;
      lastWasTable = false;
    }
  });
  return html;
}

function renderRule(r) {
  const lvl = r.level === '强制' ? 'must' : 'rec';
  return `<div class="rule ${lvl}" id="rule-${esc(r.id || '')}">
    <div class="rule-head">
      <span class="rule-id">${esc(r.id || '')}</span>
      <span class="badge ${lvl}">${esc(r.level || '推荐')}</span>
      <span class="rule-title">${esc(r.title || '')}</span>
    </div>
    <div class="rule-body">
      ${r.spec ? `<div class="rb-line"><b>📏 规格</b>${esc(r.spec)}</div>` : ''}
      ${r.text ? `<div class="rb-line"><b>📌 要求</b>${esc(r.text)}</div>` : ''}
      ${r.wrong ? `<div class="rb-wrong">${esc(r.wrong)}</div>` : ''}
      ${r.right ? `<div class="rb-right">${esc(r.right)}</div>` : ''}
    </div>
  </div>`;
}

function renderSurfaceTable(surface) {
  if (!surface || !surface.length) return `<div class="muted">本文档涉及零件不做表面处理。</div>`;
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>零件位置</th><th>推荐表面处理</th><th>颜色</th><th>盐雾要求 (NSS)</th><th>说明</th></tr></thead>
    <tbody>${surface.map(s => `<tr><td>${esc(s.location)}</td><td>${esc(s.treatment)}</td><td>${esc(s.color || '')}</td><td>${esc(s.nss || '')}</td><td>${esc(s.note || '')}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

/* 在线打勾（localStorage 持久化，键含文档 id） */
function renderLiveCheck(id) {
  const d = DATA.docs[id];
  const groups = (d.blocks || []).filter(b => b.type === 'checklist');
  if (!groups.length) return `<div class="muted">本文档暂无自查清单。</div>`;
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return `
    <div class="check-progress" id="ckBar-${id}">
      <span style="font-size:13px;color:var(--ink-2)">本规范自查进度</span>
      <div class="bar"><i id="ckFill-${id}" style="width:0%"></i></div>
      <span class="pct" id="ckPct-${id}">0/${total}</span>
      <button class="btn ghost" style="font-size:12.5px;padding:5px 14px" onclick="resetCk('${id}')">重置</button>
    </div>
    ${groups.map(g => `
      <div class="check-group"><h4>${esc(g.title || '自查清单')}</h4>
      ${g.items.map(it => `<label class="check-item" data-doc="${id}" data-key="${esc(g.title)}|${esc(it)}">
        <input type="checkbox" onchange="toggleCk(this,'${id}')"><span class="ci-text">${esc(it)}</span></label>`).join('')}
      </div>`).join('')}
  `;
}

function ckStore(docId) { return 'mlck:' + docId; }
function toggleCk(el, docId) {
  const item = el.closest('.check-item');
  const key = item.dataset.key;
  let store = {};
  try { store = JSON.parse(localStorage.getItem(ckStore(docId)) || '{}'); } catch (e) {}
  store[key] = el.checked;
  localStorage.setItem(ckStore(docId), JSON.stringify(store));
  item.classList.toggle('checked', el.checked);
  updateCkBar(docId);
}
function resetCk(docId) {
  localStorage.removeItem(ckStore(docId));
  document.querySelectorAll(`.check-item[data-doc="${docId}"]`).forEach(it => {
    it.classList.remove('checked');
    const cb = it.querySelector('input'); if (cb) cb.checked = false;
  });
  updateCkBar(docId);
  toast('已重置本规范自查进度');
}
function updateCkBar(docId) {
  const items = document.querySelectorAll(`.check-item[data-doc="${docId}"]`);
  if (!items.length) return;
  let store = {};
  try { store = JSON.parse(localStorage.getItem(ckStore(docId)) || '{}'); } catch (e) {}
  let done = 0;
  items.forEach(it => {
    const cb = it.querySelector('input');
    const on = !!store[it.dataset.key];
    cb.checked = on;
    it.classList.toggle('checked', on);
    if (on) done++;
  });
  const fill = $('#ckFill-' + docId), pct = $('#ckPct-' + docId);
  if (fill) fill.style.width = (done / items.length * 100) + '%';
  if (pct) pct.textContent = `${done}/${items.length}`;
}

/* ---------------- 零件检索 ---------------- */
function renderParts(c, name) {
  if (name) {
    const p = DATA.parts.find(x => x.name === name);
    if (!p) { c.innerHTML = `<div class="empty">未找到零件：${esc(name)}</div>`; return; }
    c.innerHTML = `
      <div class="crumb"><a href="#/home">首页</a> / <a href="#/parts">零件检索</a> / ${esc(p.name)}</div>
      <div class="page-head">
        <div class="page-title">${esc(p.name)}</div>
        <div class="page-desc">${esc(p.note)}</div>
      </div>
      <div class="doc-tabs">${p.docs.map(id => `<a href="#/doc/${id}">${esc(docShort(id))}</a>`).join('')}</div>
      <div class="grid cols-2">
      ${p.docs.map(id => {
        const d = DATA.docs[id];
        if (!d) return '';
        const must = (d.blocks || []).filter(b => b.type === 'rule' && b.level === '强制').length;
        return `<a class="doc-card" href="#/doc/${id}">
          <div class="dc-no">${esc(d.doc_no)}</div>
          <div class="dc-title">${esc(d.title)}</div>
          <div class="dc-sub">${must} 条强制规则 · ${(d.blocks || []).filter(b => b.type === 'rule').length} 条规则 · 附自查清单</div>
        </a>`;
      }).join('')}
      </div>
      <div class="callout tip"><b>💡</b>防腐提醒：本零件位于「${esc(p.env)}」，请按 <a href="#/surface">表面处理选型器</a> 的 P1~P4 分级选择涂层与盐雾要求。</div>
    `;
    return;
  }
  const groups = {};
  DATA.parts.forEach(p => { (groups[p.group] = groups[p.group] || []).push(p); });
  c.innerHTML = `
    <div class="page-head">
      <div class="page-title">零件检索</div>
      <div class="page-desc">${DATA.parts.length} 种电池包零件 → 对应设计规范索引。点零件看它需要遵守哪些规范。</div>
    </div>
    ${Object.keys(groups).map(g => `
      <div class="sec-title"><span class="bar"></span>${esc(g)}</div>
      <div class="grid cols-3">${groups[g].map(partCard).join('')}</div>`).join('')}
  `;
}

/* ---------------- 表面处理选型器 ---------------- */
function renderSurface(c) {
  const S = DATA.surface;
  c.innerHTML = `
    <div class="page-head">
      <div class="page-title">表面处理选型器</div>
      <div class="page-desc">按「安装位置（P1~P4）→ 材料 → 是否导电面」三步选择，下方给出推荐处理方式。包外件与包内件防腐要求不同，切勿混用。</div>
    </div>
    <div class="selector">
      <div class="card pad sel-panel">
        <div class="sel-group">
          <div class="sg-label">① 安装位置</div>
          <div class="sel-opts" id="selEnv">
            ${S.environments.map(e => `<button class="sel-opt" data-e="${e.id}" onclick="selSet('env','${e.id}')">${esc(e.name)}</button>`).join('')}
          </div>
          <div class="muted" id="envDesc" style="margin-top:8px">点击上方位置查看说明</div>
        </div>
        <div class="sel-group">
          <div class="sg-label">② 零件材料</div>
          <div class="sel-opts" id="selMat">
            ${S.materials.map(m => `<button class="sel-opt" data-m="${m.id}" onclick="selSet('mat','${m.id}')">${esc(m.name)}</button>`).join('')}
          </div>
        </div>
        <div class="sel-group">
          <div class="sg-label">③ 是否导电/搭铁面</div>
          <div class="sel-opts" id="selCond">
            <button class="sel-opt" data-c="yes" onclick="selSet('cond','yes')">是（需导电）</button>
            <button class="sel-opt" data-c="no" onclick="selSet('cond','no')">否</button>
          </div>
        </div>
        <div class="sel-group">
          <div class="sg-label">④ 特殊条件（可选）</div>
          <div class="sel-opts" id="selX">
            <button class="sel-opt" data-x="high-temp" onclick="selToggle('x','high-temp')">温度 &gt;150°C</button>
            <button class="sel-opt" data-x="stone" onclick="selToggle('x','stone')">需耐石击</button>
            <button class="sel-opt" data-x="weld" onclick="selToggle('x','weld')">后续要焊接</button>
            <button class="sel-opt" data-x="hs" onclick="selToggle('x','hs')">≥10.9级高强度件</button>
          </div>
        </div>
      </div>
      <div>
        <div id="selResult"><div class="empty">请先在左侧选择位置与材料</div></div>
        <div class="sec-title"><span class="bar"></span>选型铁律（务必记住）</div>
        ${S.rules.map(r => `<div class="callout warn" style="background:#fff;border:1px solid var(--line)"><b>⚖ ${esc(r.title)}</b>${esc(r.text)}</div>`).join('')}
      </div>
    </div>
  `;
  selState = {};
  syncSelUI();
}

let selState = {};
function selSet(k, v) {
  if (k === 'env') { selState.env = v; const e = DATA.surface.environments.find(x => x.id === v); $('#envDesc').textContent = e ? `${e.desc}（要求：${e.nss}）` : ''; }
  if (k === 'mat') selState.mat = v;
  if (k === 'cond') selState.cond = v;
  syncSelUI();
  runSelector();
}
function selToggle(k, v) {
  selState[k] = selState[k] || [];
  const i = selState[k].indexOf(v);
  if (i >= 0) selState[k].splice(i, 1); else selState[k].push(v);
  syncSelUI();
  runSelector();
}
function syncSelUI() {
  document.querySelectorAll('#selEnv .sel-opt').forEach(b => b.classList.toggle('active', b.dataset.e === selState.env));
  document.querySelectorAll('#selMat .sel-opt').forEach(b => b.classList.toggle('active', b.dataset.m === selState.mat));
  document.querySelectorAll('#selCond .sel-opt').forEach(b => b.classList.toggle('active', b.dataset.c === selState.cond));
  const xs = selState.x || [];
  document.querySelectorAll('#selX .sel-opt').forEach(b => b.classList.toggle('active', xs.includes(b.dataset.x)));
}
function runSelector() {
  const box = $('#selResult');
  if (!box) return;
  if (!selState.env || !selState.mat) { box.innerHTML = `<div class="empty">请先在左侧选择①位置与②材料（③④可选）</div>`; return; }
  const S = DATA.surface;
  const env = selState.env;
  const list = S.treatments.filter(t =>
    t.materials.includes(selState.mat) && t.envs.includes(env)
  ).sort((a, b) => b.nss.localeCompare(a.nss, 'zh'));
  if (!list.length) {
    box.innerHTML = `<div class="empty">该材料在此位置无推荐处理方式（如塑料件一般不需要表面处理；若为不锈钢，请确认材料本身耐蚀等级即可）。</div>`;
    return;
  }
  const xs = selState.x || [];
  const e = S.environments.find(x => x.id === env);
  box.innerHTML = `
    <div class="card pad" style="margin-bottom:12px">
      <div class="card-title">推荐结果 <span class="badge must">${esc(e ? e.nss : '')}</span></div>
      <div class="muted">${esc(e ? e.desc : '')} · 按耐蚀能力从高到低排序</div>
    </div>
    ${list.map(t => {
      const flags = [];
      if (selState.cond === 'yes' && !t.conductive) flags.push(['不导电！导电面禁用', 'must']);
      if (xs.includes('high-temp') && t.tempMax < 150) flags.push([`耐温仅${t.tempMax}°C`, 'must']);
      if (xs.includes('hs') && t.id === 'zinc-plating') flags.push(['高强度件有氢脆风险，需除氢或改锌铝涂层', 'must']);
      if (xs.includes('weld') && ['anodize-natural', 'anodize-black', 'powder', 'zinc-plating'].includes(t.id)) flags.push(['该涂层不可直接焊接', 'must']);
      if (xs.includes('stone') && env === 'p1' && t.id === 'ed-coating') flags.push(['不耐石击，需电泳+喷粉复合', 'must']);
      return `<div class="treat-card">
        <div class="tc-head"><span class="tc-name">${esc(t.name)}</span>
          ${t.conductive ? '<span class="chip">⚡ 导电</span>' : '<span class="chip">绝缘涂层</span>'}
          ${flags.map(f => `<span class="badge ${f[1]}">${esc(f[0])}</span>`).join('')}
        </div>
        <div class="tc-meta">
          <span class="kv">盐雾 <b>${esc(t.nss)}</b></span>
          <span class="kv">膜厚 <b>${esc(t.thickness)}</b></span>
          <span class="kv">颜色 <b>${esc(t.color)}</b></span>
          <span class="kv">耐温 <b>${esc(t.tempMax)}°C</b></span>
          <span class="kv">成本 <b>${esc(t.cost)}</b></span>
        </div>
        <div class="tc-pros">✅ ${esc(t.pros)}</div>
        <div class="tc-cons">⚠ ${esc(t.cons)}</div>
        <div class="tc-note">💡 ${esc(t.note)}</div>
      </div>`;
    }).join('')}
  `;
}

/* ---------------- 自查清单聚合页 ---------------- */
function renderChecklist(c, id) {
  if (id) { renderDocChecklistOnly(c, id); return; }
  const docs = Object.values(DATA.docs).filter(d => (d.blocks || []).some(b => b.type === 'checklist'));
  c.innerHTML = `
    <div class="page-head">
      <div class="page-title">在线自查清单</div>
      <div class="page-desc">选择零件或规范，逐项打勾自查；进度自动保存在本机浏览器，图纸下发前打开核对一遍即可。</div>
    </div>
    <div class="grid cols-2">
      ${DATA.parts.map(p => {
        const ids = p.docs.filter(id => DATA.docs[id] && (DATA.docs[id].blocks || []).some(b => b.type === 'checklist'));
        if (!ids.length) return '';
        return `<a class="doc-card" href="#/checklist/${ids[0]}">
          <div class="dc-title">${esc(p.name)}</div>
          <div class="dc-sub">涉及 ${ids.length} 份规范的自查清单，点此开始逐份打勾</div>
        </a>`;
      }).join('')}
    </div>
  `;
}

function renderDocChecklistOnly(c, id) {
  const d = DATA.docs[id];
  if (!d) { c.innerHTML = `<div class="empty">未找到规范</div>`; return; }
  c.innerHTML = `
    <div class="crumb"><a href="#/home">首页</a> / <a href="#/checklist">自查清单</a> / ${esc(d.title)}</div>
    <div class="page-head"><div class="page-title">☑ ${esc(d.title)} · 自查清单</div>
    <div class="page-desc">逐项打勾，进度自动保存。<a href="#/doc/${id}">查看规范正文 →</a></div></div>
    <div class="doc-section">${renderLiveCheck(id)}</div>
  `;
  updateCkBar(id);
}

/* ---------------- 搜索 ---------------- */
let searchIndex = null;
function buildIndex() {
  if (searchIndex) return searchIndex;
  searchIndex = [];
  const add = (d, type, text, anchor, title) => {
    if (!text) return;
    searchIndex.push({ type, text: String(text), doc: d.id, docTitle: d.title, docNo: d.doc_no, anchor, title });
  };
  Object.values(DATA.docs).forEach(d => {
    add(d, 'doc', d.title + ' ' + d.subtitle, '', d.title);
    (d.applies_to || []).forEach(a => add(d, 'doc', a, '', d.title));
    (d.blocks || []).forEach(b => {
      if (b.type === 'rule') add(d, 'rule', b.id + ' ' + b.title + ' ' + b.spec + ' ' + b.text + ' ' + b.wrong + ' ' + b.right, 'rule-' + b.id, b.title);
      else if (b.type === 'table') add(d, 'table', b.caption + ' ' + b.header.join(' ') + ' ' + (b.rows || []).flat().join(' '), '', b.caption);
      else if (b.type === 'p') add(d, 'p', b.text, '', b.text.slice(0, 40));
      else if (b.type === 'h1' || b.type === 'h2') add(d, 'h', b.title, '', b.title);
      else if (b.type === 'checklist') add(d, 'ck', (b.items || []).join(' '), '', b.title);
    });
    (d.mistakes || []).forEach(m => add(d, 'mistake', m, '', '常见错误'));
  });
  DATA.parts.forEach(p => {
    if (!p || !p.name) return;
    searchIndex.push({ type: 'part', text: p.name + ' ' + (p.note || '') + ' ' + (p.docs || []).join(' '), doc: 'overview', docTitle: '总览与使用指南', docNo: 'ML-DR-00', anchor: '', title: p.name });
  });
  return searchIndex;
}

function doSearch(q) {
  q = q.trim();
  const box = $('#searchResults');
  if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
  const idx = buildIndex();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = idx.map(ent => {
    const t = ent.text.toLowerCase();
    let score = 0, hitAll = true;
    terms.forEach(term => {
      if (t.includes(term)) score += term.length >= 2 ? 2 : 1;
      else hitAll = false;
    });
    const boost = { rule: 3, part: 2, doc: 4, mistake: 1 }[ent.type] || 0;
    return { ent, score: score + boost, hitAll };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 24);
  if (!scored.length) { box.innerHTML = `<div class="search-empty">无匹配结果，换个关键词试试（如：折弯半径 / 压缩率 / 爬电距离 / 达克罗）</div>`; box.classList.add('open'); return; }
  const seen = new Set();
  box.innerHTML = scored.filter(x => { const k = x.ent.doc + '|' + x.ent.anchor; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 14).map(({ ent }) => {
    let snip = ent.text.slice(0, 90);
    terms.forEach(tm => {
      const re = new RegExp(`(${tm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      snip = snip.replace(re, '<mark>$1</mark>');
    });
    const href = ent.anchor ? `#/doc/${ent.doc}#${ent.anchor}` : `#/doc/${ent.doc}`;
    return `<a class="search-item" href="${href}" onclick="location.hash='${href}'">
      <div class="s-title">${esc(ent.title || ent.text.slice(0, 30))}</div>
      <div class="s-doc">${esc(ent.docNo)} ${esc(ent.docTitle)}</div>
      <div class="s-snip">${snip}</div>
    </a>`;
  }).join('');
  box.classList.add('open');
}

function renderSearch(c, q) {
  const idx = buildIndex();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = idx.filter(ent => terms.every(tm => ent.text.toLowerCase().includes(tm)))
    .sort((a, b) => (b.type === 'rule' ? 1 : 0) - (a.type === 'rule' ? 1 : 0)).slice(0, 60);
  c.innerHTML = `
    <div class="page-head"><div class="page-title">搜索：${esc(q)}</div>
    <div class="page-desc">共 ${hits.length} 条匹配（规则条目优先）</div></div>
    ${hits.length ? `<div class="doc-section">${hits.slice(0, 40).map(ent => `
      <div class="card pad" style="margin-bottom:10px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <a href="#/doc/${ent.doc}${ent.anchor ? '#' + ent.anchor : ''}" style="font-weight:700;color:var(--brand);text-decoration:none">${esc(ent.title || ent.docTitle)}</a>
          <span class="chip">${esc(ent.docNo)} ${esc(ent.docTitle)}</span>
        </div>
        <div class="muted" style="margin-top:4px">${esc(ent.text.slice(0, 160))}…</div>
      </div>`).join('')}</div>` : `<div class="empty">无匹配结果</div>`}
  `;
}

/* ---------------- 变更验证查字典 ---------------- */
let chgState = { cat: null, types: new Set() };
function renderChange(c) {
  const CH = DATA.change;
  if (!CH) { c.innerHTML = `<div class="empty">变更验证数据缺失</div>`; return; }
  if (!chgState.cat) chgState.cat = CH.categories[0].id;
  c.innerHTML = `
    <div class="page-head">
      <div class="page-title">变更验证查字典</div>
      <div class="page-desc">选择零件类别与变更类型（可多选），自动生成验证活动清单（零件级→装配级→Pack级）、PPAP要求与流程步骤。依据《变更验证管理办法 ML-GL-01》。</div>
    </div>
    <div class="selector">
      <div class="card pad sel-panel">
        <div class="sel-group"><div class="sg-label">① 零件类别</div>
          <select id="chgCat" onchange="chgCatChange(this.value)" style="width:100%;padding:9px 12px;border:1.5px solid var(--line);border-radius:8px;font-size:13.5px">
            ${CH.categories.map(x => `<option value="${x.id}" ${x.id === chgState.cat ? 'selected' : ''}>[${x.level}] ${esc(x.name)}</option>`).join('')}
          </select>
          <div class="muted" id="chgCatNote" style="margin-top:6px"></div>
        </div>
        <div class="sel-group"><div class="sg-label">② 变更类型（可多选）</div>
          <div class="sel-opts" style="flex-direction:column;align-items:stretch">
            ${CH.changeTypes.map(t => `<label class="check-item" style="margin-bottom:4px;padding:7px 10px;font-size:13.5px">
              <input type="checkbox" data-t="${t.id}" onchange="chgTypeToggle(this)" ${chgState.types.has(t.id) ? 'checked' : ''}>
              <span class="ci-text"><b>${esc(t.name)}</b><br><span class="muted">${esc(t.desc)}</span></span></label>`).join('')}
          </div>
        </div>
      </div>
      <div id="chgResult"></div>
    </div>
  `;
  chgCatChange(chgState.cat);
}
function chgCatChange(id) {
  chgState.cat = id;
  const CH = DATA.change;
  const cat = CH.categories.find(x => x.id === id);
  const note = document.getElementById('chgCatNote');
  if (note) note.textContent = (CH.levels[cat.level] || {}).desc || '';
  runChg();
}
function chgTypeToggle(el) {
  if (el.checked) chgState.types.add(el.dataset.t); else chgState.types.delete(el.dataset.t);
  runChg();
}
function runChg() {
  const box = document.getElementById('chgResult');
  if (!box || !chgState.cat) return;
  const CH = DATA.change;
  const cat = CH.categories.find(x => x.id === chgState.cat);
  if (!chgState.types.size) {
    box.innerHTML = `<div class="card pad"><div class="card-title">📌 ${esc(cat.name)} · 安全等级 <span class="badge ${CH.levels[cat.level].color}">${cat.level} ${CH.levels[cat.level].name}</span></div>
      <div class="muted">${esc(CH.levels[cat.level].desc)}。请在左侧勾选变更类型以生成验证清单。</div></div>`;
    return;
  }
  const act = a => CH.activities.find(x => x.id === a);
  const partSet = new Set(), asmSet = new Set(), packSet = new Set();
  const conds = [];
  const typesSel = [...chgState.types].map(t => CH.changeTypes.find(x => x.id === t));
  typesSel.forEach(t => {
    const m = CH.matrix[t.id][cat.level];
    m.part.forEach(x => partSet.add(x));
    m.assembly.forEach(x => asmSet.add(x));
    m.pack.forEach(x => packSet.add(x));
    if (m.cond) conds.push(`<b>${t.name}</b>：${m.cond}`);
  });
  const group = (set, title, icon) => set.size ? `
    <div class="sec-title"><span class="bar"></span>${icon} ${title}（${set.size} 项）</div>
    ${[...set].map(id => {
      const a = act(id);
      return `<div class="treat-card" style="padding:12px 15px">
        <div class="tc-head"><span class="rule-id">${a.id}</span><span class="tc-name" style="font-size:14.5px">${esc(a.name)}</span></div>
        <div class="tc-meta"><span class="kv">方法 <b>${esc(a.method)}</b></span><span class="kv">标准 <b>${esc(a.standard)}</b></span></div>
        <div class="muted">📄 输出物：${esc(a.output)}</div>
      </div>`;
    }).join('')}` : '';
  const supplier = chgState.types.has('supplier');
  box.innerHTML = `
    <div class="card pad" style="margin-bottom:12px">
      <div class="card-title">判定结果：${esc(cat.name)} · 安全等级 <span class="badge ${CH.levels[cat.level].color}">${cat.level} ${CH.levels[cat.level].name}</span></div>
      <div class="muted">变更类型：${typesSel.map(t => esc(t.name)).join('、')}　|　验证级别取并集，安全等级取最高级</div>
      <div style="margin-top:10px"><button class="btn" onclick="copyChg()">📋 复制验证清单（可直接进变更申请单）</button></div>
    </div>
    ${group(partSet, '零件级验证', '🔧')}
    ${group(asmSet, '装配级验证（试装）', '🧩')}
    ${group(packSet, 'Pack级验证', '🔋')}
    ${packSet.size ? `<div class="callout warn"><b>⚠</b>Pack级验证样件数：S级材料/工艺/供应商变更建议≥3台份，其余≥1台份或按评审。</div>` : ''}
    ${supplier ? `<div class="sec-title"><span class="bar"></span>📦 供应商提交要求（PPAP）</div>
      <div class="callout" style="background:#fff;border:1px solid var(--line)">${esc(CH.supplierDocs[cat.level])}</div>` : ''}
    ${conds.length ? `<div class="sec-title"><span class="bar"></span>📌 条件与备注</div>${conds.map(x => `<div class="callout tip">${x}</div>`).join('')}` : ''}
    <div class="sec-title"><span class="bar"></span>📋 执行流程（十步法）</div>
    <table class="tbl"><thead><tr><th>步骤</th><th>输出物</th><th>责任人</th></tr></thead>
    <tbody>${CH.flow.map(f => `<tr><td>${esc(f.step)}</td><td>${esc(f.output)}</td><td>${esc(f.owner)}</td></tr>`).join('')}</tbody></table>
  `;
}
function copyChg() {
  const CH = DATA.change;
  const cat = CH.categories.find(x => x.id === chgState.cat);
  const typesSel = [...chgState.types].map(t => CH.changeTypes.find(x => x.id === t));
  const partSet = new Set(), asmSet = new Set(), packSet = new Set();
  typesSel.forEach(t => {
    const m = CH.matrix[t.id][cat.level];
    m.part.forEach(x => partSet.add(x)); m.assembly.forEach(x => asmSet.add(x)); m.pack.forEach(x => packSet.add(x));
  });
  const fmt = set => [...set].map(id => { const a = CH.activities.find(x => x.id === id); return `${a.id} ${a.name}（${a.standard}）`; }).join('\n');
  const txt = [
    `【变更验证清单】${cat.name}（安全等级 ${cat.level} ${CH.levels[cat.level].name}）`,
    `变更类型：${typesSel.map(t => t.name).join('、')}`,
    ``,
    `一、零件级验证：\n${fmt(partSet) || '（无）'}`,
    ``,
    `二、装配级验证（试装）：\n${fmt(asmSet) || '（无）'}`,
    ``,
    `三、Pack级验证：\n${fmt(packSet) || '（无）'}`,
    ``,
    chgState.types.has('supplier') ? `四、供应商提交（PPAP）：${CH.supplierDocs[cat.level]}` : '',
    ``,
    `五、流程：${CH.flow.map(f => f.step).join(' → ')}`,
  ].filter(x => x !== '').join('\n');
  navigator.clipboard.writeText(txt).then(() => toast('验证清单已复制到剪贴板'));
}

/* ---------------- 技术要求生成器 ---------------- */
let techState = { env: 'p3', supplier: true };
function renderTechspec(c, id) {
  const list = Object.values(DATA.techspec || {}).sort((a, b) => a.doc_no.localeCompare(b.doc_no));
  if (!id || !DATA.techspec[id]) {
    c.innerHTML = `
      <div class="page-head">
        <div class="page-title">技术要求生成器</div>
        <div class="page-desc">按物料大类选择通用技术要求（ML-TR 系列）：同一工艺的零件外形可变、验收条款不变。选定后可复制生成标准化技术要求文本，粘贴进图纸技术要求栏或作为供应商规格书。全套 Word 版见内部发放。</div>
      </div>
      <div class="grid cols-2">
        ${list.map(d => `<a class="doc-card" href="#/techspec/${d.id}">
          <div class="dc-no">${esc(d.doc_no)}</div>
          <div class="dc-title">${esc(d.title)}</div>
          <div class="dc-sub">${esc(d.subtitle || '')}</div>
        </a>`).join('')}
      </div>`;
    return;
  }
  const d = DATA.techspec[id];
  const S = DATA.surface;
  c.innerHTML = `
    <div class="crumb"><a href="#/home">首页</a> / <a href="#/techspec">技术要求生成器</a> / ${esc(d.title)}</div>
    <div class="page-head"><div class="page-title">${esc(d.doc_no)} ${esc(d.title)}</div>
    <div class="page-desc">${esc(d.subtitle || '')}</div></div>
    <div class="selector">
      <div class="card pad sel-panel">
        <div class="sel-group"><div class="sg-label">① 使用位置（防腐分级）</div>
          <div class="sel-opts" id="tsEnv">${S.environments.map(e => `<button class="sel-opt ${e.id === techState.env ? 'active' : ''}" data-e="${e.id}" onclick="techEnv('${e.id}')">${esc(e.name)}</button>`).join('')}</div>
        </div>
        <div class="sel-group"><div class="sg-label">② 输出选项</div>
          <label class="check-item" style="font-size:13.5px"><input type="checkbox" id="tsSup" ${techState.supplier ? 'checked' : ''} onchange="techState.supplier=this.checked"><span class="ci-text">包含供应商提交/变更要求（PPAP/FAI/COA）</span></label>
        </div>
        <div class="sel-group">
          <button class="btn" style="width:100%" onclick="copyTechspec('${d.id}')">📋 生成并复制技术要求文本</button>
          <div class="muted" style="margin-top:8px">复制内容=本文件全部章节 + 所选防腐位置条款；可直接粘贴进图纸『技术要求』栏，并注明"其余要求按 ${esc(d.doc_no)} 执行"。</div>
        </div>
        ${(d.surface || []).length ? `<div class="sel-group"><div class="sg-label">所选位置防腐条款预览</div>
          ${d.surface.filter(s => s.location.includes(techState.env.toUpperCase()) || s.location.includes('P1') && techState.env === 'p1' || s.location.includes('P2') && techState.env === 'p2' || s.location.includes('P3') && techState.env === 'p3' || s.location.includes('P4') && techState.env === 'p4').map(s => `<div class="treat-card" style="padding:10px 12px"><b>${esc(s.location)}</b>：${esc(s.treatment)}（${esc(s.nss)}）<div class="muted">${esc(s.note || '')}</div></div>`).join('') || `<div class="muted">无</div>`}</div>` : ''}
      </div>
      <div>
        <div class="doc-section">${renderBlocks(d.blocks || [])}</div>
        ${(d.mistakes || []).length ? `<div class="doc-section"><h2>供应商常见违规点（验收红线）</h2><ol style="padding-left:22px">${d.mistakes.map(m => `<li style="margin-bottom:8px">${esc(m)}</li>`).join('')}</ol></div>` : ''}
        ${(d.sources || []).length ? `<div class="doc-section"><h2>引用标准与来源</h2><ul>${d.sources.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      </div>
    </div>
  `;
}
function techEnv(id) { techState.env = id; document.querySelectorAll('#tsEnv .sel-opt').forEach(b => b.classList.toggle('active', b.dataset.e === id)); }
function copyTechspec(id) {
  const d = DATA.techspec[id];
  const env = DATA.surface.environments.find(e => e.id === techState.env);
  const lines = [];
  lines.push(`【${d.doc_no} ${d.title}】`);
  if (d.subtitle) lines.push(d.subtitle);
  lines.push('');
  for (const b of d.blocks || []) {
    if (b.type === 'h1') lines.push(`\n${b.no || ''} ${b.title || ''}`);
    else if (b.type === 'h2') lines.push(`\n${b.no || ''} ${b.title || ''}`);
    else if (b.type === 'p') lines.push(b.text);
    else if (b.type === 'table') {
      lines.push(`〔${b.caption || ''}〕`);
      lines.push(b.header.join(' | '));
      (b.rows || []).forEach(r => lines.push(r.join(' | ')));
    } else if (b.type === 'rule') {
      lines.push(`◆ ${b.level || ''} ${b.title || ''}：${b.spec ? '【' + b.spec + '】' : ''}${b.text || ''}`);
    } else if (b.type === 'warn') lines.push(`⚠ ${b.text}`);
    else if (b.type === 'tip') lines.push(`💡 ${b.text}`);
  }
  const surfRows = (d.surface || []).filter(s => s.location.toLowerCase().includes(techState.env));
  if (surfRows.length) {
    lines.push(`\n表面处理与防腐（${env.name}）：`);
    surfRows.forEach(s => lines.push(`· ${s.location}：${s.treatment}，${s.nss}。${s.note || ''}`));
  }
  lines.push('\n备注：其余要求按 ' + d.doc_no + ' 执行；图纸另有要求时以图纸为准。');
  const txt = lines.join('\n');
  navigator.clipboard.writeText(txt).then(() => toast('技术要求文本已复制到剪贴板'));
}

function renderAbout(c) {
  c.innerHTML = `
    <div class="page-head"><div class="page-title">使用说明</div></div>
    <div class="doc-section">
      <h2>这个库是什么</h2>
      <p>懋略设计规则库是电池系统设计部的零部件设计规范在线版，覆盖托盘、上盖、冷板、铝排/铜排、FPC、线束、高压电缆、BMU、紧固件、绝缘膜、胶粘剂、密封圈、水管、模组端板/拉条、塑胶件、气凝胶、保温棉、动力插头、温感等全部电池包零部件，共 ${Object.keys(DATA.docs).length} 份规范。</p>
      <h2>新人的标准用法（三步）</h2>
      <ul>
        <li><b>画图前</b>：在「零件检索」找到自己要设计的零件 → 打开对应规范通读一遍，重点看 <span class="badge must">强制</span> 规则；</li>
        <li><b>画图时</b>：用顶部搜索框随时查具体数值（如"折弯半径""压缩率""爬电距离"）；拿不准表面处理时用「表面处理选型器」；</li>
        <li><b>下发前</b>：打开「在线自查清单」逐项打勾，全部 <span class="badge must">强制</span> 项必须满足后才能提交评审。</li>
      </ul>
      <h2>规则分级说明</h2>
      <ul>
        <li><span class="badge must">强制</span> 涉及安全（高压绝缘、结构强度、密封、防火）与基本 DFM 底线，违反即打回；</li>
        <li><span class="badge rec">推荐</span> 影响良率、成本与一致性，不满足需在评审中书面说明理由。</li>
      </ul>
      <h2>防腐位置分级（最重要的一条总则）</h2>
      <p>包外件与包内件的防腐要求完全不同：<b>P1 包外裸露 ≥720h 盐雾，P3 包内 ≥240h，P4 包内干燥 ≥96h</b>。任何金属零件先定级、再选涂层，详细逻辑见「表面处理选型器」。</p>
      <h2>变更管理工具</h2>
      <ul>
        <li><b>变更验证查字典</b>：勾选零件类别+变更类型（材料/工艺/表面处理/供应商/配方/场地等），自动生成零件级→装配级→Pack级验证清单、PPAP要求与十步流程，依据《变更验证管理办法 ML-GL-01》；配套 Excel：output/变更验证Checklist.xlsx。</li>
        <li><b>技术要求生成器</b>：按物料大类（ML-TR-01~19）选择通用技术要求，勾选防腐位置后一键生成可复制的技术要求文本，粘贴进图纸技术要求栏，避免要求丢失。</li>
      </ul>
      <h2>配套 Word 文档</h2>
      <p>本网站全部内容同时输出为 Word 文档（格式与《电池系统紧固件选型规范_V1初版》一致），由设计部内部发放、打印与会签，不在本公开站点提供下载。</p>
      <h2>数据保护说明</h2>
      <p>本页面全部规范数据在服务器端以 AES-256-GCM 密文存储，密钥由访问令牌经 PBKDF2-SHA256 派生，进入页面后仅在浏览器内存中解密使用；未经授权禁止抓取、复制或转存本页面内容。</p>
    </div>
  `;
}

/* ---------------- 事件绑定 ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const lockInput = $('#lockInput');
  if (lockInput) {
    lockInput.addEventListener('keydown', lockInputKey);
    lockInput.focus();
  }
  window.addEventListener('hashchange', route);
  $('#searchInput').addEventListener('input', e => doSearch(e.target.value));
  $('#searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      location.hash = '#/search/' + encodeURIComponent(e.target.value.trim());
      $('#searchResults').classList.remove('open');
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) $('#searchResults').classList.remove('open');
    if (e.target.closest('#menuBtn')) $('#sidebar').classList.toggle('open');
  });
  // 跳转到锚点后高亮目标
  window.addEventListener('hashchange', () => {
    setTimeout(() => {
      const h = location.hash;
      const idx = h.indexOf('#rule-') >= 0 ? h.indexOf('#rule-') : h.indexOf('#b-');
      if (idx >= 0) {
        const el = document.getElementById(h.slice(idx + 1));
        if (el) { el.scrollIntoView(); el.style.boxShadow = '0 0 0 3px #fbbf24'; setTimeout(() => el.style.boxShadow = '', 2200); }
      }
    }, 80);
  });
});
