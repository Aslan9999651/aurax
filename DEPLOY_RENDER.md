# نشر AuraX على Render (خطة مجانية)

المتطلبات: حساب GitHub، حساب Render مجاني، حساب MongoDB Atlas مجاني.

## 1) قاعدة البيانات (MongoDB Atlas — مجاني)
1. أنشئ Cluster مجاني (M0) على https://cloud.mongodb.com
2. Database Access: أنشئ مستخدم/كلمة مرور.
3. Network Access: أضف `0.0.0.0/0` (السماح للجميع).
4. انسخ رابط الاتصال (Connection String)، مثال:
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`

## 2) ارفع الكود على GitHub
- فك ضغط `aurax-full-platform.zip` وارفع محتواه إلى مستودع GitHub جديد
  (يجب أن يكون ملف `render.yaml` في جذر المستودع).

## 3) النشر على Render عبر Blueprint
1. من لوحة Render: **New → Blueprint** واختر مستودع GitHub.
2. سيقرأ Render ملف `render.yaml` وينشئ خدمتين: `aurax-backend` و `aurax-frontend`.
3. أدخل قيم متغيرات البيئة عند الطلب:
   - **aurax-backend**:
     - `MONGO_URL` = رابط MongoDB Atlas
     - `ADMIN_EMAIL` = بريد الأدمن (مثال admin@aurax.io)
     - `ADMIN_PASSWORD` = كلمة مرور قوية
     - `EMERGENT_EMAIL_KEY` = مفتاح البريد (اختياري؛ بدونه لن تُرسل رسائل التأكيد لكن يظهر الرمز في سجل الخادم)
   - **aurax-frontend**:
     - `REACT_APP_BACKEND_URL` = رابط الـ backend بعد نشره
       (مثال: `https://aurax-backend.onrender.com`) — بدون شرطة في النهاية.
4. اضغط **Apply** لبدء النشر.

## 4) الترتيب الصحيح
1. انشر الـ backend أولاً واحصل على رابطه.
2. ضع الرابط في `REACT_APP_BACKEND_URL` للـ frontend ثم أعد النشر (Redeploy/Clear cache).

## ملاحظات مهمة
- **الخطة المجانية تنام بعد الخمول**: أول طلب بعد فترة توقف قد يستغرق ~50 ثانية (Cold start).
- **WebSocket (الإشعارات اللحظية)** مدعوم على Render؛ الواجهة تشتق رابط `wss` تلقائياً من `REACT_APP_BACKEND_URL`.
- **CORS**: للأمان، بعد التأكد من الرابط النهائي، غيّر `CORS_ORIGINS` في الـ backend إلى رابط الواجهة بدل `*`.
- **البريد (Resend المُدار) وتسجيل Google** يعملان من أي استضافة لأنهما نداءات HTTP لخدمات Emergent.
- **الأدمن يُنشأ تلقائياً** عند أول تشغيل من `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- لوحة الأدمن تُفتح على المسار `/admin` ضمن نفس رابط الواجهة.
