/* Tentart ERP — Tentart zakazlari va BFB bilan hisob (Abdujabbor 2026.xlsx asosida)
   Narx (umumiy) → BFB ulushi (Excel "Kassa") → Tentart'ga qoladi → Rasxod 2 / Rasxod 1 → zakaz foydasi; Rasxod 3 = umumiy xarajat. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (v) => Number(v) || 0;
  const fU = (v) => { const x = Math.round(n0(v)); return (x < 0 ? '−' : '') + '$' + Math.abs(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 + '%' : '—');
  const key = (s) => String(s || '').trim().toLowerCase();
  const OY = ['', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  const toast = (ic, t, s) => (typeof notif === 'function' ? notif(ic, t, s) : null);
  const boss = () => { try { return ['Owner', 'Kassir'].includes(curUser?.rol); } catch (e) { return false; } };

  const TZ = { z: [], r1: [], r3: [], loaded: false, f: { d: '', t: 'all', s: 'tartib', q: '' }, open: null };
  window.TZ = TZ;

  async function load() {
    const [a, b, c] = await Promise.all([
      db.from('tz_zakaz').select('*').order('davr').order('tartib'),
      db.from('tz_rasxod1').select('*').order('id'),
      db.from('tz_rasxod3').select('*').order('davr').order('oy').order('id')]);
    if (a.error) { toast('⚠️', 'Zakazlar yuklanmadi', a.error.message); return; }
    TZ.z = a.data || []; TZ.r1 = b.data || []; TZ.r3 = c.data || []; TZ.loaded = true;
  }
  const davrlar = () => [...new Set([...TZ.z.map((x) => x.davr), ...TZ.r3.map((x) => x.davr)])].sort();
  const davrNom = (d) => { const [a, b] = String(d).split('-').map(Number); return a && b ? `${OY[a]}–${OY[b]}` : d; };

  // Kod bo'yicha bitta zakaz: bir nechta qator/davr bo'lsa yig'iladi
  function orders(d) {
    const M = new Map();
    const get = (kod, row) => {
      const k = key(kod) || 'id:' + row?.id;
      if (!M.has(k)) M.set(k, { k, kod: kod || '', rows: [], r1: [], nom: '', sistema: '', davr: new Set(), motor: 0, U: 0, A: 0, R2: 0, B: 0, O: 0, R1: 0, tartib: 1e9 });
      return M.get(k);
    };
    TZ.z.filter((x) => !d || x.davr === d).forEach((x) => {
      const o = get(x.kod, x); o.rows.push(x); o.nom = o.nom || x.nom; o.sistema = o.sistema || x.sistema; o.davr.add(x.davr);
      o.motor += n0(x.motor); o.U += n0(x.umumiy); o.A += n0(x.avans); o.R2 += n0(x.rasxod2); o.B += n0(x.bfb_ulush); o.O += n0(x.bfb_tolov);
      o.tartib = Math.min(o.tartib, (x.davr === davrlar()[0] ? 0 : 1000) + n0(x.tartib));
    });
    TZ.r1.filter((x) => !d || x.davr === d).forEach((x) => { const o = get(x.kod); o.r1.push(x); o.R1 += n0(x.summa); o.davr.add(x.davr); });
    // faqat rasxod 1 bo'lgan kod — nomini boshqa davrdagi zakazdan olamiz
    M.forEach((o) => { if (!o.rows.length) { const z = TZ.z.find((x) => key(x.kod) === o.k); o.nom = z ? z.nom + ' (oldingi zakazga qo\'shimcha)' : 'Qo\'shimcha rasxod'; o.sistema = z?.sistema || ''; o.tartib = 5e8; } });
    M.forEach((o) => {
      o.qarz = o.U > 0 ? Math.max(0, o.U - o.A) : 0;      // mijoz qarzi
      o.ort = o.U > 0 ? Math.max(0, o.A - o.U) : 0;       // mijoz ortiqcha to'lagan
      o.bfb = o.B - o.O;                                  // + BFB'ga beriladi, − BFB'da ortiqcha
      o.qol = o.U - o.B;                                  // Tentart'ga qoladi
      o.F = o.U - o.B - o.R2 - o.R1;                      // zakaz foydasi (umumiy xarajatdan oldin)
      o.narxsiz = o.rows.length > 0 && o.U <= 0;
      o.holat = (o.rows.find((r) => r.holat) || {}).holat || '';
      o.deadline = (o.rows.find((r) => r.deadline) || {}).deadline || '';
    });
    return [...M.values()];
  }
  function jami(list, d) {
    const s = (f) => list.reduce((a, o) => a + n0(o[f]), 0);
    const R3 = TZ.r3.filter((x) => !d || x.davr === d).reduce((a, x) => a + n0(x.summa), 0);
    const J = { n: list.filter((o) => o.rows.length).length, U: s('U'), A: s('A'), Q: s('qarz'), ORT: s('ort'), B: s('B'), O: s('O'), R2: s('R2'), R1: s('R1'), R3,
      BQ: list.reduce((a, o) => a + Math.max(0, o.bfb), 0), BO: list.reduce((a, o) => a + Math.max(0, -o.bfb), 0) };
    J.F = J.U - J.B - J.R2 - J.R1 - J.R3; J.QOL = J.U - J.B;
    return J;
  }

  function render() {
    const el = $('tz-body'); if (!el) return;
    if (!TZ.loaded) { el.innerHTML = '<div class="empty"><div class="empty-t">Yuklanmoqda…</div></div>'; return; }
    const f = TZ.f, ds = davrlar();
    let list = orders(f.d);
    const J = jami(list, f.d);
    const q = key(f.q);
    if (q) list = list.filter((o) => key(o.nom).includes(q) || key(o.kod).includes(q) || key(o.sistema).includes(q));
    if (f.t === 'zarar') list = list.filter((o) => o.F < 0);
    if (f.t === 'qarz') list = list.filter((o) => o.qarz > 0.5);
    if (f.t === 'bfb') list = list.filter((o) => o.bfb > 0.5);
    if (f.t === 'ort') list = list.filter((o) => o.bfb < -0.5 || o.ort > 0.5);
    if (f.t === 'narxsiz') list = list.filter((o) => o.narxsiz);
    if (f.s === 'tartib') list.sort((a, b) => a.tartib - b.tartib);
    if (f.s === 'f_up') list.sort((a, b) => a.F - b.F);
    if (f.s === 'f_down') list.sort((a, b) => b.F - a.F);
    if (f.s === 'qarz') list.sort((a, b) => b.qarz - a.qarz);

    const seg = (id, cur, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const card = (l, v, s, cls) => `<div class="sc ${cls || ''}"><div class="sc-l">${l}</div><div class="sc-v">${v}</div><div class="sc-s">${s || ''}</div></div>`;
    let h = `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      ${seg('tz-d', f.d, [['', 'Hammasi'], ...ds.map((d) => [d, davrNom(d)])])}
      <input class="fs" id="tz-q" placeholder="Qidirish: nom, kod" value="${esc(f.q)}" style="min-height:40px;max-width:220px"></div>
    <section class="sg">
      ${card('Zakazlar', `<span>${fU(J.U)}</span>`, `${J.n} ta zakaz${f.d ? ' · ' + davrNom(f.d) : ' · ' + ds.length + ' davr'}`)}
      ${card('Mijozdan tushgan', `<span class="pos">${fU(J.A)}</span>`, `mijozlar qarzi: <b>${fU(J.Q)}</b>${J.ORT ? ` · ortiqcha to'lagan ${fU(J.ORT)}` : ''}`)}
      ${card('BFB ulushi (Kassa)', fU(J.B), `to'landi ${fU(J.O)} · <b style="color:#9A3B2E">BFB'ga qarz ${fU(J.BQ)}</b> · BFB'da ortiqcha ${fU(J.BO)}`)}
      ${card("Tentart'ga qoladi", fU(J.QOL), `zakazlarning ${pct(J.QOL, J.U)}`)}
      ${card('Rasxodlar', `<span class="neg">${fU(J.R2 + J.R1 + J.R3)}</span>`, `R2 montaj ${fU(J.R2)} · R1 qo'shimcha ${fU(J.R1)} · R3 umumiy ${fU(J.R3)}`)}
      ${card('Sof foyda', fU(J.F), `zakazlarning ${pct(J.F, J.U)} · yarmi ${fU(J.F / 2)}`, 'dark')}
    </section>`;

    // Davrlar solishtiruvi — Excel'dagi o'ng tomondagi hisob bilan bir xil
    const rowsD = ds.map((d) => [davrNom(d), jami(orders(d), d)]);
    if (ds.length > 1) rowsD.push(['Jami', jami(orders(''), '')]);
    h += `<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Davrlar bo'yicha (Excel bilan solishtirish)</h3></div><div class="scroll-x"><table class="tbl" style="min-width:980px"><thead><tr>
      <th>Davr</th><th style="text-align:right">Zakaz</th><th style="text-align:right">Tushgan</th><th style="text-align:right">Mijoz qarzi</th><th style="text-align:right">BFB ulushi</th><th style="text-align:right">BFB'ga to'landi</th><th style="text-align:right">BFB ostatok</th><th style="text-align:right">R1</th><th style="text-align:right">R2</th><th style="text-align:right">R3</th><th style="text-align:right">Farq (foyda)</th><th style="text-align:right">%</th></tr></thead><tbody>
      ${rowsD.map(([n, x], i) => `<tr style="${i === rowsD.length - 1 && ds.length > 1 ? 'font-weight:700' : ''}"><td>${esc(n)}</td><td style="text-align:right">${fU(x.U)}</td><td style="text-align:right">${fU(x.A)}</td><td style="text-align:right">${fU(x.Q)}</td><td style="text-align:right">${fU(x.B)}</td><td style="text-align:right">${fU(x.O)}</td><td style="text-align:right" class="${x.B - x.O < 0 ? 'pos' : 'neg'}">${fU(x.B - x.O)}</td><td style="text-align:right">${fU(x.R1)}</td><td style="text-align:right">${fU(x.R2)}</td><td style="text-align:right">${fU(x.R3)}</td><td style="text-align:right" class="${x.F < 0 ? 'neg' : 'pos'}">${fU(x.F)}</td><td style="text-align:right">${pct(x.F, x.U)}</td></tr>`).join('')}
      </tbody></table></div><div class="t-sub" style="margin-top:6px">BFB ostatok: musbat — BFB'ga hali beriladi; manfiy — BFB'da Tentart puli ortiqcha (Excel'dagi "Остаток" yig'indisi, ikkalasi bir-biriga qo'shilib ketadi — yuqoridagi kartada alohida ko'rsatilgan).</div></div>`;

    // Zakazlar jadvali
    h += `<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Zakazlar monitoringi</h3></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        ${seg('tz-t', f.t, [['all', 'Hammasi'], ['zarar', 'Zarardagi'], ['qarz', 'Mijoz qarzi bor'], ['bfb', "BFB'ga qarz"], ['ort', 'Ortiqcha to\'langan'], ['narxsiz', 'Narxsiz']])}
        ${seg('tz-s', f.s, [['tartib', "Ro'yxat"], ['f_up', 'Foyda ↑'], ['f_down', 'Foyda ↓'], ['qarz', 'Qarz ↓']])}
      </div>
      <div class="scroll-x"><table class="tbl" style="min-width:1180px"><thead><tr>
        <th>Kod</th><th>Zakaz</th><th style="text-align:right">Narx</th><th style="text-align:right">Tushgan</th><th style="text-align:right">Mijoz qarzi</th><th style="text-align:right">BFB ulushi</th><th style="text-align:right">BFB balans</th><th style="text-align:right">R2</th><th style="text-align:right">R1</th><th style="text-align:right">Foyda</th><th style="text-align:right">%</th><th>Holat</th></tr></thead><tbody>
      ${list.length ? list.map((o) => {
        const bb = o.bfb > 0.5 ? `<span class="neg">${fU(o.bfb)} qarz</span>` : o.bfb < -0.5 ? `<span class="pos">${fU(-o.bfb)} ortiqcha</span>` : '<span class="muted">0</span>';
        const tags = [o.narxsiz ? '<span class="badge b-chiq">narx yo\'q</span>' : '', o.F < 0 && !o.narxsiz ? '<span class="badge b-chiq">zarar</span>' : '', o.ort > 0.5 ? `<span class="badge b-smeta">mijoz ortiqcha ${fU(o.ort)}</span>` : ''].join(' ');
        const isOpen = TZ.open === o.k;
        return `<tr onclick="tzOpen('${esc(o.k)}')" style="cursor:pointer;${isOpen ? 'background:#F6EFE2' : ''}">
          <td style="white-space:nowrap">${esc(o.kod || '—')}</td>
          <td><div style="font-weight:600">${esc(o.nom)}</div><div class="t-sub">${esc([o.sistema, o.motor ? o.motor + ' motor' : '', [...o.davr].map(davrNom).join(', ')].filter(Boolean).join(' · '))} ${tags}</div></td>
          <td style="text-align:right">${fU(o.U)}</td><td style="text-align:right">${fU(o.A)}</td>
          <td style="text-align:right" class="${o.qarz > 0.5 ? 'neg' : 'muted'}">${fU(o.qarz)}</td>
          <td style="text-align:right">${fU(o.B)}</td><td style="text-align:right">${bb}</td>
          <td style="text-align:right">${fU(o.R2)}</td><td style="text-align:right">${o.R1 ? fU(o.R1) : '<span class="muted">—</span>'}</td>
          <td style="text-align:right;font-weight:700" class="${o.F < 0 ? 'neg' : 'pos'}">${fU(o.F)}</td><td style="text-align:right">${o.U ? pct(o.F, o.U) : '—'}</td>
          <td>${o.holat ? `<span class="badge ${o.holat === 'Tugadi' ? 'b-tayyor' : o.holat === 'Bekor' ? 'b-chiq' : 'b-olchov'}">${esc(o.holat)}</span>` : '<span class="muted">—</span>'}${o.deadline ? `<div class="t-sub">⏱ ${esc(o.deadline)}</div>` : ''}</td></tr>
          ${isOpen ? `<tr><td colspan="12" style="background:#FBF7EF">${detail(o)}</td></tr>` : ''}`;
      }).join('') : '<tr><td colspan="12"><div class="empty"><div class="empty-t">Zakaz topilmadi</div></div></td></tr>'}
      </tbody></table></div>
      <div class="t-sub" style="margin-top:6px">Foyda = narx − BFB ulushi − Rasxod 2 − Rasxod 1 (umumiy xarajat — Rasxod 3 — oxirida jamidan ayriladi). Qatorni bosing — batafsil va tahrir.</div></div>`;

    // Rasxod 3 — oylar bo'yicha
    const r3 = TZ.r3.filter((x) => !f.d || x.davr === f.d);
    const oylar = [...new Set(r3.map((x) => x.oy))].sort((a, b) => a - b);
    const nomlar = [...new Set(r3.map((x) => x.nom))];
    if (r3.length) {
      const v = (n, o) => r3.filter((x) => x.nom === n && x.oy === o).reduce((a, x) => a + n0(x.summa), 0);
      h += `<div class="panel"><div class="panel-h"><h3>Rasxod 3 — umumiy xarajatlar (oylar)</h3></div><div class="scroll-x"><table class="tbl" style="min-width:${300 + oylar.length * 90}px"><thead><tr><th>Nomi</th>${oylar.map((o) => `<th style="text-align:right">${OY[o]}</th>`).join('')}<th style="text-align:right">Jami</th></tr></thead><tbody>
        ${nomlar.map((n) => `<tr><td>${esc(n)}</td>${oylar.map((o) => `<td style="text-align:right">${v(n, o) ? fU(v(n, o)) : '<span class="muted">0</span>'}</td>`).join('')}<td style="text-align:right;font-weight:600">${fU(oylar.reduce((a, o) => a + v(n, o), 0))}</td></tr>`).join('')}
        <tr style="font-weight:700"><td>Jami</td>${oylar.map((o) => `<td style="text-align:right">${fU(r3.filter((x) => x.oy === o).reduce((a, x) => a + n0(x.summa), 0))}</td>`).join('')}<td style="text-align:right">${fU(J.R3)}</td></tr>
      </tbody></table></div></div>`;
    }
    el.innerHTML = '<style>#tz-body td[style*="text-align:right"],#tz-body th{white-space:nowrap}</style>' + h;
  }

  function detail(o) {
    const r = o.rows[0];
    const line = (l, v, cls) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #ECE4D4;font-size:14px"><span>${l}</span><b class="${cls || ''}">${v}</b></div>`;
    let h = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;padding:8px 4px">
      <div><h4 style="margin-bottom:6px">Pul yo'li</h4>
        ${line('1 · Zakaz narxi', fU(o.U))}${line('2 · Mijoz to\'lagan', fU(o.A), 'pos')}${o.ort > 0.5 ? line("Mijoz ortiqcha to'lagan", fU(o.ort)) : line('Mijoz qarzi', fU(o.qarz), o.qarz > 0.5 ? 'neg' : '')}
        ${line('3 · BFB ulushi (Kassa)', fU(o.B))}${line("BFB'ga to'langan (Oplata)", fU(o.O))}${line(o.bfb >= 0 ? "BFB'ga hali beriladi" : "BFB'da ortiqcha (qaytadi/hisoblanadi)", fU(Math.abs(o.bfb)), o.bfb > 0.5 ? 'neg' : 'pos')}
        ${line("4 · Tentart'ga qoladi", fU(o.qol))}${line('5 · Rasxod 2 (montaj)', fU(o.R2), 'neg')}${line('Rasxod 1 (qo\'shimcha)', fU(o.R1), 'neg')}
        ${line('Zakaz foydasi', fU(o.F), o.F < 0 ? 'neg' : 'pos')}</div>
      <div><h4 style="margin-bottom:6px">Rasxod 1 tafsiloti</h4>${o.r1.length ? o.r1.map((x) => line(esc(x.izoh || '—') + ` <span class="t-sub">${esc(davrNom(x.davr))}</span>`, fU(x.summa))).join('') : '<div class="muted">yo\'q</div>'}
        ${o.rows.map((x) => x.perech_som ? `<div class="t-sub" style="margin-top:8px">Perechisleniye: ${n0(x.perech_som).toLocaleString('ru-RU')} so'm</div>` : '').join('')}
        ${o.rows.map((x) => x.izoh ? `<div class="t-sub" style="margin-top:6px">Izoh: ${esc(x.izoh)}</div>` : '').join('')}</div>`;
    if (r && boss()) h += `<div><h4 style="margin-bottom:6px">Holat va muddat</h4>
        <label class="fl">Holat</label><select class="fi" id="tz-e-holat" onclick="event.stopPropagation()">${['', 'Jarayonda', 'Tugadi', 'Bekor'].map((v) => `<option ${v === (r.holat || '') ? 'selected' : ''} value="${v}">${v || '—'}</option>`).join('')}</select>
        <label class="fl" style="margin-top:8px">Bitish muddati</label><input class="fi" type="date" id="tz-e-dl" value="${esc(r.deadline || '')}" onclick="event.stopPropagation()">
        <label class="fl" style="margin-top:8px">Izoh</label><input class="fi" id="tz-e-izoh" value="${esc(r.izoh || '')}" onclick="event.stopPropagation()">
        <button class="btn btn-p btn-sm" style="margin-top:10px" onclick="event.stopPropagation();tzSave(${r.id})">Saqlash</button></div>`;
    return h + '</div>';
  }

  window.tzOpen = (k) => { TZ.open = TZ.open === k ? null : k; render(); };
  window.tzSave = async (id) => {
    const u = { holat: $('tz-e-holat').value || null, deadline: $('tz-e-dl').value || null, izoh: $('tz-e-izoh').value.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await db.from('tz_zakaz').update(u).eq('id', id);
    if (error) { toast('⚠️', 'Saqlanmadi', error.message); return; }
    Object.assign(TZ.z.find((x) => x.id === id) || {}, u); toast('✅', 'Saqlandi', ''); render();
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#tz-d button, #tz-t button, #tz-s button'); if (!b) return;
    const g = b.parentElement.id; if (g === 'tz-d') { TZ.f.d = b.dataset.v; TZ.open = null; } if (g === 'tz-t') TZ.f.t = b.dataset.v; if (g === 'tz-s') TZ.f.s = b.dataset.v; render();
  });
  let _q; document.addEventListener('input', (e) => { if (e.target.id !== 'tz-q') return; clearTimeout(_q); _q = setTimeout(() => { TZ.f.q = e.target.value; render(); const el = $('tz-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 300); });

  window.tzRenderPage = async function (p) {
    if (p !== 'tz') return;
    render();
    if (!boss()) { $('tz-body').innerHTML = '<div class="empty"><div class="empty-t">Bu sahifa faqat rahbar uchun</div></div>'; return; }
    await load(); render();
  };
})();
