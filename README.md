# UrbanEye AI

UrbanEye AI بيخلي سكان أي كمباوند/جامعة/مدينة يبلّغوا عن أي مشكلة يشوفوها
(حادث، زبالة، تسريب مياه، عمود نور بايظ، حفرة...) بصورة واحدة، والـ AI بيحلل
البلاغ ويحدد نوع المشكلة، درجة خطورتها، والجهة المسؤولة عنها تلقائيًا. البلاغات
المتشابهة بتتجمع في "Incident" واحد عشان الإدارة تاخد قرار بناءً على صورة واضحة
للموقف، مش شكاوى متفرقة.

هذا الريبو فيه **الواجهة الأمامية (Frontend)** و**الباك إند (Backend)** —
جزء من مشروع أكبر لهاكاثون Smart City، مقسّم لخمس مهام:

1. **API + توحيد السيرفر (`backend/`)**
2. **Frontend المستخدم (`src/`)**
3. الربط بين (1) و(2) + الاختبار
4. Dashboard الإدارة
5. البريزنتيشن / صفحة العرض

## التشغيل محليًا

### الفرونت إند
```bash
npm install
npm run dev
```

### الباك إند
راجع [`backend/README.md`](backend/README.md) للتفاصيل الكاملة (Supabase
project + endpoints + الجداول). خلاصة سريعة:
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # واملأ SUPABASE_SERVICE_ROLE_KEY من الـ dashboard
uvicorn app.main:app --reload --port 8000
```

## البنية

```
src/
  types.ts              # الأنواع: Report, Analysis, Severity, ProblemType
  lib/
    mockAnalyze.ts       # 🔶 محاكاة الـ AI — نقطة الاستبدال بالـ API الحقيقي
    storage.ts            # تخزين البلاغات في localStorage (بديل مؤقت لقاعدة بيانات)
  components/            # Header, SeverityBadge, ReportCard, PhotoDropzone
  pages/
    ReportPage.tsx        # شاشة إرسال بلاغ جديد + عرض نتيجة تحليل الـ AI
    FeedPage.tsx           # قائمة كل البلاغات
    ReportDetailPage.tsx   # تفاصيل بلاغ واحد
```

## نقطة الربط بالـ AI/API الحقيقي

كل منطق الـ "AI" حاليًا Mock وموجود في `src/lib/mockAnalyze.ts` (heuristic بسيط
على الكلمات المفتاحية في الوصف). لما يجهز الـ API الحقيقي، المطلوب فقط استبدال
محتوى الدالة `mockAnalyze` بطلب HTTP فعلي، مثال:

```ts
const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/analyze`, {
  method: "POST",
  body: formData, // { image, description, location }
});
return (await res.json()) as Analysis;
```

نفس الفكرة بالنسبة لـ `src/lib/storage.ts` — بيتم استبداله بطلبات `GET/POST
/reports` من الـ API بدل `localStorage`.
