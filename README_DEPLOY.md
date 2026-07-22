# نشر الإصدار 63.3.2

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

مهم: إصلاح بوابة طالب الأونلاين، باركود الحضور، فلترة الامتحانات والواجبات لا يكتمل بمجرد تشغيل localhost أو نشر ملفات الواجهة. يجب نشر Functions والقواعد من هذه النسخة.

صفحة الإدارة بعد النشر:

```text
/teacher-login.html
```
