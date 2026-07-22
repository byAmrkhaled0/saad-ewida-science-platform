const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const entriesToCopy = [
  'index.html',
  'services.html',
  'materials.html',
  'online.html',
  'questions.html',
  'exams.html',
  'student.html',
  'parent.html',
  'reviews.html',
  'teacher-login.html',
  'privacy.html',
  'terms.html',
  'assets',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'teacher.webmanifest',
  'service-worker.js',
  'firebase-messaging-sw.js',
  'offline.html'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const entry of entriesToCopy) {
  copyRecursive(path.join(root, entry), path.join(dist, entry));
}

const siteUrl = 'https://saad-ewida-science-platform.vercel.app';
const release = '58.0.0';
const seoPages = {
  'index.html': ['الأستاذ سعد عويضة | أحياء وعلوم وعلوم متكاملة', 'منصة الأستاذ سعد عويضة لشرح الأحياء والعلوم والعلوم المتكاملة: حجز، محاضرات أونلاين، تسجيلات، مراجعات، امتحانات ومتابعة دقيقة للطالب.'],
  'services.html': ['خدمات الأستاذ سعد عويضة التعليمية | أحياء وعلوم', 'تعرف على خدمات الأستاذ سعد عويضة: شرح مبسط، محاضرات مباشرة، تسجيلات، حجز إلكتروني، امتحانات وتقارير متابعة للطالب وولي الأمر.'],
  'materials.html': ['المراجعات وبنك الأسئلة | الأستاذ سعد عويضة', 'مراجعات منظمة وبنك أسئلة وملفات تعليمية للأحياء والعلوم والعلوم المتكاملة حسب الصف الدراسي.'],
  'online.html': ['المحاضرات الأونلاين والتسجيلات | الأستاذ سعد عويضة', 'ادخل محاضرات الأستاذ سعد عويضة المباشرة وشاهد تسجيلات Google Drive المرتبة حسب الصف والترم والوحدة.'],
  'questions.html': ['بنك الأسئلة والتدريبات | الأستاذ سعد عويضة', 'أسئلة وتدريبات ومراجعات في الأحياء والعلوم والعلوم المتكاملة لطلاب المراحل المختلفة.'],
  'exams.html': ['امتحانات الأحياء والعلوم | الأستاذ سعد عويضة', 'امتحانات إلكترونية للأحياء والعلوم والعلوم المتكاملة مع وقت محدد ونتيجة ومتابعة لمستوى الطالب.'],
  'reviews.html': ['آراء الطلاب | الأستاذ سعد عويضة', 'تقييمات وآراء طلاب منصة الأستاذ سعد عويضة في شرح الأحياء والعلوم والعلوم المتكاملة.'],
  'privacy.html': ['سياسة الخصوصية | منصة الأستاذ سعد عويضة', 'سياسة حماية بيانات الطلاب وأولياء الأمور في منصة الأستاذ سعد عويضة التعليمية.'],
  'terms.html': ['شروط الاستخدام | منصة الأستاذ سعد عويضة', 'شروط استخدام منصة الأستاذ سعد عويضة التعليمية وخدمات الحجز والمحاضرات والامتحانات.']
};
const privatePages = new Set(['teacher-login.html', 'student.html', 'parent.html', 'offline.html']);
const imageUrl = `${siteUrl}/assets/icon-512.png`;

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

for (const file of fs.readdirSync(dist).filter(name => name.endsWith('.html'))) {
  const filePath = path.join(dist, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const fallbackTitle = (html.match(/<title>([^<]*)<\/title>/i) || [,'منصة الأستاذ سعد عويضة'])[1];
  const existingDescription = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || [,'منصة الأستاذ سعد عويضة التعليمية.'])[1];
  const [title, description] = seoPages[file] || [fallbackTitle, existingDescription];
  const canonical = file === 'index.html' ? `${siteUrl}/` : `${siteUrl}/${file}`;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  html = html.replace(/<meta[^>]+name=["']description["'][^>]*>\s*/ig, '').replace(/<meta[^>]+content=["'][^"']*["'][^>]+name=["']description["'][^>]*>\s*/ig, '').replace(/<meta[^>]+name=["']robots["'][^>]*>\s*/ig, '');
  const robots = privatePages.has(file) ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const meta = `<meta name="description" content="${escapeAttr(description)}">\n<meta name="robots" content="${robots}">\n<link rel="canonical" href="${canonical}">\n<link rel="alternate" hreflang="ar-EG" href="${canonical}">\n<meta property="og:locale" content="ar_EG">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="منصة الأستاذ سعد عويضة">\n<meta property="og:title" content="${escapeAttr(title)}">\n<meta property="og:description" content="${escapeAttr(description)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${imageUrl}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escapeAttr(title)}">\n<meta name="twitter:description" content="${escapeAttr(description)}">\n<meta name="twitter:image" content="${imageUrl}">`;
  html = html.replace('</title>', `</title>\n${meta}`);
  html = html.replace(/\?v=(?:56(?:\.\d+)*|57(?:\.\d+)*)/g, `?v=${release}`);
  html = html.replace(/<img(?![^>]*\bloading=)([^>]*?)>/gi, '<img loading="lazy" decoding="async"$1>');
  if (file === 'index.html') html = html.replace(/<img loading="lazy" decoding="async"([^>]*class=["'][^"']*teacher[^"']*["'][^>]*)>/i, '<img fetchpriority="high" decoding="async"$1>');
  if (file === 'index.html') {
    const schema = { '@context':'https://schema.org', '@graph':[
      { '@type':'WebSite', '@id':`${siteUrl}/#website`, url:`${siteUrl}/`, name:'منصة الأستاذ سعد عويضة', inLanguage:'ar-EG' },
      { '@type':'Person', '@id':`${siteUrl}/#teacher`, name:'سعد عويضة', jobTitle:'مدرس الأحياء والعلوم والعلوم المتكاملة', url:`${siteUrl}/`, image:`${siteUrl}/assets/teacher.webp`, sameAs:['https://www.facebook.com/saad.abomoaz'] },
      { '@type':'EducationalOrganization', '@id':`${siteUrl}/#organization`, name:'منصة الأستاذ سعد عويضة', url:`${siteUrl}/`, logo:imageUrl, founder:{'@id':`${siteUrl}/#teacher`}, slogan:'نسعى للإبداع والتفوق', areaServed:'EG' }
    ]};
    html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`);
  }
  fs.writeFileSync(filePath, html);
}

const sitemapPages = Object.keys(seoPages).filter(file => !privatePages.has(file));
const today = new Date().toISOString().slice(0,10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages.map(file => `  <url><loc>${file==='index.html'?`${siteUrl}/`:`${siteUrl}/${file}`}</loc><lastmod>${today}</lastmod><changefreq>${file==='index.html'?'weekly':'monthly'}</changefreq><priority>${file==='index.html'?'1.0':'0.7'}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);

console.log('Vercel build ready: static files copied, SEO metadata generated, and assets versioned.');
