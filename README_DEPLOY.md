# نشر الإصدار 56.14

## التحديث من 56.13 إلى 56.14

هذا التحديث يحتوي على تحسين في Functions والواجهة فقط؛ لا توجد قواعد جديدة مطلوبة. بعد فك الضغط نفّذ:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT="60"
firebase deploy --only functions
npm run build
firebase deploy --only hosting
```

## Vercel

- Framework: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: empty

## Firebase backend

نفّذ بالترتيب من مجلد المشروع:

```powershell
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only hosting
```

صفحة المدرس الخاصة:

```text
/teacher-login.html
```

يمكن أيضًا تنفيذ كل الاختبارات والنشر بالأمر:

```powershell
npm run firebase:deploy:all
```

مهم: لا تكتفِ بنشر Vercel؛ تعديلات الحجز والكود الموحّد والتسميع والواجب وتصريح رفع الملفات تحتاج نشر Firebase Functions والقواعد والفهارس أيضًا. انشر الدوال أولًا ثم القواعد ثم الواجهة مباشرة.

راجع `UPGRADE_V56_AR.md` للاختبار بعد النشر.
