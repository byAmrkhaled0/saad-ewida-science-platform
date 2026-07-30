# نشر الإصدار 69.0.0

الإصدار 69.0.0 يضيف جدولة الواجبات الآمنة وتحذيرات الغياب المتتالي، ويحتفظ بمسار `platformApi` لاسترداد CORS واختباره تلقائيًا أثناء `npm run deploy:production`.

## صلاحيات حساب تشغيل Cloud Functions — مرة واحدة

نفّذ الأمرين التاليين في Google Cloud Shell قبل اختبار بوابة الطالب أو ولي الأمر. سجل التشغيل الفعلي هو:

```text
459812644202-compute@developer.gserviceaccount.com
```

```bash
gcloud projects add-iam-policy-binding saad-ewida-science-platform --member="serviceAccount:459812644202-compute@developer.gserviceaccount.com" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding saad-ewida-science-platform --member="serviceAccount:459812644202-compute@developer.gserviceaccount.com" --role="roles/firebasecloudmessaging.admin"
```

الدور الأول إلزامي لقراءة وكتابة Firestore من Cloud Functions. الدور الثاني مطلوب لإرسال إشعارات الحجز في الخلفية.

من داخل مجلد المشروع:

```powershell
npx --yes firebase-tools@latest login
npm install
npm run firebase:prepare
npm run firebase:functions
npm run firebase:rules
npm run firebase:hosting
```

أو استخدم الأمر الموحّد:

```powershell
npm run firebase:deploy:all
```

استخدم Node.js 22 عند تجهيز ونشر Firebase Functions.

إذا توقف اختبار CORS عند `platformApi` رغم نجاح النشر، نفّذ الأمر التالي مرة واحدة من Google Cloud Shell ثم أعد `npm run verify:production`:

```bash
gcloud run services add-iam-policy-binding platformapi --project=saad-ewida-science-platform --region=europe-west1 --member="allUsers" --role="roles/run.invoker"
```

لا تضف `vercel.live` إلى CSP؛ رسالة Vercel Feedback لا تخص وظائف الموقع ويمكن إيقافها من إعدادات Toolbar في Vercel.

مهم: جدولة الواجبات لا تكتمل بمجرد تشغيل localhost أو نشر ملفات الواجهة. يجب نشر Functions من هذه النسخة حتى يمنع الخادم ظهور الواجب أو رفع حله قبل موعد النشر.

صفحة الإدارة بعد النشر:

```text
/teacher-login.html
```
