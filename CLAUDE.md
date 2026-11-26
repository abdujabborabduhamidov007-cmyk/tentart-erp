# Tentart ERP — Claude uchun loyiha qoidalari

Egasi: Abdujabbor (Tentart / Proalyum asoschisi). Javoblar **o'zbek tilida**, oddiy tilda, misol bilan.

## Loyiha nima
Build bosqichi yo'q: oddiy statik HTML + JS, Vercel'da. Backend — Supabase (`zheszanbqkcckxwnrycu`).
`main` branchga push → Vercel avtomatik deploy qiladi (jonli sayt darhol o'zgaradi!).

| Fayl | Nima | Manzil |
|---|---|---|
| `erp.html` | Asosiy ERP (zakaz, CRM, moliya, HR, Marketing AI) | erp.tentart.uz `/` |
| `kb.js` | v6: @yordamchiTA_bot bilan umumiy baza (davomat, vazifa, hisobot, sayt portfolio) | erp.html ichida |
| `ph.js` | Xushnud buxgalteriyasi: pul harakati + qoldiq (Excel "ishlar_tartibi" asosida) | erp.html ichida |
| `tz.js` | Tentart zakazlari va BFB bilan hisob | erp.html ichida |
| `rasxod.html` | Rasxod daftari (Abdulloh, Muhammad → Xushnud ko'radi) | `/rasxod` |
| `oila.html` | Oila byudjeti (shaxsiy) | `/oila` |
| `darslik.html` | To'rt imom darsligi (shaxsiy) | `/darslik` |
| `site/index.html` | Mijozlar sayti | tentart.uz |
| `api/claude.js` | Vercel funksiya: Claude API proksi (`ANTHROPIC_API_KEY` env'da) | `/api/claude` |
| `vercel.json` | Yo'naltirishlar (rewrites) va headerlar | — |

## Biznes qoidalari (buzma)
- Rollar: Owner, Menejer, Zamershik, Usta, Kassir. **Ustalar va operator narxlarni ko'rmaydi** — faqat zakaz ma'lumoti.
- Mijozlar sayti (tentart.uz) **narx ko'rsatmaydi**. Telefon: +998 97 920-00-01.
- Buxgalteriya: "Asosiy" = pergola, "Qo'shimcha" = oyna. Xushnudning Excel tuzilmasiga mos bo'lsin.
- "ERP'ga qo'sh" (mijoz/KP) = jonli "Zamer voronkasi" kanbani (Zamer → KP tayyor → Zakaz), eski zakazlar ro'yxati emas.

## Xavfsizlik
- Supabase anon key brauzerda ochiq — **yagona himoya RLS**. Yangi jadval qo'shsang, RLS'ni yoqib, rolga qarab policy yoz. RLS'siz jadval = hammaga ochiq.
- Repo **public**. Hech qachon service_role key, parol, token yozma.
- `api/claude.js` hozir `Access-Control-Allow-Origin: *` va tekshiruvsiz — ya'ni begona sayt ham API kalitni ishlata oladi. O'zgartirishdan oldin Abdujabbordan so'ra.

## Ish tartibi (Boris Cherny usuli)
1. **Avval o'qi, keyin yoz.** Kerakli joyni `grep` bilan top (`erp.html` 3500+ qator — butun faylni o'qima).
2. **Katta o'zgarishda avval reja.** 3+ fayl yoki DB sxemasi o'zgarsa — qisqa reja yoz, tasdiq ol, keyin kod.
3. **O'zing tekshir.** Har o'zgarishdan keyin: `node scripts/tekshir.mjs` (barcha skript sintaksisi). Xato bo'lsa — tuzat, keyin push.
   Ko'rinishni o'zgartirsang — brauzerda ochib, skrinshot bilan tekshir.
4. **Kichik commit, o'zbekcha xabar**: `Rasxod: obyekt filtri qo'shildi`.
5. Push = jonli deploy. Pul/hisob kodiga tegsang, push'dan oldin nima o'zgarishini 2 qatorda ayt.

## Uslub
- Mavjud uslubni saqla: vanilla JS. `kb.js`, `ph.js`, `tz.js`, `rasxod.html`da `$()` va `esc()` yordamchilari bor — foydalanuvchi matnini `innerHTML`ga qo'yishdan oldin doim `esc()` qil (XSS'dan himoya). `erp.html`da `esc()` yo'q — u yerda yangi kod yozsang, xuddi shunday yordamchi qo'sh.
- Yangi kutubxona/framework qo'shma, build bosqichi qo'shma.
- Interfeys matnlari o'zbekcha (lotin).
