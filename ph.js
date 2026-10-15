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
      PH.loaded = true;
    } catch (e) { console.error(e); toast('⚠️', 'Pul harakati yuklanmadi', e.message || ''); }
    PH.loading = false;
  }
  let _t; function sched() { clearTimeout(_t); _t = setTimeout(async () => { await phLoad(); phRender(); }, 600); }
  let subscribed = false;
  async function phStart() {
    if (!boss()) return;
    await phLoad();
    if (!subscribed) { subscribed = true; db.channel('ph').on('postgres_changes', { event: '*', schema: 'public', table: 'pul_harakati' }, sched).subscribe(); }
    phRender();
  }
  window.phRenderPage = async function (p) {
    if (p !== 'ph' && p !== 'qoldiq') return;
    if (!PH.loaded) { $('ph-tbody') && ($('ph-tbody').innerHTML = '<tr><td colspan="9"><div class="empty"><div class="empty-t">Yuklanmoqda…</div></div></td></tr>'); await phStart(); }
    else phRender();
  };
  function phRender() {
    const p = document.querySelector('.ni.on')?.dataset.page;
    if (p === 'ph') renderPH();
    if (p === 'qoldiq') renderQoldiq();
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
    toast('✅', PH.edit ? 'Yangilandi' : 'Saqlandi', ''); PH.edit = null;
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

  // ---------- hodisalar ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('#ph-turi button'); if (t) { PH.f.turi = t.dataset.v; PH.limit = 300; renderPH(); return; }
    const y = e.target.closest('#ph-yon button'); if (y) { PH.f.yon = y.dataset.v; PH.limit = 300; renderPH(); return; }
    const m = e.target.closest('#ph-mode button'); if (m) { phMode(m.dataset.m); return; }
    const q = e.target.closest('#qd-tur button'); if (q) { phQd('tur', q.dataset.v); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'ph-oy') { PH.f.oy = e.target.value; PH.limit = 300; renderPH(); }
    if (e.target.id === 'ph-ham') { PH.f.ham = e.target.value; PH.limit = 300; renderPH(); }
    if (e.target.id === 'qd-oy') phQd('oy', e.target.value);
    if (e.target.id === 'qd-kun') phQd('kun', e.target.value);
  });
  let _q; document.addEventListener('input', (e) => { if (e.target.id === 'ph-q') { clearTimeout(_q); _q = setTimeout(() => { PH.f.q = e.target.value; PH.limit = 300; renderPH(); }, 250); } });
})();
