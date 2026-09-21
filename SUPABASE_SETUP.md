# ربط منصة AuraX بقاعدة بيانات Supabase (PostgreSQL)

تم تحويل المنصة بالكامل من MongoDB إلى **Supabase / PostgreSQL**.
الباكند (FastAPI) يتصل مباشرة بقاعدة Postgres عبر `DATABASE_URL`، وينشئ كل الجداول تلقائياً عند أول تشغيل — لا حاجة لأي إعداد يدوي للجداول.

## مشروع Supabase الخاص بك
- Project URL: `https://txfbymcnrccquwswhgxe.supabase.co`
- Publishable key: `sb_publishable_E7bbkcNhvUBMvdixpm1hbg_eYJE1twi`

## خطوة واحدة مطلوبة منك: سلسلة الاتصال
1. افتح لوحة Supabase → اضغط زر **Connect** بالأعلى.
2. اختر **Session pooler** وانسخ الرابط، مثاله:
   ```
   postgresql://postgres.txfbymcnrccquwswhgxe:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres
   ```
3. استبدل `[YOUR-PASSWORD]` بكلمة مرور قاعدة البيانات
   (Project Settings → Database → Database password — يمكنك إعادة ضبطها هناك).
4. ضع الرابط في `backend/.env` تحت `DATABASE_URL`.

> ملاحظة: مفتاح `sb_publishable` وحده لا يكفي للباكند لأنه مخصص للواجهة فقط ولا يستطيع إنشاء الجداول أو إدارة المستخدمين. لذلك نستخدم سلسلة اتصال Postgres.

## التشغيل محلياً
### الباكند
```bash
cd backend
cp .env.example .env         # ثم عبّئ DATABASE_URL
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001
```
### الواجهة
```bash
cd frontend
cp .env.example .env         # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start
```

## حساب الأدمن الافتراضي
- البريد: `admin@aurax.io`
- كلمة المرور: `AuraX@Admin2026`
- لوحة التحكم على المسار `/admin`

## الجداول التي تُنشأ تلقائياً في Supabase
`users, user_sessions, verification_codes, orders, positions, fee_submissions, notifications, admin_logs, settings`

بعد تشغيل الباكند لأول مرة ستجد هذه الجداول ظاهرة في Supabase → Table Editor.
