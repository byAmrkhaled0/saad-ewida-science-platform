# نشر الإصدار 69.2.6

الإصدار 69.2.6 يشمل إصلاحات الامتحانات V69.2.5، ويضيف Pagination وتحميل السجلات الثقيلة حسب قسم الإدارة وفهارس Firestore المركبة لسجل الطالب. يجب نشر `firestore:indexes` مع Functions والواجهة. قد تحتاج الفهارس عدة دقائق لتصبح Enabled بعد النشر، وخلال ذلك تعمل بوابات الطلاب بالاستعلام الاحتياطي.

## تفعيل إشعارات الطلاب — مرة واحدة

أنشئ Web Push certificate من Firebase Console ثم انسخ الـ Public VAPID Key إلى `messagingVapidKey` داخل `assets/firebase-config.js`. بدون هذا المفتاح ستظل المنصة والامتحانات والماسح تعمل، لكن زر إشعارات الطالب سيعرض أن الإعداد غير مكتمل.

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

استخدم Node.js 24 لتثبيت وبناء المشروع محليًا. إعداد Firebase نفسه ينشر Functions على Node.js 22 تلقائيًا من `firebase.json`.

سكربت `deploy-production.ps1` يضبط تلقائيًا مهلة اكتشاف وظائف Firebase إلى 60 ثانية باستخدام `FUNCTIONS_DISCOVERY_TIMEOUT`، ويقسم الوظائف إلى مجموعات لا تزيد على 10 وظائف لتفادي مهلة الاكتشاف وحدود النشر على Windows.

إذا توقف اختبار CORS عند `platformApi` رغم نجاح النشر، نفّذ الأمر التالي مرة واحدة من Google Cloud Shell ثم أعد `npm run verify:production`:

```bash
gcloud run services add-iam-policy-binding platformapi --project=saad-ewida-science-platform --region=europe-west1 --member="allUsers" --role="roles/run.invoker"
```

لا تضف `vercel.live` إلى CSP؛ رسالة Vercel Feedback لا تخص وظائف الموقع ويمكن إيقافها من إعدادات Toolbar في Vercel.

مهم: جدولة الواجبات لا تكتمل بمجرد تشغيل localhost أو نشر ملفات الواجهة. يجب نشر Functions من هذه النسخة حتى يمنع الخادم ظهور الواجب أو رفع حله قبل موعد النشر.

ومهم أيضًا: قسم «طلب نقل» لن يعمل بنشر ملفات Vercel وحدها؛ يجب نشر Functions وقواعد Firestore من هذه النسخة لأن الموافقة تنقل الطالب وتحدّث بوابتي الطالب وولي الأمر من الخادم.

صفحة الإدارة بعد النشر:

```text
/teacher-login.html
```
