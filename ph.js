/* Tentart ERP — Xushnud buxgalteriyasi: Pul harakati + Qoldiq (Excel "ishlar_tartibi" asosida) */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (v) => Number(v) || 0;
  const OYLAR = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  const TURI = { prixod: 'Prixod', rasxod: 'Rasxod', ichki: "Ichki o'tkazma", hisob: 'Valyuta / hisob', eski_prixod: 'Eski prixod', eski_rasxod: 'Eski rasxod' };
  const TCLS = { prixod: 'b-tayyor', eski_prixod: 'b-tayyor', rasxod: 'b-chiq', eski_rasxod: 'b-chiq', ichki: 'b-smeta', hisob: 'b-olchov' };
  const YON = { asosiy: 'Pergola', qoshimcha: 'Oyna' };
  const BOSQICH = ['Avans', 'Avans1', 'Avans2', 'Avans3', 'Avans4', 'Ost'];
  const VIDLAR = ['Metall', 'Metallchiga', 'Optima oyna', 'Optima tovar', 'Star glass', 'Akfa', 'Lesa', 'Logo', 'Kassa', 'Oyna paketga', 'Tunuka', 'Oyna', 'Tikuvchiga', 'Taksi', 'Taksi zamirlar', 'Xostavar', 'Avans', 'Oylik', 'Benzin', 'Obed', 'Material', 'Kraska', 'Firmaga', 'Tovar', 'Gostinsa', 'Instrument', 'Kran', 'Selekon', 'Foyda', 'Target', 'Servizga', 'Kamisiya %'];
  const CU = () => { try { return curUser; } catch (e) { return null; } };
  const boss = () => ['Owner', 'Kassir'].includes(CU()?.rol);

  const PH = { rows: [], ham: [], tq: {}, loaded: false, loading: false, limit: 300,
    f: { oy: '', turi: '', yon: '', ham: '', q: '' }, mode: 'rasxod', edit: null, qf: { tur: 'all', oy: '', kun: '' } };
  window.PH = PH;

  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => ymd(new Date());
  const oyNom = (k) => OYLAR[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  const sanaF = (s) => { const [y, m, d] = String(s).split('-'); return `${+d} ${OYLAR[+m - 1].slice(0, 3).toLowerCase()}${y !== today().slice(0, 4) ? ' ' + y : ''}`; };
  const fUZS = (v) => Math.round(n0(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fUSD = (v) => { const x = Math.round(n0(v) * 100) / 100; const [a, b] = Math.abs(x).toFixed(2).split('.'); return (x < 0 ? '−' : '') + '$' + a.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (b === '00' ? '' : '.' + b); };
  const money = (v, cur) => (cur === 'usd' ? fUSD(v) : (n0(v) < 0 ? '−' : '') + fUZS(Math.abs(n0(v))) + " so'm");
  const hNom = (k) => (PH.ham.find((h) => h.kod === k) || {}).nom || k || '—';
  const hVal = (k) => (PH.ham.find((h) => h.kod === k) || {}).valyuta;
  const toast = (ic, t, s) => (typeof notif === 'function' ? notif(ic, t, s) : null);
  const lastKurs = () => { const r = PH.rows.find((x) => x.valyuta === 'uzs' && n0(x.kurs) > 0); return r ? n0(r.kurs) : 12000; };

  // ---------- yuklash ----------
  async function phLoad() {
    if (PH.loading) return; PH.loading = true;
    try {
      const { data: ham, error: e1 } = await db.from('hamyonlar').select('*').order('tartib').order('kod');
      if (e1) throw e1;
      const all = []; let from = 0;
      for (;;) {
        const { data, error } = await db.from('pul_harakati').select('*').order('sana', { ascending: false }).order('id', { ascending: false }).range(from, from + 999);
        if (error) throw error;
        all.push(...data); if (data.length < 1000) break; from += 1000;
      }
      PH.ham = ham || []; PH.rows = all.map((r) => ({ ...r, summa: n0(r.summa), summa_usd: r.summa_usd == null ? null : n0(r.summa_usd) }));
      const ids = [...new Set(PH.rows.filter((r) => r.manba === 'daftar' && r.manba_id).map((r) => r.manba_id))];
      PH.tq = {};
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await db.from('rasxod_yozuvlar').select('id,tasdiq,tasdiq_izoh').in('id', ids.slice(i, i + 300));
        (data || []).forEach((x) => { PH.tq[x.id] = x; });
      }
      const { data: ish } = await db.from('ishlar').select('*').order('id');
      PH.ish = ish || []; PH.agg = null;
      const [d1, d2, d3, d4] = await Promise.all([db.from('ih_davr').select('*').order('id'), db.from('ih_ishchi').select('*').order('tartib').order('id'),
        db.from('ih_ish').select('*').order('tartib').order('id'), db.from('oylik_xodim').select('*').order('tartib').order('id')]);
      PH.ihD = d1.data || []; PH.ihW = d2.data || []; PH.ihJ = d3.data || []; PH.oyl = d4.data || [];
      const [g1, g2, g3, g4, g5] = await Promise.all([db.from('rasxod_plan').select('*').order('tartib').order('id'), db.from('rasxod_reja').select('*').order('tartib').order('id'),
        db.from('bux_sozlama').select('*'), db.from('alohida_hisob').select('*').order('tartib').order('id'), db.from('alohida_hisob_ish').select('*').order('tartib').order('id')]);
      { const { data: ob } = await db.from('rasxod_obyektlar').select('id,nom,ish_id'); PH.obj = ob || []; }
      PH.plan = g1.data || []; PH.reja = g2.data || []; PH.soz = Object.fromEntries((g3.data || []).map((x) => [x.kalit, x.qiymat])); PH.ah = g4.data || []; PH.ahI = g5.data || [];
      PH.loaded = true;
    } catch (e) { console.error(e); toast('⚠️', 'Pul harakati yuklanmadi', e.message || ''); }
    PH.loading = false;
  }
  let _t; function sched() { clearTimeout(_t); _t = setTimeout(async () => { await phLoad(); phRender(); }, 600); }
  let subscribed = false;
  async function phStart() {
    if (!boss()) return;
    await phLoad();
    if (!subscribed) { subscribed = true; db.channel('ph').on('postgres_changes', { event: '*', schema: 'public', table: 'pul_harakati' }, sched).on('postgres_changes', { event: '*', schema: 'public', table: 'ishlar' }, sched).on('postgres_changes', { event: '*', schema: 'public', table: 'rasxod_obyektlar' }, sched).subscribe(); }
    phRender();
  }
  window.phRenderPage = async function (p) {
    if (!['panel', 'ph', 'qoldiq', 'ishlar', 'ishhaqqi', 'tahlil'].includes(p)) return;
    if (!PH.loaded) { $('ph-tbody') && ($('ph-tbody').innerHTML = '<tr><td colspan="9"><div class="empty"><div class="empty-t">Yuklanmoqda…</div></div></td></tr>'); await phStart(); }
    else phRender();
  };
  function phRender() {
    const p = document.querySelector('.ni.on')?.dataset.page;
    if (p === 'panel') renderPanel();
    if (p === 'ph') renderPH();
    if (p === 'qoldiq') renderQoldiq();
    if (p === 'ishlar') renderIshlar();
    if (p === 'ishhaqqi') renderIH();
    if (p === 'tahlil') renderTahlil();
  }

  // ---------- Pul harakati ----------
  function months() { const s = new Set(PH.rows.map((r) => String(r.sana).slice(0, 7))); s.add(today().slice(0, 7)); return [...s].sort().reverse(); }
  function filtered() {
    const f = PH.f; const q = f.q.trim().toLowerCase();
    return PH.rows.filter((r) => (!f.oy || String(r.sana).startsWith(f.oy))
      && (!f.turi || r.turi === f.turi || (f.turi === 'prixod' && r.turi === 'eski_prixod') || (f.turi === 'rasxod' && r.turi === 'eski_rasxod'))
      && (!f.yon || r.yonalish === f.yon)
      && (!f.ham || r.kimdan === f.ham || r.kimga === f.ham)
      && (!q || [r.zakaz, r.vid, r.izoh, r.oluvchi, hNom(r.kimdan), hNom(r.kimga)].some((x) => String(x || '').toLowerCase().includes(q))));
  }
  function tqBadge(r) {
    if (r.manba !== 'daftar') return r.manba === 'excel' ? '<span class="tag" style="background:#EFE8DA;color:#5E574C">EXCEL</span>' : r.manba === 'erp' ? '<span class="tag b-sayt">ERP</span>' : '<span class="tag b-bot">BOT</span>';
    const t = PH.tq[r.manba_id] || {};
    const c = t.tasdiq === 'tasdiqlandi' ? 'background:#E3EEE4;color:#2F6B45' : t.tasdiq === 'savol' ? 'background:#F4E1DC;color:#9A3B2E' : 'background:#EFE8DA;color:#7E5F25';
    const l = t.tasdiq === 'tasdiqlandi' ? 'DAFTAR ✓' : t.tasdiq === 'savol' ? 'DAFTAR ?' : 'DAFTAR';
    return `<span class="tag" style="${c}" title="${esc(t.tasdiq_izoh || '')}">${l}</span>`;
  }
  function renderPH() {
    if (!$('ph-tbody')) return;
    const ms = months();
    $('ph-oy').innerHTML = '<option value="">Hamma oylar</option>' + ms.map((m) => `<option value="${m}">${oyNom(m)}</option>`).join('');
    $('ph-oy').value = PH.f.oy;
    const hs = PH.ham.filter((h) => PH.rows.some((r) => r.kimdan === h.kod || r.kimga === h.kod));
    $('ph-ham').innerHTML = '<option value="">Barcha hamyonlar</option>' + hs.map((h) => `<option value="${esc(h.kod)}">${esc(h.nom)}</option>`).join('');
    $('ph-ham').value = PH.f.ham;
    document.querySelectorAll('#ph-turi button').forEach((b) => b.classList.toggle('on', b.dataset.v === PH.f.turi));
    document.querySelectorAll('#ph-yon button').forEach((b) => b.classList.toggle('on', b.dataset.v === PH.f.yon));

    const rows = filtered();
    const sIn = rows.filter((r) => r.turi === 'prixod' || r.turi === 'eski_prixod').reduce((a, r) => a + n0(r.summa_usd), 0);
    const sOut = rows.filter((r) => r.turi === 'rasxod' || r.turi === 'eski_rasxod').reduce((a, r) => a + n0(r.summa_usd), 0);
    const unt = PH.rows.filter((r) => r.manba === 'daftar' && (PH.tq[r.manba_id] || {}).tasdiq !== 'tasdiqlandi').length;
    $('ph-cards').innerHTML = `<div class="sc dark"><div class="sc-l">Prixod (tanlangan)</div><div class="sc-v">${esc(fUSD(sIn))}</div><div class="sc-s">dollar ekvivalentida</div></div>
      <div class="sc"><div class="sc-l">Rasxod (tanlangan)</div><div class="sc-v">${esc(fUSD(sOut))}</div><div class="sc-s">dollar ekvivalentida</div></div>
      <div class="sc"><div class="sc-l">Natija</div><div class="sc-v ${sIn - sOut >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${esc(fUSD(sIn - sOut))}</div><div class="sc-s">${rows.length} ta yozuv</div></div>
      <div class="sc"><div class="sc-l">Daftardan, tekshirilmagan</div><div class="sc-v">${unt}</div><div class="sc-s">${unt ? '<a href="/rasxod" style="color:inherit">Nazoratda tasdiqlang →</a>' : 'hammasi tekshirilgan'}</div></div>`;

    const show = rows.slice(0, PH.limit);
    $('ph-tbody').innerHTML = show.length ? show.map((r) => {
      const inn = r.turi === 'prixod' || r.turi === 'eski_prixod'; const out = r.turi === 'rasxod' || r.turi === 'eski_rasxod';
      const a = r.kimdan ? hNom(r.kimdan) : '', b = r.kimga ? hNom(r.kimga) : (r.oluvchi || '');
      const yo = a && b ? `${esc(a)} → ${esc(b)}` : esc(a || b || '—');
      const ed = r.manba !== 'daftar' ? `<button class="btn btn-g btn-sm" style="min-height:30px;padding:0 9px" onclick="phEdit(${r.id})" aria-label="Tahrirlash">✎</button>` : '';
      return `<tr><td class="muted" style="white-space:nowrap">${esc(sanaF(r.sana))}</td>
        <td><span class="badge ${TCLS[r.turi] || ''}">${esc(TURI[r.turi] || r.turi)}</span>${r.yonalish ? `<div class="t-sub">${YON[r.yonalish]}</div>` : ''}</td>
        <td style="min-width:180px"><div class="t-name" style="font-weight:500">${yo}</div>${r.kimga && r.oluvchi ? `<div class="t-sub">${esc(r.oluvchi)}</div>` : ''}</td>
        <td><div class="t-name">${esc(r.zakaz || '—')}</div><div class="t-sub">${esc([r.vid, r.izoh].filter(Boolean).join(' · '))}</div></td>
        <td style="text-align:right;white-space:nowrap" class="${inn ? 'pos' : out ? 'neg' : ''}">${inn ? '+' : out ? '−' : ''}${esc(money(r.summa, r.valyuta))}${r.valyuta === 'uzs' && r.kurs ? `<div class="t-sub">kurs ${fUZS(r.kurs)}</div>` : ''}</td>
        <td style="text-align:right;white-space:nowrap" class="muted">${r.summa_usd == null ? '—' : esc(fUSD(r.summa_usd))}</td>
        <td>${tqBadge(r)}</td><td>${ed}</td></tr>`;
    }).join('') + (rows.length > PH.limit ? `<tr><td colspan="8" style="text-align:center"><button class="btn btn-g btn-sm" onclick="PH.limit+=300;phRenderPage('ph')">Yana ko'rsatish (${rows.length - PH.limit} ta qoldi)</button></td></tr>` : '')
      : '<tr><td colspan="8"><div class="empty"><div class="empty-t">Yozuv topilmadi</div></div></td></tr>';
    if (!PH.edit) fillForm();
  }

  // ---------- forma ----------
  function hamOpts(filter, sel) {
    return PH.ham.filter(filter).map((h) => `<option value="${esc(h.kod)}" ${h.kod === sel ? 'selected' : ''}>${esc(h.nom)}</option>`).join('');
  }
  const personal = (h) => h.turi !== 'tizim' && h.faol;
  function fillForm(r) {
    const m = PH.mode; const e = r || {};
    document.querySelectorAll('#ph-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    const zak = [...new Set(PH.rows.map((x) => x.zakaz).filter(Boolean))].slice(0, 400);
    const olu = [...new Set(PH.rows.map((x) => x.oluvchi).filter(Boolean))];
    const def = localStorage.getItem('ph-ham') || 'abdujabbor_usd';
    const yonSel = `<div><label class="fl" for="pf-yon">Yo'nalish</label><select class="fi" id="pf-yon"><option value="asosiy" ${e.yonalish !== 'qoshimcha' ? 'selected' : ''}>Pergola (asosiy)</option><option value="qoshimcha" ${e.yonalish === 'qoshimcha' ? 'selected' : ''}>Oyna (qo'shimcha)</option></select></div>`;
    const sana = `<div><label class="fl" for="pf-sana">Sana</label><input class="fi" type="date" id="pf-sana" value="${esc(e.sana || today())}"></div>`;
    const summa = (lab) => `<div><label class="fl" for="pf-sum">${lab}</label><input class="fi" id="pf-sum" inputmode="decimal" placeholder="0" value="${e.summa != null ? esc(e.summa) : ''}" autocomplete="off"></div>`;
    const kurs = `<div><label class="fl" for="pf-kurs">Kurs</label><input class="fi" id="pf-kurs" inputmode="decimal" value="${esc(e.kurs || lastKurs())}"></div>`;
    const izoh = `<div><label class="fl" for="pf-izoh">Izoh</label><input class="fi" id="pf-izoh" value="${esc(e.izoh || '')}" placeholder="ixtiyoriy"></div>`;
    const zakaz = `<div><label class="fl" for="pf-zak">Zakaz (obyekt)</label><input class="fi" id="pf-zak" list="pf-zaks" value="${esc(e.zakaz || '')}" placeholder="masalan: Chortoq pergola"><datalist id="pf-zaks">${zak.map((z) => `<option value="${esc(z)}">`).join('')}</datalist></div>`;
    let h = '';
    if (m === 'prixod') {
      h = `${sana}${yonSel}
        <div><label class="fl" for="pf-to">Qaysi hamyonga tushdi</label><select class="fi" id="pf-to">${hamOpts(personal, e.kimga || def)}</select></div>
        ${zakaz}
        ${summa('Summa')}${kurs}</div>
        <div><label class="fl" for="pf-izoh">To'lov bosqichi / izoh</label><input class="fi" id="pf-izoh" list="pf-bos" value="${esc(e.izoh || '')}" placeholder="Avans, Avans1… Ost"><datalist id="pf-bos">${BOSQICH.map((b) => `<option value="${b}">`).join('')}</datalist></div>`;
    } else if (m === 'rasxod') {
      h = `${sana}${yonSel}
        <div><label class="fl" for="pf-from">Qaysi hamyondan</label><select class="fi" id="pf-from">${hamOpts(personal, e.kimdan || def)}</select></div>
        ${zakaz}
        <div><label class="fl" for="pf-vid">Vid</label><input class="fi" id="pf-vid" list="pf-vids" value="${esc(e.vid || '')}" placeholder="Taksi, Metall…"><datalist id="pf-vids">${VIDLAR.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div><label class="fl" for="pf-olu">Kimga (ixtiyoriy)</label><input class="fi" id="pf-olu" list="pf-olus" value="${esc(e.oluvchi || '')}" placeholder="Begzod…"><datalist id="pf-olus">${olu.map((o) => `<option value="${esc(o)}">`).join('')}</datalist></div>
        ${summa('Summa')}${kurs}</div>${izoh}`;
    } else if (m === 'ichki') {
      h = `${sana}${yonSel}
        <div><label class="fl" for="pf-from">Kimdan</label><select class="fi" id="pf-from">${hamOpts(personal, e.kimdan || def)}</select></div>
        <div><label class="fl" for="pf-to">Kimga</label><select class="fi" id="pf-to">${hamOpts((x) => personal(x) || x.kod === 'kassa', e.kimga || '')}</select></div>
        ${summa('Summa')}${kurs}</div>${izoh}`;
    } else {
      h = `${sana}${yonSel}
        <div><label class="fl" for="pf-from">Dollar qaysi hamyondan</label><select class="fi" id="pf-from">${hamOpts((x) => personal(x) && x.valyuta === 'usd', e.kimdan || '')}</select></div>
        <div><label class="fl" for="pf-sum">Dollar ($)</label><input class="fi" id="pf-sum" inputmode="decimal" placeholder="100" oninput="phFx()"></div><div><label class="fl" for="pf-kurs">Kurs</label><input class="fi" id="pf-kurs" inputmode="decimal" value="${esc(lastKurs())}" oninput="phFx()"></div>
        <div><label class="fl" for="pf-to">So'm qaysi hamyonga</label><select class="fi" id="pf-to">${hamOpts((x) => personal(x) && x.valyuta === 'uzs', '')}</select></div>
        <div class="muted" id="pf-fx" style="font-size:13px">Dollar va kursni kiriting</div>`;
    }
    $('ph-fbody').innerHTML = h;
    $('ph-save').textContent = PH.edit ? 'Yangilash' : 'Saqlash';
    $('ph-cancel').style.display = PH.edit ? '' : 'none';
    $('ph-del').style.display = PH.edit ? '' : 'none';
    $('ph-ftitle').textContent = PH.edit ? 'Yozuvni tahrirlash' : 'Yangi yozuv';
  }
  const num = (id) => { const v = parseFloat(String($(id)?.value || '').replace(/\s/g, '').replace(',', '.')); return isFinite(v) ? v : 0; };
  window.phFx = function () { const u = num('pf-sum'), k = num('pf-kurs'); $('pf-fx').textContent = u && k ? `${fUSD(u)} × ${fUZS(k)} = ${fUZS(u * k)} so'm` : 'Dollar va kursni kiriting'; };
  window.phMode = function (m) { if (PH.edit) return; PH.mode = m; fillForm(); };
  window.phEdit = function (id) {
    const r = PH.rows.find((x) => x.id === id); if (!r) return;
    PH.edit = r; PH.mode = r.turi === 'eski_prixod' ? 'prixod' : r.turi === 'eski_rasxod' ? 'rasxod' : r.turi === 'hisob' ? 'ichki' : r.turi;
    fillForm(r); $('ph-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  window.phCancel = function () { PH.edit = null; fillForm(); };
  window.phDelete = async function () {
    const r = PH.edit; if (!r) return;
    if (!confirm(`${money(r.summa, r.valyuta)} yozuvi o'chirilsinmi?`)) return;
    const { error } = await db.from('pul_harakati').delete().eq('id', r.id);
    if (error) { toast('⚠️', "O'chmadi", error.message); return; }
    PH.edit = null; toast('🗑', "O'chirildi", ''); await phLoad(); phRender();
  };
  window.phSave = async function () {
    const m = PH.mode; const sana = $('pf-sana').value || today(); const yonalish = $('pf-yon').value;
    const summa = num('pf-sum'); const kurs = num('pf-kurs') || null;
    if (summa <= 0) { toast('⚠️', 'Summani kiriting', ''); return; }
    const izoh = $('pf-izoh')?.value.trim() || null;
    let rows = [];
    if (m === 'prixod') {
      const to = $('pf-to').value;
      rows = [{ sana, turi: PH.edit && PH.edit.turi === 'eski_prixod' ? 'eski_prixod' : 'prixod', yonalish, kimdan: 'mijoz', kimga: to, zakaz: $('pf-zak').value.trim() || null, summa, valyuta: hVal(to) === 'usd' ? 'usd' : 'uzs', kurs, izoh }];
    } else if (m === 'rasxod') {
      const fr = $('pf-from').value;
      rows = [{ sana, turi: PH.edit && PH.edit.turi === 'eski_rasxod' ? 'eski_rasxod' : 'rasxod', yonalish, kimdan: fr, kimga: null, oluvchi: $('pf-olu').value.trim() || null, zakaz: $('pf-zak').value.trim() || null, vid: $('pf-vid').value.trim() || null, summa, valyuta: hVal(fr) === 'usd' ? 'usd' : 'uzs', kurs, izoh }];
    } else if (m === 'ichki') {
      const fr = $('pf-from').value, to = $('pf-to').value;
      if (fr === to) { toast('⚠️', 'Kimdan va kimga bir xil', ''); return; }
      rows = [{ sana, turi: PH.edit && PH.edit.turi === 'hisob' ? 'hisob' : 'ichki', yonalish, kimdan: fr, kimga: to, summa, valyuta: hVal(fr) === 'usd' ? 'usd' : 'uzs', kurs, izoh }];
    } else {
      const fr = $('pf-from').value, to = $('pf-to').value;
      if (!kurs) { toast('⚠️', 'Kursni kiriting', ''); return; }
      rows = [{ sana, turi: 'hisob', yonalish, kimdan: fr, kimga: 'valyuta', summa, valyuta: 'usd', kurs: null, izoh: `${fUSD(summa)} almashtirildi` },
        { sana, turi: 'hisob', yonalish, kimdan: 'valyuta', kimga: to, summa: Math.round(summa * kurs), valyuta: 'uzs', kurs, izoh: `${fUSD(summa)} × ${fUZS(kurs)}` }];
    }
    rows.forEach((r) => { r.manba = PH.edit ? PH.edit.manba : 'erp'; });
    let error;
    if (PH.edit) ({ error } = await db.from('pul_harakati').update({ ...rows[0], summa_usd: null }).eq('id', PH.edit.id));
    else ({ error } = await db.from('pul_harakati').insert(rows));
    if (error) { toast('⚠️', 'Saqlanmadi', error.message); return; }
    const used = rows[0].kimdan && rows[0].kimdan !== 'mijoz' ? rows[0].kimdan : rows[0].kimga;
    try { if (used) localStorage.setItem('ph-ham', used); } catch (e) {}
    toast('✅', PH.edit ? 'Yangilandi' : 'Saqlandi', ''); PH.edit = null; PH.agg = null;
    await phLoad(); phRender();
  };

  // ---------- Qoldiq ----------
  function renderQoldiq() {
    if (!$('qd-body')) return;
    const f = PH.qf;
    const ms = months();
    $('qd-oy').innerHTML = ms.map((m) => `<option value="${m}">${oyNom(m)}</option>`).join('');
    if (!f.oy) f.oy = ms[0];
    $('qd-oy').value = f.oy; $('qd-kun').value = f.kun || today();
    document.querySelectorAll('#qd-tur button').forEach((b) => b.classList.toggle('on', b.dataset.v === f.tur));
    $('qd-oy').style.display = f.tur === 'oy' ? '' : 'none'; $('qd-kun').style.display = f.tur === 'kun' ? '' : 'none';
    const inP = (r) => f.tur === 'all' || (f.tur === 'oy' ? String(r.sana).startsWith(f.oy) : r.sana === (f.kun || today()));
    const end = f.tur === 'all' ? '9999' : f.tur === 'oy' ? f.oy + '-31' : (f.kun || today());
    const pr = PH.rows.filter(inP);
    const agg = (rows, kod, yon) => {
      let i = 0, o = 0;
      rows.forEach((r) => { if (yon !== undefined && (r.yonalish || null) !== yon) return; if (r.kimga === kod) i += r.summa; if (r.kimdan === kod) o += r.summa; });
      return [i, o];
    };
    const upto = PH.rows.filter((r) => r.sana <= end);
    const people = [...new Set(PH.ham.filter((h) => h.egasi_ism).map((h) => h.egasi_ism))];
    const tot = { asosiy: { usd: 0, uzs: 0, karta: 0 }, qoshimcha: { usd: 0, uzs: 0, karta: 0 }, all: { usd: 0, uzs: 0, karta: 0 } };
    let html = '';
    people.forEach((p) => {
      const hs = PH.ham.filter((h) => h.egasi_ism === p && PH.rows.some((r) => r.kimdan === h.kod || r.kimga === h.kod));
      if (!hs.length) return;
      const tr = hs.map((h) => {
        const cur = h.valyuta; const t = h.turi === 'karta' ? 'karta' : cur;
        const [ai, ao] = agg(pr, h.kod, 'asosiy'); const [qi, qo] = agg(pr, h.kod, 'qoshimcha');
        const [ti, to] = agg(upto, h.kod); const [ati, ato] = agg(upto, h.kod, 'asosiy'); const [qti, qto] = agg(upto, h.kod, 'qoshimcha');
        tot.asosiy[t] += ati - ato; tot.qoshimcha[t] += qti - qto; tot.all[t] += (ati - ato) + (qti - qto);
        const nul = (ti - to) - ((ati - ato) + (qti - qto)); if (Math.abs(nul) > 0.009) { tot.nul = (tot.nul || 0) + 1; }
        const hoz = (ati - ato) + (qti - qto);
        const mf = (v) => esc(money(v, cur));
        return `<tr><td class="t-name">${esc(h.nom)}</td>
          <td style="text-align:right">${mf(ai)}</td><td style="text-align:right">${mf(ao)}</td><td style="text-align:right" class="${ai - ao < 0 ? 'neg' : ''}"><b>${mf(ai - ao)}</b></td>
          <td style="text-align:right">${mf(qi)}</td><td style="text-align:right">${mf(qo)}</td><td style="text-align:right" class="${qi - qo < 0 ? 'neg' : ''}"><b>${mf(qi - qo)}</b></td>
          <td style="text-align:right;background:#F3EDE2" class="${hoz < 0 ? 'neg' : ''}"><b>${mf(hoz)}</b>${Math.abs(nul) > 0.009 ? `<div class="t-sub" title="Yo'nalishi belgilanmagan yozuvlar">+ belgisiz ${mf(nul)}</div>` : ''}</td></tr>`;
      }).join('');
      html += `<div class="panel" style="margin-bottom:16px"><h3 style="font-size:24px">${esc(p)}</h3><div class="scroll-x"><table class="tbl" style="min-width:860px"><thead><tr><th>Hisob</th><th style="text-align:right">Pergola kirim</th><th style="text-align:right">Chiqim</th><th style="text-align:right">Qoldiq</th><th style="text-align:right">Oyna kirim</th><th style="text-align:right">Chiqim</th><th style="text-align:right">Qoldiq</th><th style="text-align:right">Hozirgi qoldiq</th></tr></thead><tbody>${tr}</tbody></table></div></div>`;
    });
    const sysB = (k, cur) => upto.reduce((a, r) => a + (r.valyuta === cur ? (r.kimga === k ? r.summa : 0) - (r.kimdan === k ? r.summa : 0) : 0), 0);
    const card = (l, a, dark) => `<div class="sc${dark ? ' dark' : ''}"><div class="sc-l">${l}</div><div class="sc-v" style="font-size:30px">${esc(fUSD(a.usd))}</div><div class="sc-s">${esc(money(a.uzs, 'uzs'))} naqd · ${esc(money(a.karta, 'uzs'))} karta</div></div>`;
    $('qd-cards').innerHTML = card('Jami qoldiq', tot.all, true) + card('Pergola (asosiy)', tot.asosiy) + card("Oyna (qo'shimcha)", tot.qoshimcha)
      + `<div class="sc"><div class="sc-l">Kassaga topshirilgan</div><div class="sc-v" style="font-size:30px">${esc(fUSD(sysB('kassa', 'usd')))}</div><div class="sc-s">${esc(money(sysB('kassa', 'uzs'), 'uzs'))}${tot.nul ? ` · <span class="neg">${tot.nul} ta hisobda yo'nalishsiz yozuv bor</span>` : ''}</div></div>`;
    $('qd-body').innerHTML = html || '<div class="empty"><div class="empty-t">Ma\'lumot yo\'q</div></div>';
    $('qd-note').textContent = f.tur === 'all' ? 'Boshidan buyon' : f.tur === 'oy' ? oyNom(f.oy) + ' bo\'yicha kirim/chiqim; oxirgi ustun — oy oxiridagi qoldiq' : sanaF(f.kun || today()) + ' kuni; oxirgi ustun — kun oxiridagi qoldiq';
  }
  window.phQd = function (k, v) { PH.qf[k] = v; renderQoldiq(); };

  // ---------- Ishlar (zakaz bo'yicha foyda) ----------
  const TAGS = ['avans', 'avans1', 'avans2', 'avans3', 'avans4', 'ost'];
  const TAGL = { avans: 'Avans', avans1: 'Avans 1', avans2: 'Avans 2', avans3: 'Avans 3', avans4: 'Avans 4', ost: 'Ost', boshqa: "Boshqa to'lov" };
  const XCOLS = [['foyda', 'Foyda ulushi'], ['tovar', 'Tovar'], ['kraska', 'Kraska'], ['mator', 'Mator'], ['metall', 'Metall'], ['metallchiga', 'Metallchiga'], ['lesa', 'Lesa'], ['material', 'Material'], ['taksi', 'Taksi'], ['oylik', 'Oylik'], ['xostavar', 'Xostavar'], ['kran', 'Kran'], ['oynapaket', 'Oyna paket'], ['oyna', 'Oyna'], ['gostinsa', 'Gostinsa'], ['akfa', 'Akfa'], ['logo', 'Logo'], ['tunuka', 'Tunuka'], ['boshqa', 'Boshqa']];
  const V2C = { 'optima tovar': 'tovar', tovar: 'tovar', kraska: 'kraska', mator: 'mator', metall: 'metall', metallchiga: 'metallchiga', lesa: 'lesa', material: 'material', taksi: 'taksi', xostavar: 'xostavar', selekon: 'xostavar', kran: 'kran', 'oyna paketga': 'oynapaket', 'star glass': 'oyna', 'optima oyna': 'oyna', gostinsa: 'gostinsa', akfa: 'akfa', logo: 'logo', tunuka: 'tunuka', tikuvchiga: 'tunuka', foyda: 'foyda' };
  const ROYXAT = { asosiy: 'Asosiy', proalyum: 'Proalyum', ozimiz: "O'zimiz" };
  const key = (s) => String(s || '').trim().toLowerCase();
  PH.ishF = { r: 'asosiy', h: '', q: '' }; PH.ishOpen = null;
  function buildAgg() {
    const A = {};
    PH.rows.forEach((x) => {
      if (!x.zakaz) return; const k = key(x.zakaz);
      const a = A[k] || (A[k] = { tush: {}, tushE: {}, xar: {}, kassa: 0, rows: [], last: x.sana });
      a.rows.push(x); const u = n0(x.summa_usd); const ex = x.manba === 'excel';
      if (x.turi === 'prixod' || x.turi === 'eski_prixod') {
        const t = key(x.izoh); const tag = TAGS.includes(t) ? t : (ex ? null : 'boshqa');
        if (tag) { const t2 = x.turi === 'eski_prixod' ? a.tushE : a.tush; t2[tag] = (t2[tag] || 0) + u; }
      } else if (x.turi === 'rasxod' || x.turi === 'eski_rasxod') {
        const v = key(x.vid);
        if (v === 'kassa') a.kassa += u;
        else { const c = V2C[v] || (ex ? null : (v === 'oylik' ? 'oylik' : 'boshqa')); if (c) a.xar[c] = (a.xar[c] || 0) + u; }
      }
    });
    PH.agg = A;
  }
  function calc(i) {
    if (!PH.agg) buildAgg();
    const a = PH.agg[key(i.nom)] || { tush: {}, tushE: {}, xar: {}, kassa: 0, rows: [] };
    // Excel qoidasi: "Ishlar"da eski prixod faqat "Avans"ga, "O'zimiz ishlar"da hammasiga qo'shiladi
    const led = (t) => n0(a.tush[t]) + ((i.royxat === 'ozimiz' || t === 'avans') ? n0(a.tushE[t]) : 0);
    const qt = i.qolda_tushum || {}, qx = i.qolda_xarajat || {};
    const tush = {}; [...TAGS, 'boshqa'].forEach((t) => { tush[t] = qt[t] != null ? n0(qt[t]) : led(t); });
    const xar = {}; XCOLS.forEach(([c]) => { xar[c] = qx[c] != null ? n0(qx[c]) : n0(a.xar[c]); });
    const T = Object.values(tush).reduce((s, v) => s + v, 0), X = Object.values(xar).reduce((s, v) => s + v, 0);
    const K = i.qolda_kassa != null ? n0(i.qolda_kassa) : a.kassa;
    const S = n0(i.summa_usd);
    const pul = T - K - X;
    const td = new Date(today()); const dd = (s) => (s ? Math.round((new Date(s) - td) / 864e5) : null);
    let muddat = '', kech = 0;
    if (i.holat === 'Tugadi' && i.bitdi && i.deadline) { const d = Math.round((new Date(i.bitdi) - new Date(i.deadline)) / 864e5); muddat = d > 0 ? d + ' kun kechikdi' : d === 0 ? 'Vaqtida bitdi' : -d + ' kun oldin bitdi'; kech = d > 0 ? 1 : 0; }
    else if (i.holat === 'Jarayonda' && i.deadline) { const d = -dd(i.deadline); muddat = d > 0 ? d + ' kun kechikmoqda' : 'Vaqti bor'; kech = d > 0 ? 2 : 0; }
    const kun = i.holat === 'Tugadi' && i.bitdi && i.boshlandi ? Math.round((new Date(i.bitdi) - new Date(i.boshlandi)) / 864e5) : i.holat === 'Jarayonda' && i.boshlandi ? -dd(i.boshlandi) : null;
    return { a, tush, xar, T, X, K, S, qarz: S - T, plan: S - K - X, pul, foiz: T ? pul / T : null, muddat, kech, kun, kunlik: kun ? pul / kun : null };
  }
  function renderIshlar() {
    if (!$('ish-tbody')) return;
    buildAgg();
    const f = PH.ishF; const q = key(f.q);
    document.querySelectorAll('#ish-r button').forEach((b) => b.classList.toggle('on', b.dataset.v === f.r));
    document.querySelectorAll('#ish-h button').forEach((b) => b.classList.toggle('on', b.dataset.v === f.h));
    const list = PH.ish.filter((i) => (!f.r || i.royxat === f.r) && (!f.h || (i.holat || '') === f.h) && (!q || key(i.nom).includes(q) || key(i.kod).includes(q)))
      .map((i) => ({ i, c: calc(i) }));
    list.sort((x, y) => (y.i.holat === 'Jarayonda') - (x.i.holat === 'Jarayonda') || String(y.i.boshlandi || '').localeCompare(String(x.i.boshlandi || '')) || y.i.id - x.i.id);
    const sm = (k) => list.reduce((s, x) => s + n0(x.c[k]), 0);
    const T = sm('T'), P = sm('pul');
    const kechN = list.filter((x) => x.c.kech === 2).length;
    $('ish-cards').innerHTML = `<div class="sc dark"><div class="sc-l">Zakazlar summasi</div><div class="sc-v">${esc(fUSD(sm('S')))}</div><div class="sc-s">${list.length} ta ish</div></div>
      <div class="sc"><div class="sc-l">Tushgan</div><div class="sc-v">${esc(fUSD(T))}</div><div class="sc-s">Mijozlar qarzi: <b>${esc(fUSD(sm('qarz')))}</b></div></div>
      <div class="sc"><div class="sc-l">Xarajat + kassaga</div><div class="sc-v">${esc(fUSD(sm('X') + sm('K')))}</div><div class="sc-s">xarajat ${esc(fUSD(sm('X')))} · kassaga ${esc(fUSD(sm('K')))}</div></div>
      <div class="sc"><div class="sc-l">Qo'ldagi pul (tushgan − kassa − xarajat)</div><div class="sc-v ${P >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${esc(fUSD(P))}</div><div class="sc-s">${T ? Math.round((P / T) * 100) + '% tushumdan' : ''}${kechN ? ` · <span class="neg">${kechN} ta ish kechikmoqda</span>` : ''}</div></div>`;
    const hc = { Tugadi: 'b-tayyor', Jarayonda: 'b-olchov', Boshlanmagan: 'b-new' };
    $('ish-tbody').innerHTML = list.length ? list.map(({ i, c }) => {
      const pr = c.S ? Math.min(100, Math.max(0, Math.round((c.T / c.S) * 100))) : 0;
      const open = PH.ishOpen === i.id;
      return `<tr style="cursor:pointer" onclick="phIshToggle(${i.id})"><td class="muted">${esc(i.kod || '')}<div class="t-sub">${esc(ROYXAT[i.royxat])}</div></td>
        <td style="min-width:180px"><div class="t-name">${esc(i.nom)}</div><div class="t-sub">${esc([i.razmer, i.kv ? i.kv + ' m²' : ''].filter(Boolean).join(' · '))}</div></td>
        <td style="text-align:right">${esc(fUSD(c.S))}</td>
        <td style="min-width:130px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><b>${esc(fUSD(c.T))}</b><span class="muted">${pr}%</span></div><div class="prog" style="margin-top:6px"><div class="prog-f" style="width:${pr}%"></div></div>${c.qarz > 0.5 ? `<div class="t-sub">qarz ${esc(fUSD(c.qarz))}</div>` : ''}</td>
        <td style="text-align:right">${esc(fUSD(c.K))}</td>
        <td style="text-align:right">${esc(fUSD(c.X))}</td>
        <td style="text-align:right" class="${c.pul >= 0 ? 'pos' : 'neg'}">${esc(fUSD(c.pul))}${c.foiz != null ? `<div class="t-sub">${Math.round(c.foiz * 100)}%</div>` : ''}</td>
        <td>${i.holat ? `<span class="badge ${hc[i.holat] || ''}">${esc(i.holat)}</span>` : '<span class="muted">—</span>'}<div class="t-sub ${c.kech ? 'neg' : ''}">${esc(c.muddat)}</div></td></tr>`
        + (open ? `<tr><td colspan="8" style="background:#F7F2E9;padding:20px">${ishDetail(i, c)}</td></tr>` : '');
    }).join('') : '<tr><td colspan="8"><div class="empty"><div class="empty-t">Ish topilmadi</div></div></td></tr>';
    // ro'yxatda yo'q zakazlar
    const names = new Set(PH.ish.map((i) => key(i.nom)));
    const yoq = Object.entries(PH.agg).filter(([k, a]) => !names.has(k) && a.rows.some((r) => r.manba !== 'excel' || r.turi === 'prixod' || r.turi === 'eski_prixod'))
      .map(([k, a]) => ({ nom: a.rows[0].zakaz, n: a.rows.length, last: a.rows.reduce((m, r) => (r.sana > m ? r.sana : m), '') }))
      .sort((x, y) => y.last.localeCompare(x.last)).slice(0, 30);
    $('ish-yoq').innerHTML = yoq.length ? `<h3 style="font-size:20px">Pul harakatida bor, lekin ro'yxatda yo'q zakazlar</h3><div class="muted" style="font-size:13px">Ro'yxatga qo'shsangiz, foydasi hisoblanadi.</div><div style="display:flex;flex-wrap:wrap;gap:8px">${yoq.map((y) => `<button class="chip" onclick="phIshNew(${esc(JSON.stringify(y.nom))})">+ ${esc(y.nom)} <span class="muted">· ${y.n}</span></button>`).join('')}</div>` : '';
    $('ish-yoq').style.display = yoq.length ? '' : 'none';
  }
  function ishDetail(i, c) {
    const line = (l, v, man) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #ECE4D4;font-size:13px"><span>${esc(l)}${man ? ' <span class="tag" style="background:#EFE8DA;color:#7E5F25" title="Qo\'lda kiritilgan (Excel)">QO\'LDA</span>' : ''}</span><b>${esc(fUSD(v))}</b></div>`;
    const qt = i.qolda_tushum || {}, qx = i.qolda_xarajat || {};
    const tl = [...TAGS, 'boshqa'].filter((t) => c.tush[t]).map((t) => line(TAGL[t], c.tush[t], qt[t] != null)).join('') || '<div class="muted">To\'lov yo\'q</div>';
    const xl = XCOLS.filter(([k]) => c.xar[k]).map(([k, l]) => line(l, c.xar[k], qx[k] != null)).join('') || '<div class="muted">Xarajat yo\'q</div>';
    const rows = c.a.rows.slice(0, 40).map((r) => `<tr><td class="muted">${esc(sanaF(r.sana))}</td><td>${esc(TURI[r.turi] || r.turi)}</td><td>${esc(r.vid || r.izoh || '')}</td><td style="text-align:right">${esc(money(r.summa, r.valyuta))}</td><td style="text-align:right" class="muted">${esc(fUSD(r.summa_usd))}</td></tr>`).join('');
    const inp = (id, l, v, t) => `<div><label class="fl" for="${id}">${l}</label><input class="fi" id="${id}" ${t ? `type="${t}"` : 'inputmode="decimal"'} value="${esc(v ?? '')}"></div>`;
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px">
      <div><h4 style="font-size:18px;margin-bottom:6px">To'lovlar</h4>${tl}${line('Jami tushgan', c.T)}${line('Kassaga topshirilgan', c.K, i.qolda_kassa != null)}</div>
      <div><h4 style="font-size:18px;margin-bottom:6px">Xarajatlar</h4>${xl}${line('Jami xarajat', c.X)}</div>
      <div><h4 style="font-size:18px;margin-bottom:6px">Natija</h4>${line('Summa', c.S)}${line('Qolgan qarz', c.qarz)}${line('Reja qoldiq (summa − kassa − xarajat)', c.plan)}${line("Qo'ldagi pul", c.pul)}
        ${c.kun != null ? `<div class="muted" style="font-size:13px;margin-top:8px">${c.kun} kun${c.kunlik != null ? ' · kuniga ' + esc(fUSD(c.kunlik)) : ''}</div>` : ''}</div>
    </div>
    <form onsubmit="return false" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:18px" onclick="event.stopPropagation()">
      ${inp('ie-nom', 'Nomi', i.nom, 'text')}${inp('ie-kod', 'Kod', i.kod, 'text')}${inp('ie-raz', 'Razmer', i.razmer, 'text')}${inp('ie-kv', 'KV', i.kv)}${inp('ie-sum', 'Summa ($)', i.summa_usd)}
      ${inp('ie-oyl', 'Oylik ($, qo\'lda)', qx.oylik)}${inp('ie-foy', 'Foyda ulushi ($)', qx.foyda)}
      ${inp('ie-dl', 'Muddat', i.deadline, 'date')}${inp('ie-bs', 'Boshlandi', i.boshlandi, 'date')}${inp('ie-bt', 'Bitdi', i.bitdi, 'date')}
      <div><label class="fl" for="ie-h">Holati</label><select class="fi" id="ie-h">${['', 'Boshlanmagan', 'Jarayonda', 'Tugadi'].map((h) => `<option value="${h}" ${h === (i.holat || '') ? 'selected' : ''}>${h || '—'}</option>`).join('')}</select></div>
      <div><label class="fl" for="ie-r">Ro'yxat</label><select class="fi" id="ie-r">${Object.entries(ROYXAT).map(([k, l]) => `<option value="${k}" ${k === i.royxat ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div style="display:flex;align-items:flex-end;gap:8px"><button type="button" class="btn btn-a" onclick="phIshSave(${i.id})">Saqlash</button><button type="button" class="btn btn-danger btn-sm" onclick="phIshDel(${i.id})">O'chirish</button></div>
    </form>
    ${rows ? `<div class="scroll-x" style="margin-top:16px"><table class="tbl" style="min-width:600px"><thead><tr><th>Sana</th><th>Turi</th><th>Vid / izoh</th><th style="text-align:right">Summa</th><th style="text-align:right">$</th></tr></thead><tbody>${rows}</tbody></table>${c.a.rows.length > 40 ? `<div class="muted" style="font-size:12px;margin-top:6px">Yana ${c.a.rows.length - 40} ta yozuv — Pul harakati'da "${esc(i.nom)}" deb qidiring</div>` : ''}</div>` : ''}`;
  }
  window.phIshCalc = (i) => calc(i);
  window.phIshToggle = function (id) { PH.ishOpen = PH.ishOpen === id ? null : id; renderIshlar(); };
  window.phIshSave = async function (id) {
    const i = PH.ish.find((x) => x.id === id); if (!i) return;
    const nv = (el) => { const v = String($(el).value).trim(); return v === '' ? null : v; };
    const qx = { ...(i.qolda_xarajat || {}) };
    const setQ = (k, el) => { const v = nv(el); if (v == null) delete qx[k]; else qx[k] = num(el); };
    setQ('oylik', 'ie-oyl'); setQ('foyda', 'ie-foy');
    const u = { nom: nv('ie-nom') || i.nom, kod: nv('ie-kod'), razmer: nv('ie-raz'), kv: nv('ie-kv') == null ? null : num('ie-kv'), summa_usd: nv('ie-sum') == null ? null : num('ie-sum'),
      deadline: nv('ie-dl'), boshlandi: nv('ie-bs'), bitdi: nv('ie-bt'), holat: nv('ie-h'), royxat: $('ie-r').value, qolda_xarajat: qx, updated_at: new Date().toISOString() };
    const { error } = await db.from('ishlar').update(u).eq('id', id);
    if (error) { toast('⚠️', 'Saqlanmadi', error.message); return; }
    Object.assign(i, u); toast('✅', 'Saqlandi', i.nom); renderIshlar();
  };
  window.phIshDel = async function (id) {
    const i = PH.ish.find((x) => x.id === id); if (!i || !confirm(`"${i.nom}" ro'yxatdan o'chirilsinmi? (Pul harakatidagi yozuvlar qoladi)`)) return;
    const { error } = await db.from('ishlar').delete().eq('id', id);
    if (error) { toast('⚠️', "O'chmadi", error.message); return; }
    PH.ish = PH.ish.filter((x) => x.id !== id); PH.ishOpen = null; renderIshlar();
  };
  window.phIshNew = async function (nom) {
    nom = nom || prompt('Zakaz nomi (Pul harakatidagi "Zakaz" bilan bir xil yozing):'); if (!nom || !nom.trim()) return;
    const row = { nom: nom.trim(), royxat: PH.ishF.r || 'asosiy', holat: 'Jarayonda', boshlandi: today() };
    const { data, error } = await db.from('ishlar').insert(row).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; }
    PH.ish.push(data); PH.ishOpen = data.id; toast('✅', "Ro'yxatga qo'shildi", data.nom); renderIshlar();
  };

  // ---------- Ish haqqi ----------
  PH.ihTab = 'ustalar'; PH.ihSel = null;
  const ihWorkers = (d) => PH.ihW.filter((w) => w.davr_id === d.id);
  const ihJobs = (d) => PH.ihJ.filter((j) => j.davr_id === d.id);
  function jobCalc(j, ws) {
    const it = j.ishtirok || {};
    const names = [...new Set([...ws.filter((w) => n0(w.foiz) > 0).map((w) => w.ism), ...Object.keys(it)])];
    const pool = j.summa != null ? n0(j.summa) : n0(j.kv) * n0(j.stavka);
    const ps = names.map((nm) => { const w = ws.find((x) => x.ism === nm) || {}; const o = it[nm] || {}; const f = o.foiz != null ? n0(o.foiz) : n0(w.foiz); return { ism: nm, foiz: f, kun: n0(o.kun) }; }).filter((x) => x.foiz > 0);
    ps.forEach((x) => { x.asl = pool * x.foiz; x.bir = n0(j.ish_kuni) > 0 ? x.asl / n0(j.ish_kuni) : 0; x.olib = x.kun * x.bir; x.qosh = 0; });
    // Excel qoidasi: ishlamagan kun uchun ushlangan pul, undan kam kun qolgan ustalarga teng bo'linadi
    ps.forEach((k) => { if (k.olib > 0) { const r = ps.filter((x) => x.kun < k.kun); r.forEach((x) => { x.qosh += k.olib / r.length; }); } });
    ps.forEach((x) => { x.oladi = x.asl - x.olib + x.qosh; });
    return { pool, ps };
  }
  function davrCalc(d) {
    const ws = ihWorkers(d); const js = ihJobs(d).map((j) => ({ j, c: jobCalc(j, ws) }));
    const sum = {}; js.forEach(({ c }) => c.ps.forEach((x) => { sum[x.ism] = (sum[x.ism] || 0) + x.oladi; }));
    const av = (ism) => !d.avans_ledger ? 0 : PH.rows.filter((r) => key(r.oluvchi) === key(ism) && (!d.boshlanish || r.sana >= d.boshlanish) && (!d.tugash || r.sana <= d.tugash)).reduce((s, r) => s + n0(r.summa_usd), 0);
    const names = [...new Set([...ws.map((w) => w.ism), ...Object.keys(sum)])];
    const rows = names.map((nm) => { const w = ws.find((x) => x.ism === nm) || { ism: nm, foiz: 0, eski_qoldiq: 0, eski_avans: 0 }; const s = sum[nm] || 0; const a = av(nm);
      return { w, summa: s, avans: a, qoldiq: s + n0(w.eski_qoldiq) - a - n0(w.eski_avans) }; });
    return { ws, js, rows };
  }
  function oylCalc(o) {
    const curM = +today().slice(5, 7);
    const summa = (o.summa_qolda != null ? n0(o.summa_qolda) : n0(o.stavka) * (o.oylar != null ? o.oylar : curM)) + n0(o.tuzatish);
    const avans = o.avans_qolda != null ? n0(o.avans_qolda) : PH.rows.filter((r) => r.turi === 'rasxod' && key(r.oluvchi) === key(o.ledger_ism || o.ism)).reduce((s, r) => s + n0(r.summa_usd), 0);
    return { summa, avans, qoldiq: summa + n0(o.eski) - avans - n0(o.eski_berilgan) };
  }
  window.phIhCalc = { davrCalc, oylCalc, jobCalc };
  const inpS = (tbl, id, f, v, w, step) => `<input class="fs" style="width:${w || 90}px;min-height:34px;text-align:right" inputmode="decimal" value="${v == null ? '' : esc(+(+v).toFixed(step == null ? 2 : step))}" onchange="phIhSet('${tbl}',${id},'${f}',this.value)">`;
  function renderIH() {
    if (!$('ih-body')) return;
    document.querySelectorAll('#ih-tab button').forEach((b) => b.classList.toggle('on', b.dataset.v === PH.ihTab));
    if (PH.ihTab === 'oylik') return renderOylik();
    if (PH.ihTab === 'alohida') return renderAlohida();
    const ds = [...PH.ihD].sort((a, b) => (a.yopilgan - b.yopilgan) || String(b.boshlanish).localeCompare(String(a.boshlanish)));
    if (!PH.ihSel || !ds.find((d) => d.id === PH.ihSel)) PH.ihSel = (ds[0] || {}).id;
    const d = ds.find((x) => x.id === PH.ihSel);
    let h = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${ds.map((x) => `<button class="chip ${x.id === PH.ihSel ? 'on' : ''}" onclick="PH.ihSel=${x.id};phRenderPage('ishhaqqi')">${esc(x.nom)} · ${x.boshlanish ? esc(sanaF(x.boshlanish)) + ' dan' : ''}${x.yopilgan ? ' · yopilgan' : ''}</button>`).join('')}<button class="chip" onclick="phIhNewDavr()">+ Yangi davr</button></div>`;
    if (!d) { $('ih-body').innerHTML = h + '<div class="empty"><div class="empty-t">Davr yo\'q</div></div>'; return; }
    const c = davrCalc(d);
    const tot = (k) => c.rows.reduce((s, r) => s + n0(r[k]), 0);
    const tolash = c.rows.filter((r) => r.qoldiq > 0).reduce((s, r) => s + r.qoldiq, 0), ortiq = c.rows.filter((r) => r.qoldiq < 0).reduce((s, r) => s + r.qoldiq, 0);
    h += `<section class="sg"><div class="sc dark"><div class="sc-l">Ish haqqi (bitgan ishlar)</div><div class="sc-v">${esc(fUSD(tot('summa')))}</div><div class="sc-s">${c.js.length} ta ish</div></div>
      <div class="sc"><div class="sc-l">Avans berilgan${d.avans_ledger ? ' (Pul harakatidan)' : ''}</div><div class="sc-v">${esc(fUSD(tot('avans')))}</div><div class="sc-s">${d.boshlanish ? esc(sanaF(d.boshlanish)) + ' dan' : ''}${d.tugash ? ' ' + esc(sanaF(d.tugash)) + ' gacha' : ''}</div></div>
      <div class="sc"><div class="sc-l">To'lash kerak</div><div class="sc-v pos" style="font-weight:600">${esc(fUSD(tolash))}</div><div class="sc-s">ustalarga qolgan qarz</div></div>
      <div class="sc"><div class="sc-l">Ortiqcha berilgan</div><div class="sc-v ${ortiq < 0 ? 'neg' : ''}" style="font-weight:600">${esc(fUSD(ortiq))}</div><div class="sc-s">keyingi ishdan ushlanadi</div></div></section>`;
    h += `<div class="panel" style="margin-bottom:16px"><div class="panel-h" style="flex-wrap:wrap;gap:10px"><h3>${esc(d.nom)} — ustalar</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:13px">
        <label>Boshlanish <input type="date" class="fs" value="${esc(d.boshlanish || '')}" onchange="phIhSet('ih_davr',${d.id},'boshlanish',this.value||null)"></label>
        <label>Tugash <input type="date" class="fs" value="${esc(d.tugash || '')}" onchange="phIhSet('ih_davr',${d.id},'tugash',this.value||null)"></label>
        <label><input type="checkbox" ${d.avans_ledger ? 'checked' : ''} onchange="phIhSet('ih_davr',${d.id},'avans_ledger',this.checked)"> avansni Pul harakatidan olish</label>
        ${!d.yopilgan ? `<button class="btn btn-g btn-sm" onclick="phIhClose(${d.id})">Davrni yopib, yangisini ochish</button>` : ''}
      </div></div>
      <div class="scroll-x"><table class="tbl" style="min-width:860px"><thead><tr><th>Usta</th><th style="text-align:right">Ulush %</th><th style="text-align:right">Ish haqqi</th><th style="text-align:right">Eski qoldiq</th><th style="text-align:right">Avans</th><th style="text-align:right">Eski avans</th><th style="text-align:right">Qoldiq</th></tr></thead><tbody>
      ${c.rows.map((r) => `<tr><td class="t-name">${esc(r.w.ism)}</td>
        <td style="text-align:right">${r.w.id ? inpS('ih_ishchi', r.w.id, 'foiz%', n0(r.w.foiz) * 100, 70, 1) : '—'}</td>
        <td style="text-align:right">${esc(fUSD(r.summa))}</td>
        <td style="text-align:right">${r.w.id ? inpS('ih_ishchi', r.w.id, 'eski_qoldiq', r.w.eski_qoldiq) : '—'}</td>
        <td style="text-align:right">${esc(fUSD(r.avans))}</td>
        <td style="text-align:right">${r.w.id ? inpS('ih_ishchi', r.w.id, 'eski_avans', r.w.eski_avans) : '—'}</td>
        <td style="text-align:right;background:#F3EDE2" class="${r.qoldiq < 0 ? 'neg' : 'pos'}">${esc(fUSD(r.qoldiq))}</td></tr>`).join('')}
      <tr><td><b>Jami</b></td><td style="text-align:right" class="muted">${Math.round(c.ws.reduce((s, w) => s + n0(w.foiz), 0) * 1000) / 10}%</td><td style="text-align:right"><b>${esc(fUSD(tot('summa')))}</b></td><td></td><td style="text-align:right"><b>${esc(fUSD(tot('avans')))}</b></td><td></td><td style="text-align:right"><b>${esc(fUSD(tot('qoldiq')))}</b></td></tr>
      </tbody></table></div>
      <div style="display:flex;gap:8px"><input class="fs" id="ih-new-w" placeholder="Yangi usta ismi"><button class="btn btn-g btn-sm" onclick="phIhAddW(${d.id})">+ Usta</button></div></div>`;
    h += `<div class="panel"><div class="panel-h"><h3>Bitgan ishlar</h3></div>
      <form onsubmit="return false" style="display:grid;grid-template-columns:2fr repeat(3,1fr) auto;gap:8px;align-items:end">
        <div><label class="fl">Ish nomi</label><input class="fi" id="ihj-nom" list="ihj-noms" placeholder="masalan: Chortoq pergola"><datalist id="ihj-noms">${PH.ish.map((i) => `<option value="${esc(i.nom)}">`).join('')}</datalist></div>
        <div><label class="fl">KV</label><input class="fi" id="ihj-kv" inputmode="decimal"></div>
        <div><label class="fl">$ / kv</label><input class="fi" id="ihj-st" inputmode="decimal" value="10"></div>
        <div><label class="fl">Ish kuni</label><input class="fi" id="ihj-kun" inputmode="decimal" value="0"></div>
        <button type="button" class="btn btn-a" onclick="phIhAddJ(${d.id})">+ Qo'shish</button></form>
      ${c.js.length ? c.js.map(({ j, c: jc }) => `<div style="border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:12px;background:#fff">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px"><b style="font-size:16px;margin-right:auto">${esc(j.nom)}</b>
          KV ${inpS('ih_ish', j.id, 'kv', j.kv, 70)} × $ ${inpS('ih_ish', j.id, 'stavka', j.stavka, 60)} = <b>${esc(fUSD(jc.pool))}</b> · ish kuni ${inpS('ih_ish', j.id, 'ish_kuni', j.ish_kuni, 60, 1)}
          <button class="btn btn-danger btn-sm" style="min-height:30px" onclick="phIhDelJ(${j.id})">×</button></div>
        <div class="scroll-x"><table class="tbl" style="min-width:640px;margin-top:6px"><thead><tr><th>Usta</th><th style="text-align:right">%</th><th style="text-align:right">Ishlamagan kun</th><th style="text-align:right">Asl summa</th><th style="text-align:right">Ushlandi</th><th style="text-align:right">Qo'shildi</th><th style="text-align:right">Oladi</th></tr></thead><tbody>
        ${jc.ps.map((x) => `<tr><td>${esc(x.ism)}</td><td style="text-align:right">${(x.foiz * 100).toFixed(1)}%</td><td style="text-align:right"><input class="fs" style="width:60px;min-height:30px;text-align:right" inputmode="decimal" value="${x.kun || ''}" onchange="phIhKun(${j.id},${esc(JSON.stringify(x.ism))},this.value)"></td>
          <td style="text-align:right">${esc(fUSD(x.asl))}</td><td style="text-align:right" class="${x.olib ? 'neg' : 'muted'}">${x.olib ? '−' + esc(fUSD(x.olib)) : '—'}</td><td style="text-align:right" class="${x.qosh ? 'pos' : 'muted'}">${x.qosh ? '+' + esc(fUSD(x.qosh)) : '—'}</td><td style="text-align:right"><b>${esc(fUSD(x.oladi))}</b></td></tr>`).join('')}
        </tbody></table></div></div>`).join('') : '<div class="muted" style="margin-top:10px">Bu davrda hali bitgan ish kiritilmagan.</div>'}
      <p class="muted" style="font-size:12px;margin-top:10px">Hisob Excel'dagidek: ish summasi = KV × $/kv; har bir usta foiziga qarab oladi; ishlamagan kunlari uchun (bir kunlik × kun) ushlanadi va bu pul undan kam kun qolgan ustalarga teng bo'linadi.</p></div>`;
    $('ih-body').innerHTML = h;
  }
  function renderOylik() {
    const rows = PH.oyl.map((o) => ({ o, c: oylCalc(o) }));
    const t = (k) => rows.reduce((s, r) => s + n0(r.c[k]), 0);
    $('ih-body').innerHTML = `<section class="sg"><div class="sc dark"><div class="sc-l">Hisoblangan oylik</div><div class="sc-v">${esc(fUSD(t('summa')))}</div><div class="sc-s">${rows.length} xodim · ${OYLAR[+today().slice(5, 7) - 1].toLowerCase()} holatiga</div></div>
      <div class="sc"><div class="sc-l">Berilgan (avans)</div><div class="sc-v">${esc(fUSD(t('avans')))}</div><div class="sc-s">Pul harakatidan</div></div>
      <div class="sc"><div class="sc-l">Qoldiq (to'lanadigan)</div><div class="sc-v pos" style="font-weight:600">${esc(fUSD(rows.filter((r) => r.c.qoldiq > 0).reduce((s, r) => s + r.c.qoldiq, 0)))}</div></div>
      <div class="sc"><div class="sc-l">Ortiqcha berilgan</div><div class="sc-v neg" style="font-weight:600">${esc(fUSD(rows.filter((r) => r.c.qoldiq < 0).reduce((s, r) => s + r.c.qoldiq, 0)))}</div></div></section>
      <div class="panel"><div class="panel-h"><h3>Oylik xodimlar</h3></div>
      <div class="scroll-x"><table class="tbl" style="min-width:1000px"><thead><tr><th>Xodim</th><th style="text-align:right">Oylik $</th><th style="text-align:right">Oylar</th><th style="text-align:right">Tuzatish</th><th style="text-align:right">Yoki qat'iy summa</th><th style="text-align:right">Hisoblangan</th><th style="text-align:right">Eski</th><th style="text-align:right">Avans</th><th style="text-align:right">Eski berilgan</th><th style="text-align:right">Qoldiq</th></tr></thead><tbody>
      ${rows.map(({ o, c }) => `<tr><td class="t-name">${esc(o.ism)}</td>
        <td style="text-align:right">${inpS('oylik_xodim', o.id, 'stavka', o.stavka, 70)}</td>
        <td style="text-align:right"><input class="fs" style="width:60px;min-height:34px;text-align:right" value="${o.oylar == null ? '' : o.oylar}" placeholder="${+today().slice(5, 7)}" title="Bo'sh bo'lsa — joriy oy raqami (Excel'dagi MONTH(TODAY()))" onchange="phIhSet('oylik_xodim',${o.id},'oylar',this.value)"></td>
        <td style="text-align:right">${inpS('oylik_xodim', o.id, 'tuzatish', o.tuzatish, 70)}</td>
        <td style="text-align:right">${inpS('oylik_xodim', o.id, 'summa_qolda', o.summa_qolda, 80)}</td>
        <td style="text-align:right"><b>${esc(fUSD(c.summa))}</b></td>
        <td style="text-align:right">${inpS('oylik_xodim', o.id, 'eski', o.eski, 80)}</td>
        <td style="text-align:right">${o.avans_qolda != null ? inpS('oylik_xodim', o.id, 'avans_qolda', o.avans_qolda, 80) + '<div class="t-sub">qo\'lda</div>' : esc(fUSD(c.avans))}</td>
        <td style="text-align:right">${inpS('oylik_xodim', o.id, 'eski_berilgan', o.eski_berilgan, 80)}</td>
        <td style="text-align:right;background:#F3EDE2" class="${c.qoldiq < 0 ? 'neg' : 'pos'}">${esc(fUSD(c.qoldiq))}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="display:flex;gap:8px"><input class="fs" id="oyl-new" placeholder="Yangi xodim ismi (Pul harakatidagi 'Kimga' bilan bir xil)"  style="min-width:320px"><button class="btn btn-g btn-sm" onclick="phOylAdd()">+ Xodim</button></div>
      <p class="muted" style="font-size:12px">Excel'dagidek: hisoblangan = (oylik × oylar yoki qat'iy summa) + tuzatish (masalan Xushnud: 400 × oy − 200). Oylar bo'sh bo'lsa — joriy oy raqami. Avans — Pul harakatida "Kimga" shu xodim bo'lgan rasxodlar. Qoldiq = hisoblangan + eski − avans − eski berilgan.</p></div>`;
  }
  window.phIhSet = async function (tbl, id, f, v) {
    let val = v;
    if (f === 'foiz%') { f = 'foiz'; val = v === '' ? 0 : num0(v) / 100; }
    else if (typeof v === 'string' && !['boshlanish', 'tugash'].includes(f)) val = v.trim() === '' ? (['summa_qolda', 'avans_qolda', 'oylar', 'stavka', 'summa', 'kv'].includes(f) ? null : 0) : num0(v);
    if (f === 'oylar' && val != null) val = Math.round(val);
    const { error } = await db.from(tbl).update({ [f]: val }).eq('id', id);
    if (error) { toast('⚠️', 'Saqlanmadi', error.message); return; }
    const arr = { ih_davr: PH.ihD, ih_ishchi: PH.ihW, ih_ish: PH.ihJ, oylik_xodim: PH.oyl, alohida_hisob: PH.ah, alohida_hisob_ish: PH.ahI, rasxod_plan: PH.plan, rasxod_reja: PH.reja }[tbl] || [];
    const r = arr.find((x) => x.id === id); if (r) r[f] = val;
    if (tbl === 'rasxod_plan' || tbl === 'rasxod_reja') renderTahlil(); else renderIH();
  };
  const num0 = (v) => { const x = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
  window.phIhKun = async function (jid, ism, v) {
    const j = PH.ihJ.find((x) => x.id === jid); if (!j) return;
    const it = { ...(j.ishtirok || {}) }; it[ism] = { ...(it[ism] || {}), kun: num0(v) }; if (!it[ism].kun && it[ism].foiz == null) delete it[ism];
    const { error } = await db.from('ih_ish').update({ ishtirok: it }).eq('id', jid);
    if (error) { toast('⚠️', 'Saqlanmadi', error.message); return; }
    j.ishtirok = it; renderIH();
  };
  window.phIhAddW = async function (did) {
    const nm = $('ih-new-w').value.trim(); if (!nm) return;
    const { data, error } = await db.from('ih_ishchi').insert({ davr_id: did, ism: nm, foiz: 0, tartib: 99 }).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; } PH.ihW.push(data); renderIH();
  };
  window.phIhAddJ = async function (did) {
    const nom = $('ihj-nom').value.trim(); if (!nom) { toast('⚠️', 'Ish nomini yozing', ''); return; }
    const row = { davr_id: did, nom, kv: num0($('ihj-kv').value) || null, stavka: num0($('ihj-st').value) || 10, ish_kuni: num0($('ihj-kun').value), tartib: ihJobs({ id: did }).length + 1 };
    const { data, error } = await db.from('ih_ish').insert(row).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; } PH.ihJ.push(data); renderIH();
  };
  window.phIhDelJ = async function (jid) {
    if (!confirm("Bu ish o'chirilsinmi?")) return;
    const { error } = await db.from('ih_ish').delete().eq('id', jid); if (error) { toast('⚠️', "O'chmadi", error.message); return; }
    PH.ihJ = PH.ihJ.filter((x) => x.id !== jid); renderIH();
  };
  window.phIhNewDavr = async function () {
    const bolim = prompt("Bo'lim nomi (Pergola yoki Oyna):", 'Pergola'); if (!bolim) return;
    const { data, error } = await db.from('ih_davr').insert({ bolim, nom: bolim, boshlanish: today() }).select().single();
    if (error) { toast('⚠️', 'Ochilmadi', error.message); return; } PH.ihD.push(data); PH.ihSel = data.id; renderIH();
  };
  window.phIhClose = async function (did) {
    const d = PH.ihD.find((x) => x.id === did); if (!d) return;
    if (!confirm(`"${d.nom}" davri bugun yopilsin va har bir ustaning qoldig'i yangi davrga "eski qoldiq" bo'lib o'tsinmi?`)) return;
    const c = davrCalc(d);
    const { data: nd, error } = await db.from('ih_davr').insert({ bolim: d.bolim, nom: d.bolim, boshlanish: today() }).select().single();
    if (error) { toast('⚠️', 'Ochilmadi', error.message); return; }
    const ws = c.rows.map((r, i) => ({ davr_id: nd.id, ism: r.w.ism, foiz: n0(r.w.foiz), eski_qoldiq: Math.round(r.qoldiq * 100) / 100, eski_avans: 0, tartib: i + 1 }));
    const { data: nw } = await db.from('ih_ishchi').insert(ws).select();
    await db.from('ih_davr').update({ yopilgan: true, tugash: today() }).eq('id', did);
    d.yopilgan = true; d.tugash = today(); PH.ihD.push(nd); PH.ihW.push(...(nw || [])); PH.ihSel = nd.id; toast('✅', 'Yangi davr ochildi', ''); renderIH();
  };
  window.phOylAdd = async function () {
    const nm = $('oyl-new').value.trim(); if (!nm) return;
    const { data, error } = await db.from('oylik_xodim').insert({ ism: nm, ledger_ism: nm, tartib: 99 }).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; } PH.oyl.push(data); renderIH();
  };

  // ---------- Alohida hisoblar (Excel "Лист1") ----------
  function renderAlohida() {
    $('ih-body').innerHTML = PH.ah.map((h) => {
      const its = PH.ahI.filter((x) => x.hisob_id === h.id);
      const S = its.reduce((s, x) => s + n0(x.summa), 0); const A = n0(h.avans_qolda); const Q = S - A;
      return `<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>${esc(h.ism)}</h3><div class="muted" style="font-size:13px">${esc(h.izoh || '')}</div></div>
        <section class="sg"><div class="sc dark"><div class="sc-l">Bitgan ishlar summasi</div><div class="sc-v">${esc(fUSD(S))}</div><div class="sc-s">${its.length} ta ish</div></div>
        <div class="sc"><div class="sc-l">Berilgan (avans)</div><div class="sc-v" style="font-size:30px">${esc(fUSD(A))}</div><div class="sc-s">o'zgartirish: ${inpS('alohida_hisob', h.id, 'avans_qolda', h.avans_qolda, 110)}</div></div>
        <div class="sc"><div class="sc-l">Qoldiq</div><div class="sc-v ${Q < 0 ? 'neg' : 'pos'}" style="font-weight:600">${esc(fUSD(Q))}</div><div class="sc-s">summa − avans</div></div></section>
        <div class="scroll-x"><table class="tbl" style="min-width:560px"><thead><tr><th>Qayer</th><th style="text-align:right">KV</th><th style="text-align:right">Summa ($)</th><th></th></tr></thead><tbody>
        ${its.map((x) => `<tr><td>${esc(x.nom)}</td><td style="text-align:right">${inpS('alohida_hisob_ish', x.id, 'kv', x.kv, 70)}</td><td style="text-align:right">${inpS('alohida_hisob_ish', x.id, 'summa', x.summa, 100)}</td><td><button class="btn btn-danger btn-sm" style="min-height:30px" onclick="phAhDel(${x.id})">×</button></td></tr>`).join('')}
        </tbody></table></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="fs" id="ah-n-${h.id}" placeholder="Ish nomi" style="min-width:240px"><input class="fs" id="ah-s-${h.id}" placeholder="Summa $" style="width:110px" inputmode="decimal"><button class="btn btn-g btn-sm" onclick="phAhAdd(${h.id})">+ Ish</button></div></div>`;
    }).join('') + `<div style="display:flex;gap:8px"><input class="fs" id="ah-new" placeholder="Yangi hisob (masalan: usta yoki sherik ismi)" style="min-width:300px"><button class="btn btn-g btn-sm" onclick="phAhNew()">+ Hisob ochish</button></div>`;
  }
  window.phAhAdd = async function (hid) {
    const nom = $('ah-n-' + hid).value.trim(); if (!nom) return;
    const { data, error } = await db.from('alohida_hisob_ish').insert({ hisob_id: hid, nom, summa: num0($('ah-s-' + hid).value), tartib: 999 }).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; } PH.ahI.push(data); renderIH();
  };
  window.phAhDel = async function (id) { if (!confirm("O'chirilsinmi?")) return; await db.from('alohida_hisob_ish').delete().eq('id', id); PH.ahI = PH.ahI.filter((x) => x.id !== id); renderIH(); };
  window.phAhNew = async function () {
    const ism = $('ah-new').value.trim(); if (!ism) return;
    const { data, error } = await db.from('alohida_hisob').insert({ ism, avans_qolda: 0, tartib: 99 }).select().single();
    if (error) { toast('⚠️', 'Ochilmadi', error.message); return; } PH.ah.push(data); renderIH();
  };

  // ---------- Rejalar va tahlil (Rasxod plan, Oylik analiz, Kassa nazorat) ----------
  PH.tf = { oy: today().slice(0, 7), aoy: '' };
  const isRas = (r) => r.turi === 'rasxod' || r.turi === 'eski_rasxod';
  function planCalc(p) {
    const ber = PH.rows.filter((r) => isRas(r) && key(r.zakaz) === key(p.zakaz) && key(r.vid) === key(p.vid)).reduce((s, r) => s + n0(r.summa_usd), 0);
    const q = n0(p.berish_usd) - ber; const t = today(); const w = new Date(t); w.setDate(w.getDate() + 7);
    return { ber, q, holat: Math.abs(q) < 0.005 ? 'yopildi' : q < 0 ? 'Oshiqcha bor' : 'qolgan bor', hafta: q > 0 && p.sana && p.sana >= t && p.sana <= ymd(w) };
  }
  function rejaFakt(r, oy) {
    return PH.rows.filter((x) => x.turi === 'rasxod' && (!oy || String(x.sana).startsWith(oy)) && (r.turi === 'vid' ? key(x.vid) === key(r.nom) : key(x.oluvchi) === key(r.nom) && (oy || key(x.vid) === 'oylik')))
      .reduce((s, x) => s + n0(x.summa_usd), 0);
  }
  function kassaNazorat() {
    const k = PH.soz.kassa_nazorat || { eski_ost: 0, tashqari: 0, zakazlar: [] };
    const H = (k.zakazlar || []).reduce((s, nm) => s + PH.ish.filter((i) => i.royxat === 'proalyum' && key(i.nom) === key(nm)).reduce((a, i) => a + calc(i).pul, 0), 0);
    const J = PH.rows.filter((r) => r.kimga === 'kassa' && key(r.izoh) === 'ost').reduce((s, r) => s + n0(r.summa_usd), 0);
    return { k, H, I: n0(k.eski_ost), J, K: n0(k.tashqari), L: H + n0(k.eski_ost) - J - n0(k.tashqari) };
  }
  window.phTahlilCalc = { planCalc, rejaFakt, kassaNazorat };
  function cashUSD(yon) {
    const kods = ['abdujabbor', 'abdulloh', 'muhammad'];
    let usd = 0, uzs = 0;
    PH.rows.forEach((r) => { if (r.yonalish !== yon) return; [['kimga', 1], ['kimdan', -1]].forEach(([f, sg]) => { const k = r[f]; if (!k) return; const [p, t] = k.split('_'); if (!kods.includes(p)) return; if (t === 'usd') usd += sg * r.summa; else uzs += sg * r.summa; }); });
    return usd + uzs / 12000;
  }
  function renderTahlil() {
    if (!$('th-body')) return;
    PH.agg || buildAgg();
    const pl = PH.plan.map((p) => ({ p, c: planCalc(p) }));
    const need = (y) => pl.filter((x) => x.c.hafta && x.p.yonalish === y).reduce((s, x) => s + x.c.q, 0);
    const qol = (y) => pl.filter((x) => x.p.yonalish === y).reduce((s, x) => s + x.c.q, 0);
    const ms = months();
    const rj = PH.reja.map((r) => ({ r, f: rejaFakt(r, PH.tf.oy) }));
    const rP = rj.reduce((s, x) => s + n0(x.r.plan_usd), 0), rF = rj.reduce((s, x) => s + x.f, 0);
    const by = {}; PH.rows.filter((r) => isRas(r) && (!PH.tf.aoy || String(r.sana).startsWith(PH.tf.aoy))).forEach((r) => { const v = r.vid || '(vidsiz)'; by[v] = (by[v] || 0) + n0(r.summa_usd); });
    const arr = Object.entries(by).sort((a, b) => b[1] - a[1]); const tot = arr.reduce((s, [, v]) => s + v, 0) || 1;
    const kn = kassaNazorat();
    const hc = { yopildi: 'b-tayyor', 'Oshiqcha bor': 'b-chiq', 'qolgan bor': 'b-olchov' };
    $('th-body').innerHTML = `
    <div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Rasxod plan — to'lanishi kerak bo'lganlar</h3></div>
      <section class="sg" style="margin-bottom:0">
        <div class="sc"><div class="sc-l">Pergola: 1 haftalik to'lov</div><div class="sc-v" style="font-size:28px">${esc(fUSD(need('asosiy')))}</div><div class="sc-s">kassada (Pergola): ${esc(fUSD(cashUSD('asosiy')))} → ${cashUSD('asosiy') - need('asosiy') >= 0 ? '<span class="pos">yetadi</span>' : '<span class="neg">yetmaydi</span>'}</div></div>
        <div class="sc"><div class="sc-l">Oyna: 1 haftalik to'lov</div><div class="sc-v" style="font-size:28px">${esc(fUSD(need('qoshimcha')))}</div><div class="sc-s">kassada (Oyna): ${esc(fUSD(cashUSD('qoshimcha')))} → ${cashUSD('qoshimcha') - need('qoshimcha') >= 0 ? '<span class="pos">yetadi</span>' : '<span class="neg">yetmaydi</span>'}</div></div>
        <div class="sc"><div class="sc-l">Jami qolgan to'lovlar</div><div class="sc-v" style="font-size:28px">${esc(fUSD(qol('asosiy') + qol('qoshimcha')))}</div><div class="sc-s">Pergola ${esc(fUSD(qol('asosiy')))} · Oyna ${esc(fUSD(qol('qoshimcha')))}</div></div></section>
      <div class="scroll-x"><table class="tbl" style="min-width:900px"><thead><tr><th>Zakaz</th><th>Vid</th><th style="text-align:right">Berish</th><th style="text-align:right">Berildi</th><th style="text-align:right">Qoldi</th><th>Yo'nalish</th><th>Sana</th><th>Holat</th><th></th></tr></thead><tbody>
      ${pl.map(({ p, c }) => `<tr><td class="t-name">${esc(p.zakaz)}</td><td>${esc(p.vid || '')}</td><td style="text-align:right">${inpS('rasxod_plan', p.id, 'berish_usd', p.berish_usd, 100)}</td><td style="text-align:right">${esc(fUSD(c.ber))}</td>
        <td style="text-align:right" class="${c.q < -0.005 ? 'neg' : ''}"><b>${esc(fUSD(c.q))}</b></td><td>${esc(YON[p.yonalish] || '')}</td><td class="muted">${p.sana ? esc(sanaF(p.sana)) : '—'}${c.hafta ? ' <span class="tag" style="background:#F6E7C8;color:#7E5F25">1 HAFTA</span>' : ''}</td>
        <td><span class="badge ${hc[c.holat]}">${esc(c.holat)}</span></td><td><button class="btn btn-danger btn-sm" style="min-height:30px" onclick="phPlanDel(${p.id})">×</button></td></tr>`).join('')}
      </tbody></table></div>
      <form onsubmit="return false" style="display:grid;grid-template-columns:2fr 1.4fr 1fr 1fr 1fr auto;gap:8px;align-items:end">
        <div><label class="fl">Zakaz</label><input class="fi" id="pl-z" list="pl-zs"><datalist id="pl-zs">${[...new Set(PH.ish.map((i) => i.nom))].map((n) => `<option value="${esc(n)}">`).join('')}</datalist></div>
        <div><label class="fl">Vid</label><input class="fi" id="pl-v" list="pf-vids2"><datalist id="pf-vids2">${VIDLAR.map((v) => `<option value="${esc(v)}">`).join('')}</datalist></div>
        <div><label class="fl">Berish ($)</label><input class="fi" id="pl-s" inputmode="decimal"></div>
        <div><label class="fl">Yo'nalish</label><select class="fi" id="pl-y"><option value="asosiy">Pergola</option><option value="qoshimcha">Oyna</option></select></div>
        <div><label class="fl">Sana</label><input class="fi" type="date" id="pl-d"></div>
        <button type="button" class="btn btn-a" onclick="phPlanAdd()">+ Qo'shish</button></form></div>
    <div class="grid2">
      <div class="panel col2"><div class="panel-h"><h3>Oylik reja (obyektdan tashqari)</h3><select class="fs" id="th-oy">${ms.map((m) => `<option value="${m}" ${m === PH.tf.oy ? 'selected' : ''}>${oyNom(m)}</option>`).join('')}</select></div>
        <table class="tbl"><thead><tr><th>Nom</th><th style="text-align:right">Reja</th><th style="text-align:right">Fakt</th><th style="text-align:right">Farq</th><th>Holat</th></tr></thead><tbody>
        ${rj.map(({ r, f }) => { const d = n0(r.plan_usd) - f; return `<tr><td>${esc(r.nom)}<div class="t-sub">${r.turi === 'vid' ? 'vid' : 'kimga'}</div></td><td style="text-align:right">${inpS('rasxod_reja', r.id, 'plan_usd', r.plan_usd, 90)}</td><td style="text-align:right">${esc(fUSD(f))}</td><td style="text-align:right" class="${d < 0 ? 'neg' : 'pos'}">${esc(fUSD(d))}</td><td>${d > 0.005 ? 'Tejaldi' : d < -0.005 ? '<span class="neg">Oshib ketdi</span>' : 'rejada'}</td></tr>`; }).join('')}
        <tr><td><b>Jami</b></td><td style="text-align:right"><b>${esc(fUSD(rP))}</b></td><td style="text-align:right"><b>${esc(fUSD(rF))}</b></td><td style="text-align:right" class="${rP - rF < 0 ? 'neg' : 'pos'}"><b>${esc(fUSD(rP - rF))}</b></td><td></td></tr></tbody></table>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="fs" id="rj-n" placeholder="Vid yoki xodim ismi"><select class="fs" id="rj-t"><option value="vid">vid</option><option value="oluvchi">kimga (xodim)</option></select><input class="fs" id="rj-p" placeholder="Reja $" style="width:100px" inputmode="decimal"><button class="btn btn-g btn-sm" onclick="phRejaAdd()">+ Reja</button></div></div>
      <div class="panel col1"><h3 style="font-size:22px">Kassa nazorat</h3>
        ${[['Jami foyda (zakazlardan)', kn.H], ['Eski ost', kn.I], ['Berildi (Kassa · ost)', -kn.J], ['Tashqari', -kn.K]].map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ECE4D4;font-size:14px"><span class="muted">${l}</span><b>${esc(fUSD(v))}</b></div>`).join('')}
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:16px"><span>Qoldiq</span><b class="${kn.L < 0 ? 'neg' : 'pos'}">${esc(fUSD(kn.L))}</b></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label class="fl">Eski ost</label><input class="fi" id="kn-eo" value="${esc(kn.I)}" inputmode="decimal"></div><div><label class="fl">Tashqari</label><input class="fi" id="kn-t" value="${esc(kn.K)}" inputmode="decimal"></div></div>
        <div><label class="fl">Zakazlar (Proalyum ro'yxatidan, vergul bilan)</label><input class="fi" id="kn-z" value="${esc((kn.k.zakazlar || []).join(', '))}"></div>
        <button class="btn btn-g btn-sm" onclick="phKnSave()">Saqlash</button></div>
    </div>
    <div class="panel"><div class="panel-h"><h3>Oylik analiz — rasxod vidlar bo'yicha</h3><select class="fs" id="th-aoy"><option value="">Hamma vaqt</option>${ms.map((m) => `<option value="${m}" ${m === PH.tf.aoy ? 'selected' : ''}>${oyNom(m)}</option>`).join('')}</select></div>
      <div style="display:flex;flex-direction:column;gap:9px">${arr.map(([k, v]) => `<div style="display:grid;grid-template-columns:170px minmax(0,1fr) 110px 48px;gap:12px;align-items:center;font-size:13px"><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><div class="prog" style="height:8px"><div class="prog-f" style="width:${(v / arr[0][1]) * 100}%"></div></div><span style="text-align:right">${esc(fUSD(v))}</span><span class="muted" style="text-align:right">${Math.round((v / tot) * 100)}%</span></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px"><b>Jami</b><b>${esc(fUSD(arr.reduce((s, [, v]) => s + v, 0)))}</b></div></div>`;
  }
  window.phPlanAdd = async function () {
    const z = $('pl-z').value.trim(); if (!z) { toast('⚠️', 'Zakaz nomini yozing', ''); return; }
    const row = { zakaz: z, vid: $('pl-v').value.trim() || null, berish_usd: num0($('pl-s').value), yonalish: $('pl-y').value, sana: $('pl-d').value || null, tartib: 999 };
    const { data, error } = await db.from('rasxod_plan').insert(row).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; } PH.plan.push(data); renderTahlil();
  };
  window.phPlanDel = async function (id) { if (!confirm("O'chirilsinmi?")) return; await db.from('rasxod_plan').delete().eq('id', id); PH.plan = PH.plan.filter((x) => x.id !== id); renderTahlil(); };
  window.phRejaAdd = async function () {
    const nom = $('rj-n').value.trim(); if (!nom) return;
    const { data, error } = await db.from('rasxod_reja').insert({ nom, turi: $('rj-t').value, plan_usd: num0($('rj-p').value), tartib: 99 }).select().single();
    if (error) { toast('⚠️', "Qo'shilmadi", error.message); return; } PH.reja.push(data); renderTahlil();
  };
  window.phKnSave = async function () {
    const q = { eski_ost: num0($('kn-eo').value), tashqari: num0($('kn-t').value), zakazlar: $('kn-z').value.split(',').map((x) => x.trim()).filter(Boolean) };
    const { error } = await db.from('bux_sozlama').upsert({ kalit: 'kassa_nazorat', qiymat: q });
    if (error) { toast('⚠️', 'Saqlanmadi', error.message); return; } PH.soz.kassa_nazorat = q; toast('✅', 'Saqlandi', ''); renderTahlil();
  };

  // ---------- hodisalar ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#ph-turi button'); if (t) { PH.f.turi = t.dataset.v; PH.limit = 300; renderPH(); return; }
    const y = e.target.closest('#ph-yon button'); if (y) { PH.f.yon = y.dataset.v; PH.limit = 300; renderPH(); return; }
    const m = e.target.closest('#ph-mode button'); if (m) { phMode(m.dataset.m); return; }
    const q = e.target.closest('#qd-tur button'); if (q) { phQd('tur', q.dataset.v); return; }
    const ir = e.target.closest('#ish-r button'); if (ir) { PH.ishF.r = ir.dataset.v; renderIshlar(); return; }
    const ih = e.target.closest('#ish-h button'); if (ih) { PH.ishF.h = ih.dataset.v; renderIshlar(); return; }
    const it = e.target.closest('#ih-tab button'); if (it) { PH.ihTab = it.dataset.v; renderIH(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'ph-oy') { PH.f.oy = e.target.value; PH.limit = 300; renderPH(); }
    if (e.target.id === 'ph-ham') { PH.f.ham = e.target.value; PH.limit = 300; renderPH(); }
    if (e.target.id === 'qd-oy') phQd('oy', e.target.value);
    if (e.target.id === 'qd-kun') phQd('kun', e.target.value);
    if (e.target.id === 'th-oy') { PH.tf.oy = e.target.value; renderTahlil(); }
    if (e.target.id === 'th-aoy') { PH.tf.aoy = e.target.value; renderTahlil(); }
  });
  let _q; document.addEventListener('input', (e) => { if (e.target.id === 'ish-q') { clearTimeout(_q); _q = setTimeout(() => { PH.ishF.q = e.target.value; renderIshlar(); }, 250); return; } if (e.target.id === 'ph-q') { clearTimeout(_q); _q = setTimeout(() => { PH.f.q = e.target.value; PH.limit = 300; renderPH(); }, 250); } });

  // ---------- Boshqaruv paneli: pul oqimi + obyekt pasportlari ----------
  PH.pf = { m: 'oy', oy: today().slice(0, 7), kun: today(), st: 'Jarayonda', q: '', sort: 'foyda', open: null };
  const isPri = (r) => r.turi === 'prixod' || r.turi === 'eski_prixod';
  const isXar = (r) => (r.turi === 'rasxod' || r.turi === 'eski_rasxod') && !['kassa', 'foyda'].includes(key(r.vid));
  const isKas = (r) => (r.turi === 'rasxod' || r.turi === 'eski_rasxod') && ['kassa', 'foyda'].includes(key(r.vid));
  const usd = (r) => n0(r.summa_usd);
  function flow(rows) { const o = { p: 0, r: 0, k: 0 }; rows.forEach((x) => { if (isPri(x)) o.p += usd(x); else if (isXar(x)) o.r += usd(x); else if (isKas(x)) o.k += usd(x); }); return o; }
  function renderPanel() {
    if (!$('pn-body')) return;
    buildAgg();
    const f = PH.pf;
    const sel = f.m === 'kun' ? PH.rows.filter((r) => String(r.sana) === f.kun) : PH.rows.filter((r) => String(r.sana).startsWith(f.oy));
    const F = flow(sel); const sof = F.p - F.r;
    const prevOy = (() => { const d = new Date(f.oy + '-01'); d.setMonth(d.getMonth() - 1); return ymd(d).slice(0, 7); })();
    const Fp = f.m === 'oy' ? flow(PH.rows.filter((r) => String(r.sana).startsWith(prevOy))) : null;
    const dlt = (a, b) => (b ? `<div class="sc-s">o'tgan oy: ${esc(fUSD(b))}</div>` : '');
    let h = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <div class="seg" id="pn-m"><button data-v="kun" class="${f.m === 'kun' ? 'on' : ''}">Kunlik</button><button data-v="oy" class="${f.m === 'oy' ? 'on' : ''}">Oylik</button></div>
      ${f.m === 'kun' ? `<input type="date" class="fs" id="pn-kun" value="${esc(f.kun)}" style="min-height:40px">`
        : `<select class="fs" id="pn-oy" style="min-height:40px">${months().map((m) => `<option value="${m}" ${m === f.oy ? 'selected' : ''}>${esc(oyNom(m))}</option>`).join('')}</select>`}
      <span class="muted" style="font-size:12px">Hammasi $ da (so'm o'sha kungi kurs bilan o'girilgan)</span></div>
    <section class="sg">
      <div class="sc"><div class="sc-l">Prixod — kelgan pul</div><div class="sc-v pos">${esc(fUSD(F.p))}</div>${f.m === 'oy' ? dlt(F.p, Fp.p) : ''}</div>
      <div class="sc"><div class="sc-l">Rasxod — xarajatlar</div><div class="sc-v neg">${esc(fUSD(F.r))}</div>${f.m === 'oy' ? dlt(F.r, Fp.r) : ''}</div>
      <div class="sc dark"><div class="sc-l">Sof (prixod − rasxod)</div><div class="sc-v">${esc((sof >= 0 ? '+' : '') + fUSD(sof))}</div><div class="sc-s">${F.p ? Math.round((sof / F.p) * 100) + '% prixoddan' : ''}</div></div>
      <div class="sc"><div class="sc-l">Kassaga olindi (foyda)</div><div class="sc-v">${esc(fUSD(F.k))}</div><div class="sc-s">xarajat emas</div></div>
    </section>`;
    if (f.m === 'oy') {
      const [y, m] = f.oy.split('-').map(Number); const nd = new Date(y, m, 0).getDate();
      const days = Array.from({ length: nd }, (_, i) => { const d = f.oy + '-' + String(i + 1).padStart(2, '0'); return { d, ...flow(sel.filter((r) => String(r.sana) === d)) }; });
      const mx = Math.max(1, ...days.map((x) => Math.max(x.p, x.r)));
      const W = 900, H = 220, bw = W / nd;
      const bars = days.map((x, i) => { const hp = (x.p / mx) * (H / 2 - 14), hr = (x.r / mx) * (H / 2 - 14); return `<g style="cursor:pointer" onclick="phPanelDay('${x.d}')"><title>${+x.d.slice(8)}-kun · prixod ${fUSD(x.p)} · rasxod ${fUSD(x.r)}</title><rect x="${i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/><rect x="${i * bw + bw * 0.18}" y="${H / 2 - hp}" width="${bw * 0.64}" height="${hp}" rx="2" fill="#4F8A5B"/><rect x="${i * bw + bw * 0.18}" y="${H / 2}" width="${bw * 0.64}" height="${hr}" rx="2" fill="#B5543C"/>${(i + 1) % 5 === 1 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" font-size="11" text-anchor="middle" fill="#8A8072">${i + 1}</text>` : ''}</g>`; }).join('');
      const yon = (yv) => flow(sel.filter((r) => (r.yonalish || '') === yv));
      const A = yon('asosiy'), Q = yon('qoshimcha');
      h += `<div class="panel" style="margin-bottom:20px"><div class="panel-h"><h3>Kunma-kun: ${esc(oyNom(f.oy))}</h3><span class="muted" style="font-size:12px"><span style="color:#4F8A5B">■</span> prixod &nbsp; <span style="color:#B5543C">■</span> rasxod · kunni bosing</span></div>
        <div style="padding:16px 20px;overflow-x:auto"><svg viewBox="0 0 ${W} ${H + 20}" style="width:100%;min-width:560px;height:auto"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#D8CFC0"/>${bars}</svg></div>
        <div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Yo'nalish</th><th style="text-align:right">Prixod</th><th style="text-align:right">Rasxod</th><th style="text-align:right">Sof</th></tr></thead><tbody>
        <tr><td>Pergola (asosiy)</td><td style="text-align:right" class="pos">${esc(fUSD(A.p))}</td><td style="text-align:right" class="neg">${esc(fUSD(A.r))}</td><td style="text-align:right;font-weight:600">${esc(fUSD(A.p - A.r))}</td></tr>
        <tr><td>Oyna (qo'shimcha)</td><td style="text-align:right" class="pos">${esc(fUSD(Q.p))}</td><td style="text-align:right" class="neg">${esc(fUSD(Q.r))}</td><td style="text-align:right;font-weight:600">${esc(fUSD(Q.p - Q.r))}</td></tr></tbody></table></div></div>`;
    } else {
      const ls = sel.filter((r) => isPri(r) || isXar(r) || isKas(r)).sort((a, b) => isPri(b) - isPri(a) || usd(b) - usd(a));
      h += `<div class="panel" style="margin-bottom:20px"><div class="panel-h"><h3>${esc(sanaF(f.kun))} — ${ls.length} ta yozuv</h3></div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Turi</th><th>Kim</th><th>Obyekt</th><th>Nima uchun</th><th style="text-align:right">Summa</th></tr></thead><tbody>
        ${ls.length ? ls.map((r) => `<tr><td>${isPri(r) ? '<span class="badge b-tayyor">Prixod</span>' : isKas(r) ? '<span class="badge b-smeta">Kassaga</span>' : '<span class="badge b-chiq">Rasxod</span>'}${r.manba === 'daftar' ? '<div class="t-sub">menejer daftari</div>' : ''}</td><td>${esc(hNom(isPri(r) ? r.kimga : r.kimdan))}</td><td>${esc(r.zakaz || '—')}</td><td>${esc([r.vid, r.oluvchi, r.izoh].filter(Boolean).join(' · ') || '—')}</td><td style="text-align:right;font-weight:600" class="${isPri(r) ? 'pos' : 'neg'}">${esc(money(r.summa, r.valyuta))}${r.valyuta === 'uzs' && usd(r) ? `<div class="t-sub">${esc(fUSD(usd(r)))}</div>` : ''}</td></tr>`).join('')
          : '<tr><td colspan="5"><div class="empty"><div class="empty-t">Bu kunda yozuv yo\'q</div></div></td></tr>'}</tbody></table></div></div>`;
    }
    // ---- obyekt pasportlari ----
    const q = key(f.q);
    let L = PH.ish.filter((i) => (i.nom || '').trim() && !/^\d+([.,]\d+)?$/.test(String(i.nom).trim()))
      .filter((i) => (!f.st || (i.holat || '') === f.st) && (!q || key(i.nom).includes(q)))
      .map((i) => { const c = calc(i); const tan = c.X; const fo = c.S - tan; return { i, c, tan, fo, fp: c.S ? fo / c.S : null }; });
    const so = { foyda: (a, b) => (a.fp ?? 9) - (b.fp ?? 9), qarz: (a, b) => b.c.qarz - a.c.qarz, yangi: (a, b) => String(b.i.boshlandi || '').localeCompare(String(a.i.boshlandi || '')) || b.i.id - a.i.id, katta: (a, b) => b.c.S - a.c.S };
    L.sort(so[f.sort] || so.foyda);
    const tS = L.reduce((s, x) => s + x.c.S, 0), tT = L.reduce((s, x) => s + x.tan, 0);
    const tone = (fp) => (fp == null ? 'var(--text3)' : fp < 0.15 ? '#B5543C' : fp < 0.3 ? '#C08A2E' : '#4F8A5B');
    h += `<div class="panel-h" style="padding:0;margin:8px 0 14px"><h3 style="font-size:22px">Obyekt pasportlari</h3></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <div class="seg" id="pn-st">${[['Jarayonda', 'Jarayonda'], ['', 'Hammasi'], ['Tugadi', 'Tugagan']].map(([v, t]) => `<button data-v="${v}" class="${f.st === v ? 'on' : ''}">${t}</button>`).join('')}</div>
      <select class="fs" id="pn-sort" style="min-height:40px">${[['foyda', 'Foydasi eng kam'], ['katta', 'Eng katta obyekt'], ['qarz', 'Mijoz qarzi'], ['yangi', 'Eng yangi']].map(([v, t]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <input class="fs" id="pn-q" placeholder="Obyekt qidirish…" value="${esc(f.q)}" style="min-height:40px;max-width:220px">
      <span class="muted" style="font-size:13px">${L.length} ta · shartnoma ${esc(fUSD(tS))} · tannarx ${esc(fUSD(tT))} · foyda <b>${esc(fUSD(tS - tT))}</b></span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:24px;align-items:start">
    ${L.length ? L.map(({ i, c, tan, fo, fp }) => { const sh = c.S ? Math.min(100, Math.round((tan / c.S) * 100)) : 0; const tp = c.S ? Math.min(100, Math.round((c.T / c.S) * 100)) : 0; const op = PH.pf.open === i.id;
      const xs = Object.entries(c.xar).filter(([, v]) => Math.abs(v) > 0.005).sort((a, b) => b[1] - a[1]);
      const lab = Object.fromEntries(XCOLS);
      const dft = c.a.rows.filter((r) => r.manba === 'daftar' && isXar(r)).reduce((s, r) => s + usd(r), 0);
      return `<div class="sc" style="cursor:pointer;border-left:4px solid ${tone(fp)}" onclick="phPanelOpen(${i.id})">
        <div style="display:flex;justify-content:space-between;gap:8px"><div><div class="t-name" style="font-size:16px">${esc(i.nom)}</div><div class="t-sub">${esc(ROYXAT[i.royxat] || '')}${i.kod ? ' · ' + esc(i.kod) : ''}${i.kv ? ' · ' + esc(+i.kv) + ' m²' : ''}</div></div>${i.holat ? `<span class="badge ${{ Tugadi: 'b-tayyor', Jarayonda: 'b-olchov' }[i.holat] || 'b-new'}">${esc(i.holat)}</span>` : ''}</div>
        ${c.S ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:14px 0 10px;font-size:12px">
          <div><div class="muted">Shartnoma</div><div style="font-weight:700;font-size:15px">${esc(fUSD(c.S))}</div></div>
          <div><div class="muted">Tannarx</div><div style="font-weight:700;font-size:15px" class="neg">${esc(fUSD(tan))}</div></div>
          <div><div class="muted">Foyda</div><div style="font-weight:700;font-size:15px;color:${tone(fp)}">${esc(fUSD(fo))}</div><div class="t-sub">${fp != null ? Math.round(fp * 100) + '%' : ''}</div></div></div>
          <div class="prog" title="Tannarx shartnomaning ${sh}%"><div class="prog-f" style="width:${sh}%;background:${tone(fp)}"></div></div>
          <div class="t-sub" style="margin-top:8px">Mijozdan tushgan ${esc(fUSD(c.T))} (${tp}%)${c.qarz > 0.5 ? ` · qarz <b>${esc(fUSD(c.qarz))}</b>` : ''}${dft ? ` · menejer daftaridan ${esc(fUSD(dft))}` : ''}</div>`
        : `<div class="t-sub" style="margin-top:12px">Shartnoma summasi kiritilmagan · tannarx ${esc(fUSD(tan))}</div>`}
        ${op ? `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px" onclick="event.stopPropagation()">
          <div style="font-size:12px;font-weight:700;margin-bottom:6px">Tannarx tarkibi</div>
          ${xs.length ? xs.map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span>${esc(lab[k] || k)}</span><span>${esc(fUSD(v))}</span></div>`).join('') : '<div class="t-sub">Xarajat yo\'q</div>'}
          <div style="font-size:12px;font-weight:700;margin:12px 0 6px">Oxirgi xarajatlar</div>
          ${c.a.rows.filter(isXar).sort((a, b) => String(b.sana).localeCompare(String(a.sana))).slice(0, 8).map((r) => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0"><span>${esc(sanaF(r.sana))} · ${esc(r.vid || '—')}${r.manba === 'daftar' ? ' · <span class="muted">daftar</span>' : ''}</span><span>${esc(fUSD(usd(r)))}</span></div>`).join('') || '<div class="t-sub">—</div>'}
        </div>` : ''}
      </div>`; }).join('') : '<div class="empty"><div class="empty-t">Obyekt topilmadi</div></div>'}
    </div>`;
    // ---- bog'lanmagan menejer obyektlari ----
    const ub = (PH.obj || []).filter((o) => !o.ish_id);
    if (ub.length) {
      const opts = PH.ish.filter((i) => i.holat !== 'Tugadi' && (i.nom || '').trim() && !/^\d/.test(i.nom)).sort((a, b) => a.nom.localeCompare(b.nom));
      h += `<div class="panel"><div class="panel-h"><h3>Zakazga bog'lanmagan menejer obyektlari</h3><span class="muted" style="font-size:12px">bog'lansa, xarajatlari pasportga qo'shiladi</span></div><div style="overflow-x:auto"><table class="tbl"><tbody>
        ${ub.map((o) => { const s = PH.rows.filter((r) => r.manba === 'daftar' && key(r.zakaz) === key(o.nom) && isXar(r)).reduce((a, r) => a + usd(r), 0);
          return `<tr><td><b>${esc(o.nom)}</b><div class="t-sub">${esc(fUSD(s))} xarajat</div></td><td><select class="fs" onchange="phObjLink(${o.id},this.value)"><option value="">Zakazni tanlang…</option>${opts.map((i) => `<option value="${i.id}">${esc(i.nom)}</option>`).join('')}</select></td></tr>`; }).join('')}
      </tbody></table></div></div>`;
    }
    $('pn-body').innerHTML = h;
  }
  window.phPanelDay = (d) => { PH.pf.m = 'kun'; PH.pf.kun = d; renderPanel(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  window.phPanelOpen = (id) => { PH.pf.open = PH.pf.open === id ? null : id; renderPanel(); };
  window.phObjLink = async (oid, ish) => {
    if (!ish) return;
    const { error } = await db.from('rasxod_obyektlar').update({ ish_id: +ish }).eq('id', oid);
    if (error) { toast('⚠️', "Bog'lanmadi", error.message); return; }
    toast('✅', "Bog'landi", 'Xarajatlar pasportga qo\'shildi'); await phLoad(); renderPanel();
  };
  document.addEventListener('click', (e) => {
    const m = e.target.closest('#pn-m button'); if (m) { PH.pf.m = m.dataset.v; renderPanel(); return; }
    const s = e.target.closest('#pn-st button'); if (s) { PH.pf.st = s.dataset.v; renderPanel(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'pn-oy') { PH.pf.oy = e.target.value; renderPanel(); }
    if (e.target.id === 'pn-kun') { PH.pf.kun = e.target.value; renderPanel(); }
    if (e.target.id === 'pn-sort') { PH.pf.sort = e.target.value; renderPanel(); }
  });
  let _pq; document.addEventListener('input', (e) => { if (e.target.id === 'pn-q') { clearTimeout(_pq); _pq = setTimeout(() => { PH.pf.q = e.target.value; renderPanel(); const el = $('pn-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 300); } });
})();
