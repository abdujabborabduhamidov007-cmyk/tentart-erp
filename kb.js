// ═══════════════════════════════════════════════════════════════
// Tentart ERP v6 — @yordamchiTA_bot bilan umumiy baza (korxona sxemasi)
// Bot Supabase'dagi korxona.* jadvallariga yozadi; sayt ularni public.kb_*
// view'lari orqali o'qiydi/yozadi va realtime orqali jonli yangilanadi.
// ═══════════════════════════════════════════════════════════════
(function () {
  const KB = {
    emp: [], cash: [], qoldiq: [], zak: [], dav: [], dam: [], rep: [],
    norms: [], dkv: [], tasks: [], trec: [], kom: [], alm: [],
    loaded: false, funP: 'oy', vFilter: 'hammasi', ksType: '', ksKind: 'prixod',
    ksMonth: null, lastEvent: null,
  };
  window.KB = KB;

  const ZST = [
    { k: 'zamer', l: 'Zamer', c: '#C9A96E' },
    { k: 'kp_tayyor', l: 'KP tayyor', c: '#A07A3A' },
    { k: 'zakaz', l: 'Zakaz', c: '#1A1A1A' },
    { k: 'rad_etildi', l: 'Rad etildi', c: '#9A3B2E' },
  ];
  const TURLAR = ['Pergola', 'Markiza', 'Giyotin', 'Sirpanma eshik', 'Dush kabina', 'Railing', 'Boshqa'];
  const UZMON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const UZDAY = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const UZD3 = ['Ya', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'];

  // ---------- yordamchilar ----------
  // index.html dagi `let curUser`, `let ZZ` — window xossasi emas, shuning uchun nom orqali olamiz
  const CU = () => (typeof curUser !== 'undefined' ? curUser : null);
  const ZZL = () => (typeof ZZ !== 'undefined' && Array.isArray(ZZ) ? ZZ : []);
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n0 = (v) => Number(v) || 0;
  const money = (v, cur) => {
    const n = n0(v);
    if (cur === 'USD') return '$' + n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }).replace(/,/g, ' ');
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
  };
  const mln = (v) => {
    const n = n0(v);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' mln';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + ' ming';
    return String(Math.round(n));
  };
  // Bot vaqtni Railway serverida (UTC) naive ISO sifatida yozadi
  const ts = (s) => {
    if (!s) return null;
    const str = String(s);
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : str + 'Z');
  };
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => ymd(new Date());
  const hm = (d) => (d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : '');
  const when = (s) => {
    const d = ts(s);
    if (!d || isNaN(d)) return '';
    const t = today();
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (ymd(d) === t) return hm(d);
    if (ymd(d) === ymd(y)) return 'Kecha';
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
  };
  const empName = (id) => KB.emp.find((e) => String(e.telegram_id) === String(id))?.full_name
    || (KB.prof || []).find((p) => String(p.telegram_id) === String(id))?.ism || (id ? 'ID ' + id : '—');
  const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const tag = (manba) => manba === 'sayt-mijoz'
    ? '<span class="tag" style="background:#1A1A1A;color:#C9A96E">MIJOZ</span>'
    : manba === 'daftar'
      ? '<span class="tag" style="background:#EFE8DA;color:#7E5F25">DAFTAR</span>'
    : manba === 'sayt'
      ? '<span class="tag b-sayt">SAYT</span>'
      : '<span class="tag b-bot">BOT</span>';
  const ym = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  const toast = (ic, t, s) => (typeof notif === 'function' ? notif(ic, t, s) : null);
  const canEdit = () => ['Owner', 'Menejer', 'Kassir', 'Operator', 'Zamershik'].includes(CU()?.rol);

  // ---------- yuklash ----------
  async function q(promise) {
    const { data, error } = await promise;
    if (error) throw error;
    return data || [];
  }

  async function kbLoad() {
    const since14 = new Date(); since14.setDate(since14.getDate() - 13);
    const since7 = new Date(); since7.setDate(since7.getDate() - 7);
    const mStart = ym(new Date()) + '-01';
    const [emp, cash, qoldiq, zak, dav, dam, rep, norms, dkv, tasks, kom, alm] = await Promise.all([
      q(db.from('kb_employees').select('*').order('department').order('full_name')),
      q(db.from('kb_cashflow').select('*').order('id', { ascending: false }).limit(600)),
      q(db.from('kb_kassa_qoldiq').select('*')),
      q(db.from('kb_zakazlar').select('*').order('id', { ascending: false }).limit(500)),
      q(db.from('kb_davomat').select('*').gte('sana', ymd(since14))),
      q(db.from('kb_dam_kunlari').select('*').gte('sana', ymd(since14))),
      q(db.from('kb_reports').select('*').gte('report_date', ymd(since7)).order('submitted_at', { ascending: false })),
      q(db.from('kb_department_norms').select('*')),
      q(db.from('kb_department_daily_kv').select('*').gte('sana', mStart)),
      q(db.from('kb_tasks').select('*').order('id', { ascending: false }).limit(40)),
      q(db.from('kb_komissiyalar').select('*').gte('created_at', mStart)),
      q(db.from('kb_almashtirishlar').select('*').gte('created_at', mStart)),
    ]);
    const tids = tasks.map((t) => t.id);
    const trec = tids.length ? await q(db.from('kb_task_recipients').select('*').in('task_id', tids)) : [];
    let prof = [];
    try { prof = await q(db.from('profiles').select('id,ism,telegram_id,rol')); } catch (e) { prof = []; }
    // Kassa endi Rasxod daftaridan hisoblanadi (RLS: menejer faqat o'zinikini oladi)
    let dft = [], dobj = [], dq = null;
    try {
      [dft, dobj] = await Promise.all([
        q(db.from('rasxod_yozuvlar').select('id,egasi,kontragent,sana,tur,bolim,kategoriya,usul,summa,usd,izoh,obyekt_id,tasdiq,created_at').order('sana', { ascending: false }).order('id', { ascending: false }).limit(3000)),
        q(db.from('rasxod_obyektlar').select('id,nom')),
      ]);
    } catch (e) { dft = []; }
    try { const r = await db.rpc('kassa_qoldiq'); if (!r.error) dq = r.data || []; } catch (e) { dq = null; }
    Object.assign(KB, { prof, emp, cash, qoldiq, zak, dav, dam, rep, norms, dkv, tasks, trec, kom, alm, dft, dobj, dq, loaded: true });
    scopeKB();
  }

  // Menejerlar (Pergola / Oyna) bir-birining ma'lumotini ko'rmaydi:
  // kassa — faqat o'ziniki, jamoa/davomat/hisobot — faqat o'z bo'limi.
  const isBoss = () => ['Owner', 'Kassir'].includes(CU()?.rol);
  const myProf = () => (KB.prof || []).find((p) => p.ism === CU()?.ism || p.id === CU()?.id);
  function scopeKB() {
    if (CU()?.rol !== 'Menejer') return;
    const me = myProf();
    const tid = me?.telegram_id;
    const dept = KB.emp.find((e) => String(e.telegram_id) === String(tid))?.department;
    KB.cash = KB.cash.filter((c) => String(c.telegram_id) === String(tid));
    KB.qoldiq = [];
    KB.dft = (KB.dft || []).filter((r) => r.egasi === me?.id);
    if (dept) {
      const ids = new Set(KB.emp.filter((e) => e.department === dept).map((e) => String(e.telegram_id)));
      const mine = (r) => ids.has(String(r.telegram_id));
      KB.emp = KB.emp.filter((e) => e.department === dept);
      KB.dav = KB.dav.filter(mine);
      KB.dam = KB.dam.filter(mine);
      KB.rep = KB.rep.filter(mine);
      KB.norms = KB.norms.filter((n) => n.department === dept);
      KB.dkv = KB.dkv.filter((d) => d.department === dept);
      KB.tasks = KB.tasks.filter((t) => String(t.created_by) === String(tid) || KB.trec.some((r) => r.task_id === t.id && ids.has(String(r.telegram_id))));
    }
    KB.kom = []; KB.alm = [];
  }

  // ---------- daftar asosidagi kassa ----------
  const KAT = { material: 'Material', xoztovar: 'Xoz tovar', usta: 'Usta', abed: 'Obed', transport: 'Transport', komissiya: 'Komissiya', avans: 'Avans', taksi: 'Taksi', boshqa: 'Boshqa', prixod: 'Prixod', konvertatsiya: 'Konvertatsiya', otkazma: "O'tkazma" };
  const katL = (r) => r.kategoriya === 'otkazma' ? (r.tur === 'kirim' ? 'Olindi' : 'Berildi') : (KAT[r.kategoriya] || r.kategoriya || 'Boshqa');
  const pIsm = (id) => (KB.prof || []).find((p) => p.id === id)?.ism || '—';
  // Rasxod daftaridagi bilan bir xil: umumiy prixod − barcha chiqim
  function dBal(rows) {
    const s = (f) => rows.filter(f).reduce((a, r) => a + n0(r.summa), 0);
    const inn = (u) => s((r) => r.bolim === 'umumiy' && r.tur === 'kirim' && u(r));
    const out = (u) => s((r) => r.tur === 'chiqim' && !(r.bolim === 'ishga_oid' && r.kategoriya === 'oylik') && u(r));
    const kr = (r) => r.usul === 'karta', nq = (r) => r.usul !== 'karta', all = () => true;
    return { jami: inn(all) - out(all), naqd: inn(nq) - out(nq), karta: inn(kr) - out(kr), kirim: inn(all), chiqim: out(all) };
  }
  // Har bir odam bo'yicha qoldiq. Server funksiyasi (kassa_qoldiq) bo'lsa — o'sha (shaxsiyni ham hisobga oladi).
  function kassaRows() {
    if (Array.isArray(KB.dq)) {
      return KB.dq.map((r) => ({ egasi: r.egasi, ism: r.ism || pIsm(r.egasi), rol: r.rol, jami: n0(r.jami), naqd: n0(r.naqd), karta: n0(r.karta) }));
    }
    const by = {};
    (KB.dft || []).forEach((r) => (by[r.egasi] = by[r.egasi] || []).push(r));
    return Object.entries(by).map(([egasi, rows]) => ({ egasi, ism: pIsm(egasi), rol: (KB.prof || []).find((p) => p.id === egasi)?.rol, ...dBal(rows) }));
  }
  function myKassa() {
    const me = myProf();
    const r = kassaRows().find((x) => x.egasi === me?.id);
    return r || { jami: 0, naqd: 0, karta: 0 };
  }

  async function reload(flash) {
    try {
      await kbLoad();
      renderAllKB();
      if (flash) document.querySelector('#feed .feed-i')?.classList.add('new');
    } catch (e) {
      console.error(e);
    }
  }

  // ---------- realtime ----------
  let rtTimer = null;
  const DESC = {
    cashflow: (r) => (r.type === 'prixod' ? 'Prixod' : 'Rasxod') + ' · ' + money(r.amount, r.currency) + (r.currency === 'USD' ? '' : " so'm"),
    zakazlar: (r) => (r.manba === 'sayt-mijoz' ? 'Saytdan yangi ariza · ' : 'Zamer/zakaz · ') + (r.mijoz_ism || ''),
    davomat: (r) => 'Davomat · ' + empName(r.telegram_id),
    reports: (r) => 'Kunlik hisobot · ' + empName(r.telegram_id),
    almashtirishlar: () => 'Valyuta almashtirildi',
    tasks: (r) => 'Vazifa · ' + (r.description || '').slice(0, 40),
    department_daily_kv: (r) => 'm² kiritildi · ' + (r.department || ''),
  };
  function kbRealtime() {
    db.channel('korxona-live')
      .on('postgres_changes', { event: '*', schema: 'korxona' }, (p) => {
        const row = p.new && Object.keys(p.new).length ? p.new : p.old || {};
        KB.lastEvent = new Date();
        const el = $('sync-last');
        if (el) el.textContent = 'Oxirgi amal: ' + hm(KB.lastEvent);
        if (p.eventType === 'INSERT' && row.manba !== 'sayt' && DESC[p.table] && !document.body.classList.contains('narxsiz')) toast('🤖', 'Botda yangi amal', DESC[p.table](row));
        clearTimeout(rtTimer);
        rtTimer = setTimeout(() => reload(true), 500);
      })
      .subscribe((status) => {
        const t = $('sync-txt');
        const d = $('sync-dot');
        if (!t || !d) return;
        if (status === 'SUBSCRIBED') { t.textContent = 'Bot bilan sinxron'; d.style.background = '#6FCF8E'; }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { t.textContent = 'Jonli ulanish uzildi'; d.style.background = '#E0A040'; }
      });
  }

  // ---------- BOSH PANEL ----------
  function kbRenderBosh() {
    if (!$('page-bosh')) return;
    const now = new Date();
    $('b-date').textContent = UZDAY[now.getDay()] + ', ' + now.getDate() + '-' + UZMON[now.getMonth()];
    const h = now.getHours();
    const salom = h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech';
    $('b-hello').textContent = salom + (CU() ? ', ' + CU().ism : '');
    if (!KB.loaded) return;

    // Kassa
    // Kassa — Rasxod daftari bo'yicha: menejer o'zinikini, Owner/Kassir menejerlar qo'lidagi jamini ko'radi
    const holders = kassaRows().filter((r) => r.rol !== 'Owner');
    const uzs = CU()?.rol === 'Menejer' ? myKassa().jami : holders.reduce((a, r) => a + r.jami, 0);
    const finRol = ['Owner', 'Menejer', 'Kassir'].includes(CU()?.rol);
    const kCard = $('k-kassa').closest('.sc');
    if (kCard) kCard.style.display = finRol ? '' : 'none';
    $('k-kassa').innerHTML = (uzs < 0 ? '−' : '') + esc(mln(Math.abs(uzs)).replace(' mln', '')) + (Math.abs(uzs) >= 1e6 ? '<small>mln</small>' : '');
    $('k-kassa-s').textContent = CU()?.rol === 'Menejer' ? 'Rasxod daftari bo\'yicha qo\'lingizda' : 'Menejerlar qo\'lida · daftar bo\'yicha';

    // Faol zakazlar (sayt zakazlari)
    const ZZx = ZZL();
    const aktiv = ZZx.filter((z) => !['Yakunlandi', "To'landi"].includes(z.status));
    const late = aktiv.filter((z) => z.montaj && new Date(z.montaj) < new Date(today()));
    const botOpen = KB.zak.filter((z) => z.status === 'zamer' || z.status === 'kp_tayyor').length;
    $('k-faol').textContent = aktiv.length;
    $('k-faol-s').innerHTML = late.length
      ? '<span class="neg">' + late.length + " tasi muddatdan o'tgan</span>"
      : botOpen + ' ta zamer/KP botda jarayonda';

    // m² reja
    const reja = KB.norms.reduce((a, r) => a + n0(r.monthly_kv), 0);
    const fakt = KB.dkv.reduce((a, r) => a + n0(r.kv), 0);
    const pct = reja ? Math.round((fakt / reja) * 100) : 0;
    $('k-kv-l').textContent = UZMON[now.getMonth()][0].toUpperCase() + UZMON[now.getMonth()].slice(1) + ' montaji';
    $('k-kv-p').textContent = pct + '%';
    $('k-kv').innerHTML = esc(Math.round(fakt)) + '<small>/ ' + esc(Math.round(reja)) + ' m²</small>';
    $('k-kv-bar').style.width = Math.min(100, pct) + '%';

    // Davomat
    const t = today();
    const keldi = KB.dav.filter((d) => d.sana === t && d.holat === 'keldi').length;
    const kelmadi = KB.dav.filter((d) => d.sana === t && d.holat === 'kelmadi').length;
    const dam = KB.dam.filter((d) => d.sana === t).length;
    $('k-dav').innerHTML = keldi + '<small>/ ' + KB.emp.length + '</small>';
    $('k-dav-s').textContent = dam + ' dam olishda · ' + kelmadi + ' kelmadi';

    renderFunnel();
    renderFeed();

    // Yaqin 7 kun montajlari (sayt zakazlari)
    const lim = new Date(); lim.setDate(lim.getDate() + 7);
    const mon = ZZx.filter((z) => z.montaj && !['Yakunlandi', "To'landi"].includes(z.status) && new Date(z.montaj) <= lim)
      .sort((a, b) => new Date(a.montaj) - new Date(b.montaj)).slice(0, 8);
    $('b-montaj').innerHTML = mon.length ? mon.map((z) => {
      const prods = (z.mahsulotlar || []).map((p) => p.mahsulot).join(' + ') || z.mahsulot || '—';
      const q = n0(z.narx) - n0(z.oldinpul);
      const d = new Date(z.montaj);
      const lateCls = d < new Date(today()) ? ' class="neg"' : '';
      return `<tr onclick="openDetail('${esc(z.id)}')" style="cursor:pointer"><td class="t-id">${esc(z.id)}</td><td><div class="t-name">${esc(z.mijoz)}</div><div class="t-sub">${esc(z.manzil || '')}</div></td><td>${esc(prods)}</td><td style="text-align:right;font-weight:700">${esc(mln(q))}</td><td${lateCls}>${esc(UZD3[d.getDay()] + ', ' + d.getDate() + '-' + UZMON[d.getMonth()].slice(0, 3))}</td><td class="muted">${esc(z.masul || '—')}</td></tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty"><div class="empty-t">Yaqin 7 kunda montaj yo\'q</div></div></td></tr>';
  }

  function periodStart(p) {
    const d = new Date();
    if (p === 'hafta') d.setDate(d.getDate() - 7);
    else if (p === 'oy') d.setDate(1);
    else d.setMonth(d.getMonth() - 3);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function renderFunnel() {
    const from = periodStart(KB.funP);
    const bz = KB.zak.filter((z) => ts(z.created_at) >= from);
    const sz = ZZL().filter((z) => new Date(z.created_at) >= from);
    const rows = [
      { l: 'Zamer', n: bz.length, c: '#C9A96E' },
      { l: 'KP tayyor', n: bz.filter((z) => z.status === 'kp_tayyor' || z.status === 'zakaz').length, c: '#C9A96E' },
      { l: 'Zakaz', n: bz.filter((z) => z.status === 'zakaz').length, c: '#1A1A1A' },
      { l: 'Montaj', n: sz.filter((z) => ['Montaj', 'Yakunlandi', "To'landi"].includes(z.status)).length, c: '#1A1A1A' },
      { l: "To'landi", n: sz.filter((z) => z.status === "To'landi").length, c: '#1A1A1A' },
    ];
    const max = Math.max(1, ...rows.map((r) => r.n));
    $('fun-rows').innerHTML = rows.map((r) => `<div class="fun-row"><div class="fun-l">${r.l}</div><div class="fun-bar"><div style="width:${Math.max(r.n ? 4 : 0, Math.round((r.n / max) * 100))}%;background:${r.c}"></div></div><div class="fun-n">${r.n}</div></div>`).join('');
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const rad = bz.filter((z) => z.status === 'rad_etildi').length;
    const zk = bz.filter((z) => z.status === 'zakaz' && z.narx);
    const avg = zk.length ? zk.reduce((a, z) => a + n0(z.narx), 0) / zk.length : 0;
    $('fun-ft').innerHTML = `<span>Zamer → zakaz: <b>${pct(rows[2].n, rows[0].n)}</b></span><span>Rad etilgan: <b>${rad}</b></span><span>O'rtacha zakaz: <b>${avg ? esc(mln(avg)) + " so'm" : '—'}</b></span>`;
    document.querySelectorAll('#fun-seg button').forEach((b) => b.classList.toggle('on', b.dataset.p === KB.funP));
  }

  function renderFeed() {
    const items = [];
    KB.cash.slice(0, 40).forEach((c) => items.push({
      t: c.created_at,
      h: (c.type === 'prixod' ? 'Prixod · ' : 'Rasxod · ') + money(c.amount, c.currency) + (c.currency === 'USD' ? '' : " so'm"),
      s: [empName(c.telegram_id), c.category, c.comment, c.usul].filter(Boolean).join(' · '),
      m: c.manba,
    }));
    KB.zak.slice(0, 30).forEach((z) => items.push({
      t: z.updated_at || z.created_at,
      h: (z.status === 'zamer' ? 'Yangi zamer' : 'Status: ' + (ZST.find((s) => s.k === z.status)?.l || z.status)) + ' · #' + z.id,
      s: [z.mijoz_ism, z.turi, z.manzil].filter(Boolean).join(' · '),
      m: z.manba,
    }));
    KB.rep.slice(0, 20).forEach((r) => items.push({
      t: r.submitted_at,
      h: 'Kunlik hisobot' + (r.kv ? ' · ' + r.kv + ' m²' : ''),
      s: [empName(r.telegram_id), r.obyekt, r.muammo ? 'Muammo: ' + r.muammo : ''].filter(Boolean).join(' · '),
      m: 'bot',
    }));
    KB.alm.forEach((a) => items.push({
      t: a.created_at,
      h: 'Valyuta · ' + money(a.from_amount, a.from_currency) + ' ' + a.from_currency + ' → ' + money(a.to_amount, a.to_currency) + ' ' + a.to_currency,
      s: empName(a.telegram_id) + ' · kurs ' + money(a.rate),
      m: 'bot',
    }));
    KB.tasks.slice(0, 10).forEach((t) => items.push({
      t: t.created_at, h: 'Vazifa berildi', s: (t.description || '').slice(0, 80), m: t.manba,
    }));
    const byDay = {};
    KB.dav.filter((d) => d.sana === today()).forEach((d) => { byDay[d.holat] = (byDay[d.holat] || 0) + 1; });
    const lastDav = KB.dav.filter((d) => d.sana === today()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (lastDav) items.push({ t: lastDav.created_at, h: 'Davomat belgilandi', s: (byDay.keldi || 0) + ' keldi · ' + (byDay.kelmadi || 0) + ' kelmadi', m: lastDav.manba });

    items.sort((a, b) => (ts(b.t) || 0) - (ts(a.t) || 0));
    $('feed').innerHTML = items.length ? items.slice(0, 30).map((i) => `<div class="feed-i"><div class="feed-t">${esc(when(i.t))}</div><div style="min-width:0"><div class="feed-h">${esc(i.h)}</div><div class="feed-s">${esc(i.s)}</div></div>${tag(i.m)}</div>`).join('')
      : '<div class="empty"><div class="empty-t">Hali amal yo\'q</div><div>Botda biror amal bajarilsa shu yerda paydo bo\'ladi.</div></div>';
  }

  // ---------- ZAMER VORONKASI ----------
  function renderVoronka() {
    const chips = [['hammasi', 'Hammasi'], ['bugun', 'Bugun'], ['mijoz', 'Mijozlar saytidan'], ['sayt', 'ERP\'da kiritilgan'], ['bot', 'Botdan kelgan']];
    $('v-chips').innerHTML = chips.map(([k, l]) => `<button class="chip${KB.vFilter === k ? ' on' : ''}" data-f="${k}" aria-pressed="${KB.vFilter === k}">${l}</button>`).join('');
    const qq = ($('v-q').value || '').toLowerCase();
    const list = KB.zak.filter((z) => {
      if (KB.vFilter === 'bugun' && ymd(ts(z.created_at)) !== today()) return false;
      if (KB.vFilter === 'sayt' && z.manba !== 'sayt') return false;
      if (KB.vFilter === 'mijoz' && z.manba !== 'sayt-mijoz') return false;
      if (KB.vFilter === 'bot' && (z.manba || 'bot') !== 'bot') return false;
      if (qq && ![z.mijoz_ism, z.telefon, z.manzil, z.turi, '#' + z.id].join(' ').toLowerCase().includes(qq)) return false;
      return true;
    });
    $('v-kanban').innerHTML = ZST.map((st) => {
      const cards = list.filter((z) => z.status === st.k);
      const sum = cards.reduce((a, z) => a + n0(z.narx), 0);
      return `<div class="kc"><div class="kc-h"><span style="width:9px;height:9px;border-radius:50%;background:${st.c}"></span><div class="kc-ht">${st.l}</div><div class="kc-hc">${cards.length}</div></div>
        <div class="kc-sum fin">${sum ? esc(mln(sum)) + " so'm" : '&nbsp;'}</div>
        <div class="kc-body">${cards.length ? cards.slice(0, 60).map((z) => `<button class="kcard" style="text-align:left;font:inherit;color:inherit" onclick="kbOpenVD(${z.id})">
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="kc-id">#${z.id}</span>${tag(z.manba)}</div>
          <div class="kc-name">${esc(z.turi)}</div>
          <div class="kc-prod">${esc(z.mijoz_ism)}${z.manzil ? ' · ' + esc(z.manzil) : ''}</div>
          <div class="kc-ft"><span class="kc-price fin">${z.narx ? esc(mln(z.narx)) : '—'}</span><span class="muted" style="font-size:12px">${esc(z.telefon || '')}</span><span class="muted">${esc(when(z.created_at))}</span></div>
        </button>`).join('') : '<div class="muted" style="text-align:center;padding:16px;font-size:13px">Bo\'sh</div>'}</div></div>`;
    }).join('');
    const open = KB.zak.filter((z) => z.status === 'zamer' || z.status === 'kp_tayyor').length;
    if ($('nb-v')) $('nb-v').textContent = open;
  }

  function fillEmpSelect(sel, pref) {
    const opts = KB.emp.map((e) => `<option value="${e.telegram_id}">${esc(e.full_name)} · ${esc(e.department)}</option>`).join('');
    $(sel).innerHTML = opts || '<option value="">Xodim topilmadi</option>';
    if (pref) $(sel).value = pref;
  }

  window.kbOpenZamer = function () {
    ['vz-ism', 'vz-tel', 'vz-manzil'].forEach((i) => ($(i).value = ''));
    $('vz-turi').innerHTML = TURLAR.map((t) => `<option>${t}</option>`).join('');
    fillEmpSelect('vz-who', localStorage.getItem('kb-who') || '');
    om('m-vz');
    setTimeout(() => $('vz-ism').focus(), 50);
  };

  window.kbSaveZamer = async function () {
    const ism = $('vz-ism').value.trim();
    const who = $('vz-who').value;
    if (!ism) return toast('⚠️', 'Mijoz ismini kiriting', '');
    if (!who) return toast('⚠️', 'Kim kiritganini tanlang', '');
    const now = new Date().toISOString().replace('Z', '').slice(0, 26);
    const row = { mijoz_ism: ism, telefon: $('vz-tel').value.trim() || null, manzil: $('vz-manzil').value.trim() || null, turi: $('vz-turi').value, status: 'zamer', created_by: Number(who), created_at: now, updated_at: now, manba: 'sayt' };
    const { error } = await db.from('kb_zakazlar').insert(row);
    if (error) return toast('❌', 'Saqlanmadi', error.message);
    try { localStorage.setItem('kb-who', who); } catch (e) { /* bo'sh */ }
    cm('m-vz');
    toast('✅', 'Zamer saqlandi', 'Botdagi voronkada ham ko\'rinadi');
    reload();
  };

  window.kbOpenVD = function (id) {
    const z = KB.zak.find((x) => x.id === id);
    if (!z) return;
    const st = ZST.find((s) => s.k === z.status);
    $('vd-t').textContent = '#' + z.id + ' · ' + z.turi;
    $('vd-b').innerHTML = `<div class="dg">
      <div><div class="di-l">Mijoz</div><div class="di-v">${esc(z.mijoz_ism)}</div></div>
      <div><div class="di-l">Telefon</div><div class="di-v">${z.telefon ? `<a href="tel:${esc(z.telefon)}">${esc(z.telefon)}</a>` : '—'}</div></div>
      <div><div class="di-l">Manzil</div><div class="di-v">${esc(z.manzil || '—')}</div></div>
      <div><div class="di-l">Holat</div><div class="di-v"><span class="badge b-tasd">${esc(st?.l || z.status)}</span> ${tag(z.manba)}</div></div>
      <div><div class="di-l">Kiritgan</div><div class="di-v">${z.manba === 'sayt-mijoz' ? 'Mijoz o\'zi (tentart.uz)' : esc(empName(z.created_by))}</div></div>
      <div><div class="di-l">Sana</div><div class="di-v">${esc(when(z.created_at))}</div></div>
      ${z.izoh ? `<div style="grid-column:1/-1"><div class="di-l">Mijoz izohi</div><div class="di-v" style="white-space:pre-line">${esc(z.izoh)}</div></div>` : ''}
    </div>
    <div class="fg fin"><label class="fl" for="vd-narx">Narx (so'm)</label><input class="fi" id="vd-narx" inputmode="numeric" value="${z.narx ? Math.round(z.narx) : ''}" placeholder="KP narxi"></div>`;
    const btn = (k, l, cls) => `<button class="btn ${cls}" onclick="kbSetZStatus(${z.id},'${k}')">${l}</button>`;
    $('vd-f').innerHTML = canEdit() && !document.body.classList.contains('narxsiz')
      ? [z.status !== 'rad_etildi' ? btn('rad_etildi', 'Rad etildi', 'btn-danger') : '',
        z.status !== 'zamer' ? btn('zamer', '← Zamerga', 'btn-g') : '',
        z.status !== 'kp_tayyor' ? btn('kp_tayyor', 'KP tayyor', 'btn-g') : '',
        z.status !== 'zakaz' ? btn('zakaz', 'Zakaz bo\'ldi', 'btn-a') : ''].join('')
      : '<span class="muted">Faqat ko\'rish huquqi</span>';
    om('m-vd');
  };

  window.kbSetZStatus = async function (id, status) {
    const raw = ($('vd-narx').value || '').replace(/\s/g, '');
    const upd = { status, updated_at: new Date().toISOString().replace('Z', '').slice(0, 26) };
    if (raw) upd.narx = Number(raw);
    if ((status === 'kp_tayyor' || status === 'zakaz') && !raw && !KB.zak.find((z) => z.id === id)?.narx) {
      return toast('⚠️', 'Narxni kiriting', 'KP/zakaz uchun narx kerak');
    }
    const { error } = await db.from('kb_zakazlar').update(upd).eq('id', id);
    if (error) return toast('❌', 'Saqlanmadi', error.message);
    cm('m-vd');
    toast('✅', 'Holat yangilandi', ZST.find((s) => s.k === status)?.l || status);
    reload();
  };

  // ---------- KASSA (Rasxod daftari asosida) ----------
  function monthsList() {
    const set = new Set([ym(new Date())]);
    (KB.dft || []).forEach((r) => r.sana && set.add(String(r.sana).slice(0, 7)));
    return [...set].sort().reverse();
  }

  function renderKassa() {
    const boss = isBoss();
    const sgn = (v) => (v < 0 ? '−' : '') + money(Math.abs(v));
    const card = (l, v, sub, dark) => `<div class="sc${dark ? ' dark' : ''}"><div class="sc-l">${esc(l)}</div><div class="sc-v${v < 0 ? ' neg' : ''}">${esc(sgn(v))}</div>${sub ? `<div class="sc-s">${sub}</div>` : ''}</div>`;
    const m = KB.ksMonth || ym(new Date());
    const mrows = (KB.dft || []).filter((r) => String(r.sana).startsWith(m) && r.bolim !== 'shaxsiy');
    const mIn = mrows.filter((r) => r.bolim === 'umumiy' && r.tur === 'kirim' && r.kategoriya !== 'otkazma').reduce((a, r) => a + n0(r.summa), 0);
    const mOut = mrows.filter((r) => r.tur === 'chiqim' && r.kategoriya !== 'otkazma').reduce((a, r) => a + n0(r.summa), 0);
    let html = '';
    if (boss) {
      const rows = kassaRows().filter((r) => r.rol !== 'Owner').sort((a, b) => b.jami - a.jami);
      const tot = rows.reduce((a, r) => a + r.jami, 0);
      html += card("Menejerlar qo'lida · jami", tot, "so'm · Rasxod daftari bo'yicha", true);
      html += rows.map((r) => card(r.ism, r.jami, `naqd ${esc(sgn(r.naqd))} · karta ${esc(sgn(r.karta))}`)).join('');
    } else {
      const k = myKassa();
      html += card("Qo'limdagi pul · so'm", k.jami, 'Rasxod daftaridagi qoldiq bilan bir xil', true);
      html += card("Naqd · so'm", k.naqd) + card("Karta · so'm", k.karta);
    }
    html += `<div class="sc"><div class="sc-l">Oy natijasi (prixod − rasxod)</div><div class="sc-v ${mIn - mOut >= 0 ? 'pos' : 'neg'}" style="font-weight:600">${mIn - mOut >= 0 ? '+' : '−'}${esc(mln(Math.abs(mIn - mOut)))}</div><div class="sc-s">so'm · ${esc(m)} · o'tkazmalarsiz</div></div>`;
    $('ks-cards').innerHTML = html;

    // Oy tanlash
    const ms = monthsList();
    const sel = $('ks-month');
    if (!KB.ksMonth) KB.ksMonth = ms[0];
    sel.innerHTML = ms.map((x) => `<option value="${x}">${UZMON[Number(x.slice(5)) - 1]} ${x.slice(0, 4)}</option>`).join('');
    sel.value = KB.ksMonth;
    $('ks-mlabel').textContent = UZMON[Number(KB.ksMonth.slice(5)) - 1];
    document.querySelectorAll('#ks-seg button').forEach((b) => b.classList.toggle('on', b.dataset.t === KB.ksType));

    const objN = (id) => (KB.dobj || []).find((o) => o.id === id)?.nom;
    const tur = KB.ksType === 'prixod' ? 'kirim' : KB.ksType === 'rasxod' ? 'chiqim' : '';
    const rows = (KB.dft || []).filter((r) => String(r.sana).startsWith(KB.ksMonth) && (!tur || r.tur === tur) && (r.bolim !== 'shaxsiy' || !boss || CU()?.rol === 'Owner'));
    const tq = (r) => r.bolim === 'shaxsiy' ? '<span class="tag">SHAXSIY</span>' : r.tasdiq === 'tasdiqlandi' ? '<span class="tag" style="background:#E3EFE6;color:#2F6B45">✓</span>' : r.tasdiq === 'savol' ? '<span class="tag" style="background:#F4E1DC;color:var(--danger)">SAVOL</span>' : '<span class="tag" style="background:#EFE8DA;color:#7E5F25">TEKSHIRUVDA</span>';
    $('ks-tbody').innerHTML = rows.length ? rows.map((r) => {
      const p = r.tur === 'kirim';
      const title = r.kategoriya === 'otkazma' ? (p ? pIsm(r.kontragent) + 'dan olindi' : pIsm(r.kontragent) + 'ga berildi') + (r.izoh ? ' — ' + r.izoh : '') : (r.izoh || katL(r));
      const sub = [r.bolim === 'obyekt' ? objN(r.obyekt_id) || 'Obyekt' : r.bolim === 'ishga_oid' ? 'Ishga oid' : r.bolim === 'umumiy' ? 'Umumiy' : 'Shaxsiy', r.usul === 'karta' ? 'Karta' : 'Naqd'].filter(Boolean).join(' · ');
      return `<tr><td class="muted" style="white-space:nowrap">${esc(r.sana)}</td>
        <td><span class="badge ${p ? 'b-tayyor' : 'b-chiq'}">${p ? 'Prixod' : 'Rasxod'}</span></td>
        <td><div class="t-name">${esc(title)}</div><div class="t-sub">${esc(sub)}</div></td>
        <td class="muted">${esc(katL(r))}</td>
        <td class="muted">${esc(pIsm(r.egasi))}</td>
        <td style="text-align:right;white-space:nowrap" class="${p ? 'pos' : 'neg'}">${p ? '+' : '−'}${esc(money(r.summa))}</td>
        <td>${tq(r)}</td></tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty"><div class="empty-t">Bu oyda daftarda yozuv yo\'q</div></div></td></tr>';

    // Rasxod tarkibi
    const by = {};
    rows.filter((r) => r.tur === 'chiqim' && r.kategoriya !== 'otkazma').forEach((r) => { const k = katL(r); by[k] = (by[k] || 0) + n0(r.summa); });
    const arr = Object.entries(by).sort((a, b) => b[1] - a[1]);
    const tot = arr.reduce((a, [, v]) => a + v, 0) || 1;
    $('ks-split').innerHTML = arr.length ? arr.slice(0, 8).map(([k, v]) => `<div style="display:grid;grid-template-columns:120px minmax(0,1fr) 84px;gap:12px;align-items:center;font-size:13px"><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(k)}</span><div class="prog" style="height:8px"><div class="prog-f" style="width:${Math.round((v / tot) * 100)}%"></div></div><span class="muted" style="text-align:right">${esc(mln(v))}</span></div>`).join('')
      : '<div class="muted">Bu oyda rasxod yo\'q</div>';

    // Valyuta (daftardagi $ → so'm) va o'tkazmalar
    const conv = (KB.dft || []).filter((r) => String(r.sana).startsWith(KB.ksMonth) && r.kategoriya === 'konvertatsiya');
    const usd = conv.reduce((a, r) => a + n0(r.usd), 0);
    const berildi = (KB.dft || []).filter((r) => String(r.sana).startsWith(KB.ksMonth) && r.kategoriya === 'otkazma' && r.tur === 'chiqim').reduce((a, r) => a + n0(r.summa), 0);
    const line = (l, v) => `<div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;border-bottom:1px solid #ECE4D4;padding:10px 0"><span class="muted">${l}</span><b>${v}</b></div>`;
    $('ks-fx').innerHTML = line("Shu oy $ → so'm", '$' + esc(money(usd, 'USD').replace('$', '')))
      + line("Shu oy so'mga aylandi", esc(money(conv.reduce((a, r) => a + n0(r.summa), 0))) + " so'm")
      + line("Shu oy pul berildi (o'tkazma)", esc(money(berildi)) + " so'm");
  }

  // ---------- JAMOA ----------
  function renderJamoa() {
    // Bo'lim rejasi
    const depts = [...new Set([...KB.norms.map((n) => n.department), ...KB.dkv.map((d) => d.department)])];
    const tdy = today();
    $('jm-plan').innerHTML = depts.length ? depts.map((dep) => {
      const reja = n0(KB.norms.find((n) => n.department === dep)?.monthly_kv);
      const fakt = KB.dkv.filter((d) => d.department === dep).reduce((a, r) => a + n0(r.kv), 0);
      const bugun = n0(KB.dkv.find((d) => d.department === dep && d.sana === tdy)?.kv);
      const p = reja ? Math.round((fakt / reja) * 100) : 0;
      return `<div class="sc"><div class="sc-l" style="display:flex;justify-content:space-between"><span>${esc(dep)}</span><span>${p}%</span></div><div class="sc-v">${Math.round(fakt)}<small>/ ${Math.round(reja)} m²</small></div><div class="prog"><div class="prog-f" style="width:${Math.min(100, p)}%;background:${p >= 60 ? 'var(--green)' : 'var(--gold)'}"></div></div><div class="sc-s" style="margin-top:8px">Bugun: ${bugun} m²</div></div>`;
    }).join('') : '<div class="sc"><div class="sc-l">Oylik reja</div><div class="sc-s">Botda reja kiritilmagan</div></div>';

    // Davomat — oxirgi 7 kun
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    $('jm-att-t').textContent = 'Davomat · ' + days[0].getDate() + '–' + days[6].getDate() + ' ' + UZMON[days[6].getMonth()];
    const cols = 'grid-template-columns:220px repeat(7,minmax(32px,1fr)) 80px';
    let html = `<div class="att" style="${cols}"><span class="att-h">XODIM</span>${days.map((d) => `<span class="att-h" style="text-align:center">${UZD3[d.getDay()].toUpperCase()} ${d.getDate()}</span>`).join('')}<span class="att-h" style="text-align:right">HISOBOT</span></div>`;
    let lastDep = null;
    KB.emp.forEach((e) => {
      if (e.department !== lastDep) {
        lastDep = e.department;
        html += `<div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--accent2);padding:14px 0 4px;text-transform:uppercase">${esc(e.department)}</div>`;
      }
      const cells = days.map((d) => {
        const s = ymd(d);
        const dv = KB.dav.find((x) => String(x.telegram_id) === String(e.telegram_id) && x.sana === s);
        const dm = KB.dam.find((x) => String(x.telegram_id) === String(e.telegram_id) && x.sana === s);
        const k = dm ? 'd' : dv?.holat === 'keldi' ? 'k' : dv?.holat === 'kelmadi' ? 'x' : '';
        const lab = (dm ? 'Dam kuni' : dv?.holat === 'keldi' ? 'Keldi' : dv?.holat === 'kelmadi' ? 'Kelmadi' : 'Belgilanmagan') + ' · ' + s;
        const isToday = s === tdy && canEdit() && !dm;
        return isToday
          ? `<button class="att-c ${k}" title="${lab} — bosib o'zgartiring" aria-label="${esc(e.full_name)}: ${lab}" onclick="kbToggleDav(${e.telegram_id})"></button>`
          : `<div class="att-c ${k}" title="${lab}" aria-label="${esc(e.full_name)}: ${lab}" style="cursor:default"></div>`;
      }).join('');
      const nRep = KB.rep.filter((r) => String(r.telegram_id) === String(e.telegram_id)).length;
      html += `<div class="att att-r" style="${cols}"><div style="display:flex;align-items:center;gap:10px;min-width:0"><div class="av">${esc(initials(e.full_name))}</div><div style="min-width:0"><div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.full_name)}</div></div></div>${cells}<span style="text-align:right;font-weight:700">${nRep}</span></div>`;
    });
    $('jm-att').innerHTML = KB.emp.length ? html : '<div class="empty"><div class="empty-t">Botda xodim ro\'yxatdan o\'tmagan</div></div>';

    // Hisobotlar
    const dsel = $('jm-rep-d');
    const dlist = [...new Set([tdy, ...KB.rep.map((r) => r.report_date)])].sort().reverse();
    const cur = dsel.value && dlist.includes(dsel.value) ? dsel.value : tdy;
    dsel.innerHTML = dlist.map((d) => `<option value="${d}">${d === tdy ? 'Bugun' : d}</option>`).join('');
    dsel.value = cur;
    const reps = KB.rep.filter((r) => r.report_date === cur);
    $('jm-rep').innerHTML = reps.length ? reps.map((r) => `<div style="display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:14px;padding:12px 0;border-top:1px solid #ECE4D4">
        <span class="muted" style="font-size:13px">${esc(hm(ts(r.submitted_at)))}</span>
        <div><div style="font-weight:600">${esc(empName(r.telegram_id))}${r.obyekt ? ' · ' + esc(r.obyekt) : ''}${r.kv ? ' · ' + esc(r.kv) + ' m²' : ''}</div><div class="muted" style="font-size:13px;white-space:pre-line">${esc(r.content)}</div>${r.muammo ? `<div class="neg" style="font-size:13px;margin-top:4px">Muammo: ${esc(r.muammo)}</div>` : ''}</div>
        <div style="align-self:start">${r.muammo ? '<span class="tag b-chiq" style="background:#F4E1DC;color:var(--danger)">MUAMMO</span>' : tag('bot')}</div>
      </div>`).join('') : '<div class="muted">Bu kunda hisobot yo\'q</div>';

    // Vazifalar
    $('jm-tasks').innerHTML = KB.tasks.length ? KB.tasks.slice(0, 12).map((t) => {
      const rs = KB.trec.filter((r) => r.task_id === t.id);
      const done = rs.filter((r) => r.status === 'done').length;
      const p = rs.length ? Math.round((done / rs.length) * 100) : 0;
      return `<div style="padding:12px 0;border-top:1px solid #ECE4D4;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;gap:12px"><span style="font-weight:600">${esc(t.description)}</span><span class="muted" style="white-space:nowrap;font-size:13px">${done}/${rs.length}</span></div>
        <div class="prog"><div class="prog-f" style="width:${p}%;background:${p === 100 ? 'var(--green)' : 'var(--gold)'}"></div></div>
        <div class="muted" style="font-size:12px">${esc(empName(t.created_by))} · ${esc(when(t.created_at))}${t.deadline ? ' · muddat: ' + esc(t.deadline) : ''}</div>
      </div>`;
    }).join('') : '<div class="muted">Vazifa yo\'q</div>';
  }

  window.kbToggleDav = async function (tid) {
    const s = today();
    const cur = KB.dav.find((x) => String(x.telegram_id) === String(tid) && x.sana === s)?.holat;
    const next = cur === 'keldi' ? 'kelmadi' : 'keldi';
    const me = KB.emp.find((e) => e.full_name === CU()?.ism)?.telegram_id || 0;
    const { error } = await db.from('kb_davomat').upsert({
      telegram_id: tid, sana: s, holat: next, belgilagan_id: me,
      created_at: new Date().toISOString().replace('Z', '').slice(0, 26), manba: 'sayt',
    }, { onConflict: 'telegram_id,sana' });
    if (error) return toast('❌', 'Saqlanmadi', error.message);
    toast('✅', 'Davomat', empName(tid) + ' — ' + next);
    reload();
  };

  // ---------- SAYT (tentart.uz portfolio) ----------
  KB.port = [];
  async function loadPortfolio() {
    const { data, error } = await db.from('sayt_portfolio').select('*').order('tartib').order('id', { ascending: false });
    if (error) throw error;
    KB.port = data || [];
  }
  async function renderSayt() {
    try { await loadPortfolio(); } catch (e) { toast('⚠️', 'Portfolio yuklanmadi', e.message); }
    const arizalar = KB.zak.filter((z) => z.manba === 'sayt-mijoz');
    const bugun = arizalar.filter((z) => ymd(ts(z.created_at)) === today()).length;
    $('st-stats').innerHTML = `<div class="sc dark"><div class="sc-l">Saytdan kelgan arizalar</div><div class="sc-v">${arizalar.length}</div><div class="sc-s">bugun: ${bugun}</div></div>
      <div class="sc"><div class="sc-l">Zakazga aylangan</div><div class="sc-v">${arizalar.filter((z) => z.status === 'zakaz').length}</div><div class="sc-s">saytdan kelganlardan</div></div>
      <div class="sc"><div class="sc-l">Portfolioda</div><div class="sc-v">${KB.port.filter((p) => p.korinadi).length}</div><div class="sc-s">saytda ko'rinadigan ish</div></div>`;
    $('st-list').innerHTML = KB.port.length ? KB.port.map((p) => `<div style="display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:16px;align-items:center;padding:12px 0;border-top:1px solid #ECE4D4">
        <img src="${esc(p.rasm_url)}" alt="" style="width:96px;height:72px;object-fit:cover;border-radius:10px;background:var(--bg3)">
        <div style="min-width:0"><div style="font-weight:700">${esc(p.sarlavha)}</div><div class="muted" style="font-size:13px">${esc([p.mahsulot, p.joy].filter(Boolean).join(' · '))}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-g btn-sm" onclick="kbPortToggle(${p.id},${!p.korinadi})">${p.korinadi ? 'Yashirish' : 'Ko\'rsatish'}</button>
          <button class="btn btn-danger btn-sm" onclick="kbPortDel(${p.id})">O'chirish</button>
        </div></div>`).join('')
      : '<div class="empty"><div class="empty-t">Hali ish qo\'shilmagan</div><div>Qo\'shilgan ishlar tentart.uz dagi "Ishlarimiz" bo\'limida chiqadi.</div></div>';
  }
  window.kbPortSave = async function () {
    const f = $('st-file').files[0];
    const sarlavha = $('st-sar').value.trim();
    if (!f) return toast('⚠️', 'Rasm tanlang', '');
    if (!sarlavha) return toast('⚠️', 'Sarlavha yozing', '');
    if (f.size > 8 * 1024 * 1024) return toast('⚠️', 'Rasm juda katta', '8 MB dan kichik bo\'lsin');
    const btn = $('st-save'); btn.disabled = true; btn.textContent = 'Yuklanmoqda…';
    try {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = 'portfolio/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const up = await db.storage.from('sayt').upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      const url = db.storage.from('sayt').getPublicUrl(path).data.publicUrl;
      const { error } = await db.from('sayt_portfolio').insert({ sarlavha, joy: $('st-joy').value.trim() || null, mahsulot: $('st-mah').value || null, rasm_url: url, tartib: 0 });
      if (error) throw error;
      ['st-sar', 'st-joy'].forEach((i) => ($(i).value = '')); $('st-file').value = '';
      toast('✅', 'Saytga qo\'shildi', sarlavha);
      renderSayt();
    } catch (e) { toast('❌', 'Saqlanmadi', e.message); }
    finally { btn.disabled = false; btn.textContent = 'Saytga qo\'shish'; }
  };
  window.kbPortToggle = async function (id, v) {
    const { error } = await db.from('sayt_portfolio').update({ korinadi: v }).eq('id', id);
    if (error) return toast('❌', 'Xatolik', error.message);
    renderSayt();
  };
  window.kbPortDel = async function (id) {
    if (!confirm('Bu ish saytdan o\'chirilsinmi?')) return;
    const { error } = await db.from('sayt_portfolio').delete().eq('id', id);
    if (error) return toast('❌', 'Xatolik', error.message);
    renderSayt();
  };

  // ---------- umumiy ----------
  function renderAllKB() {
    kbRenderBosh();
    const p = document.querySelector('.ni.on')?.dataset.page;
    if (p) kbRenderPage(p);
    const open = KB.zak.filter((z) => z.status === 'zamer' || z.status === 'kp_tayyor').length;
    if ($('nb-v')) $('nb-v').textContent = open;
  }

  function kbRenderPage(p) {
    if (!KB.loaded) return;
    if (p === 'bosh') kbRenderBosh();
    if (p === 'voronka') renderVoronka();
    if (p === 'kassa') renderKassa();
    if (p === 'jamoa') renderJamoa();
    if (p === 'sayt') renderSayt();
  }

  function bindOnce() {
    $('fun-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; KB.funP = b.dataset.p; renderFunnel(); });
    $('v-chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; KB.vFilter = b.dataset.f; renderVoronka(); });
    $('v-q').addEventListener('input', renderVoronka);
    $('ks-seg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; KB.ksType = b.dataset.t; renderKassa(); });
    $('ks-month').addEventListener('change', (e) => { KB.ksMonth = e.target.value; renderKassa(); });
    $('jm-rep-d').addEventListener('change', renderJamoa);
  }

  let started = false;
  let booting = false;
  async function kbStart() {
    kbRenderBosh();
    if (booting) return;
    booting = true;
    if (!started) { bindOnce(); started = true; }
    try {
      await kbLoad();
    } catch (e) {
      console.error(e);
      toast('⚠️', 'Bot ma\'lumotlari yuklanmadi', e.message);
      return;
    }
    renderAllKB();
    kbRealtime();
  }

  Object.assign(window, { kbStart, kbRenderPage, kbRenderBosh, kbReload: reload });

  // index.html dagi startApp() bu fayl yuklanishidan oldin ishga tushib ulgurgan bo'lishi mumkin
  function bootIfReady() {
    if (CU() && document.getElementById('app')?.style.display === 'block') kbStart();
    else setTimeout(bootIfReady, 300);
  }
  if (!started) bootIfReady();
})();
