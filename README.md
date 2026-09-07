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
cp .env.example .env   # VITE_API_BASE_URL يبقى مؤشّر على الباك إند (افتراضيًا http://localhost:8000)
npm run dev
```
الفرونت إند شغال بيعتمد على الباك إند فعليًا (مفيش localStorage/mock دلوقتي) —
لازم تشغّلي الباك إند الأول عشان الشاشات تشتغل.

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
    api.ts               # طبقة الاتصال الفعلية بالباك إند (fetch + mapping)
    storage.ts            # واجهة رفيعة فوق api.ts (listReports/getReport/addReport/setReportStatus)
    incidents.ts          # تجميع البلاغات في incidents بالاعتماد على incidentId من الباك إند
    geo.ts                 # تحليل نص "lat, lng" المستخدم في حقل الموقع
  components/            # Header, SeverityBadge, ReportCard, PhotoDropzone...
  pages/
    ReportPage.tsx        # إرسال بلاغ جديد (صورة حقيقية + وصف + موقع) → الباك إند يحلل ويرجع النتيجة
    FeedPage.tsx           # قائمة كل البلاغات
    ReportDetailPage.tsx   # تفاصيل بلاغ واحد + البلاغات المرتبطة به
    DashboardPage.tsx      # لوحة الإدارة (خريطة، إحصائيات، نشاط)
    FindingsPage.tsx       # إدارة البلاغات (كانبان/جدول) وتغيير الحالة
```

## الاتصال بالباك إند

الفرونت إند بيكلم [`backend/`](backend/README.md) فعليًا عن طريق `src/lib/api.ts`:
- `POST /reports` (multipart: صورة + وصف + موقع) عند إرسال بلاغ جديد
- `GET /reports` لكل الشاشات اللي بتعرض قوائم بلاغات
- `PATCH /reports/{id}` لتغيير حالة البلاغ (كانبان/سلايد أوفر)

مفيش `mockAnalyze` أو `localStorage` دلوقتي — كل التحليل والتخزين بيحصل في
الباك إند. لو الباك إند مش شغال، الشاشات هتفضل فاضية (مفيش fallback بيانات
وهمية عن قصد، عشان الديمو يعكس الحالة الحقيقية للنظام).
