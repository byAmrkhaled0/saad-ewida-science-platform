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
const release = '69.0.0';
const seoPages = {
  'index.html': ['مدرس أحياء وعلوم في المنصورة وأونلاين | سعد عويضة', 'المستر سعد عويضة مدرس أحياء وعلوم وعلوم متكاملة في المنصورة وأونلاين لجميع المراحل: شرح حديث، امتحانات، تسجيلات ومتابعة للطالب وولي الأمر.'],
  'services.html': ['مدرس أحياء وعلوم في المنصورة | خدمات سعد عويضة', 'خدمات المستر سعد عويضة لطلاب الأحياء والعلوم والعلوم المتكاملة في المنصورة: شرح حديث، حجز إلكتروني، امتحانات وتقارير متابعة للطالب وولي الأمر.'],
  'materials.html': ['المراجعات وبنك الأسئلة | المستر سعد عويضة', 'مراجعات منظمة وبنك أسئلة وملفات تعليمية للأحياء والعلوم والعلوم المتكاملة حسب الصف الدراسي.'],
  'online.html': ['مدرس أحياء وعلوم أونلاين | المستر سعد عويضة', 'محاضرات أحياء وعلوم وعلوم متكاملة أونلاين مع المستر سعد عويضة لجميع المراحل، تشمل بثًا مباشرًا وتسجيلات مرتبة وتدريبات ومتابعة للطالب.'],
  'exams.html': ['امتحانات الأحياء والعلوم | المستر سعد عويضة', 'امتحانات إلكترونية للأحياء والعلوم والعلوم المتكاملة مع وقت محدد ونتيجة ومتابعة لمستوى الطالب.'],
  'reviews.html': ['آراء الطلاب | المستر سعد عويضة', 'تقييمات وآراء طلاب منصة المستر سعد عويضة في شرح الأحياء والعلوم والعلوم المتكاملة.'],
  'privacy.html': ['سياسة الخصوصية | منصة المستر سعد عويضة', 'سياسة حماية بيانات الطلاب وأولياء الأمور في منصة المستر سعد عويضة التعليمية.'],
  'terms.html': ['شروط الاستخدام | منصة المستر سعد عويضة', 'شروط استخدام منصة المستر سعد عويضة التعليمية وخدمات الحجز والمحاضرات والامتحانات.']
};
const privatePages = new Set(['teacher-login.html', 'student.html', 'parent.html', 'offline.html', 'questions.html']);
const imageUrl = `${siteUrl}/assets/icon-512.png`;

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

for (const file of fs.readdirSync(dist).filter(name => name.endsWith('.html'))) {
  const filePath = path.join(dist, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const fallbackTitle = (html.match(/<title>([^<]*)<\/title>/i) || [,'منصة المستر سعد عويضة'])[1];
  const existingDescription = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) || [,'منصة المستر سعد عويضة التعليمية.'])[1];
  const [title, description] = seoPages[file] || [fallbackTitle, existingDescription];
  const canonical = file === 'index.html' ? `${siteUrl}/` : file === 'questions.html' ? `${siteUrl}/materials.html` : `${siteUrl}/${file}`;
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  html = html.replace(/<meta[^>]+name=["']description["'][^>]*>\s*/ig, '').replace(/<meta[^>]+content=["'][^"']*["'][^>]+name=["']description["'][^>]*>\s*/ig, '').replace(/<meta[^>]+name=["']robots["'][^>]*>\s*/ig, '');
  const robots = privatePages.has(file) ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const meta = `<meta name="description" content="${escapeAttr(description)}">\n<meta name="robots" content="${robots}">\n<link rel="canonical" href="${canonical}">\n<link rel="alternate" hreflang="ar-EG" href="${canonical}">\n<link rel="alternate" hreflang="x-default" href="${canonical}">\n<meta property="og:locale" content="ar_EG">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="منصة المستر سعد عويضة">\n<meta property="og:title" content="${escapeAttr(title)}">\n<meta property="og:description" content="${escapeAttr(description)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${imageUrl}">\n<meta property="og:image:width" content="512">\n<meta property="og:image:height" content="512">\n<meta property="og:image:alt" content="منصة المستر سعد عويضة للأحياء والعلوم">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escapeAttr(title)}">\n<meta name="twitter:description" content="${escapeAttr(description)}">\n<meta name="twitter:image" content="${imageUrl}">`;
  html = html.replace('</title>', `</title>\n${meta}`);
  html = html.replace(/\?v=\d+(?:\.\d+)*/g, `?v=${release}`);
  html = html.replace(/<img(?![^>]*\bloading=)([^>]*?)>/gi, '<img loading="lazy" decoding="async"$1>');
  if (file === 'index.html') {
    html = html.replace(/<img\s+loading="lazy"\s+decoding="async"([^>]*src=["']assets\/teacher\.webp["'][^>]*)>/i, '<img fetchpriority="high" decoding="async"$1>');
    html = html.replace(/<img[^>]*src=["']assets\/teacher\.webp["'][^>]*>/i, tag => {
      let seenDecoding=false, seenPriority=false;
      return tag
        .replace(/\sdecoding="async"/g, value => seenDecoding ? '' : (seenDecoding=true,value))
        .replace(/\sfetchpriority="high"/g, value => seenPriority ? '' : (seenPriority=true,value));
    });
    html = html.replace(/<link rel="preconnect" href="https:\/\/www\.gstatic\.com" crossorigin\/?>\s*/i,'');
    html = html.replace('</head>', `<link rel="preload" as="image" href="assets/teacher-480.webp" media="(max-width: 900px)" fetchpriority="high">\n<link rel="preload" as="image" href="assets/teacher.webp" media="(min-width: 901px)" fetchpriority="high">\n</head>`);
  }
  if (file === 'index.html') {
    const schema = { '@context':'https://schema.org', '@graph':[
      { '@type':'WebSite', '@id':`${siteUrl}/#website`, url:`${siteUrl}/`, name:'منصة المستر سعد عويضة', inLanguage:'ar-EG' },
      { '@type':'WebPage', '@id':`${siteUrl}/#webpage`, url:`${siteUrl}/`, name:'مدرس أحياء وعلوم في المنصورة وأونلاين | سعد عويضة', isPartOf:{'@id':`${siteUrl}/#website`}, about:{'@id':`${siteUrl}/#teacher`}, primaryImageOfPage:{'@type':'ImageObject',url:`${siteUrl}/assets/teacher.webp`}, inLanguage:'ar-EG' },
      { '@type':'Person', '@id':`${siteUrl}/#teacher`, name:'سعد عويضة', jobTitle:'مدرس الأحياء والعلوم والعلوم المتكاملة', description:'مدرس أحياء وعلوم وعلوم متكاملة في المنصورة وأونلاين لجميع المراحل', telephone:'+201097163200', url:`${siteUrl}/`, image:`${siteUrl}/assets/teacher.webp`, knowsAbout:['الأحياء','العلوم','العلوم المتكاملة'], areaServed:[{'@type':'City',name:'المنصورة'},{'@type':'Country',name:'مصر'}], sameAs:['https://www.facebook.com/saad.abomoaz'] },
      { '@type':'EducationalOrganization', '@id':`${siteUrl}/#organization`, name:'منصة المستر سعد عويضة', alternateName:'منصة سعد عويضة للأحياء والعلوم', description:'منصة تعليمية لشرح الأحياء والعلوم والعلوم المتكاملة في المنصورة وأونلاين', url:`${siteUrl}/`, logo:imageUrl, telephone:'+201097163200', founder:{'@id':`${siteUrl}/#teacher`}, slogan:'نسعى للإبداع والتفوق', areaServed:[{'@type':'City',name:'المنصورة'},{'@type':'AdministrativeArea',name:'الدقهلية'},{'@type':'Country',name:'مصر'}], sameAs:['https://www.facebook.com/saad.abomoaz'] }
    ]};
    html = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`);
  }
  fs.writeFileSync(filePath, html);
}

// Produce one stylesheet and one script per surface. This preserves the proven
// execution order while removing the many render-blocking version requests.
const cssParts = ['site.css','v55.css','v56.css','v57.css','v59.css','v60.css','v61.css','v64-mobile.css'];
const publicJsParts = ['app.js','v53-upgrades.js','v56-fixes.js','v61-ui.js'];
const adminJsParts = ['app.js','admin.js','v61-ui.js'];
const joinAssets = (items, output) => fs.writeFileSync(
  path.join(dist, 'assets', output),
  items.map(name => fs.readFileSync(path.join(root, 'assets', name), 'utf8')).join('\n;\n')
);
joinAssets(cssParts, 'platform.css');
joinAssets(publicJsParts, 'platform.js');
joinAssets(adminJsParts, 'admin-platform.js');
// Files superseded by the production bundles or not referenced by any page are
// excluded from the deploy artifact to reduce transfer and cache storage.
const legacyAdminAssets = ['v55-admin.js','v59-admin.js','v60-admin.js','v61-admin.js'];
for (const name of [...cssParts, ...publicJsParts, ...adminJsParts, ...legacyAdminAssets]) {
  if (['firebase-config.js','firebase-sync.js','online.js'].includes(name)) continue;
  fs.rmSync(path.join(dist, 'assets', name), { force: true });
}

for (const file of fs.readdirSync(dist).filter(name => name.endsWith('.html'))) {
  const filePath = path.join(dist, file);
  let html = fs.readFileSync(filePath, 'utf8');
  // Accept both relative and root-relative asset paths. offline.html uses
  // /assets/... because it is served as the PWA navigation fallback.
  html = html.replace(/(?:<link[^>]+href=["']\/?assets\/(?:site|v55|v56|v57|v59|v60|v61|v64-mobile)\.css[^>]*>\s*)+/gi, `<link rel="stylesheet" href="assets/platform.css?v=${release}">\n`);
  html = html.replace(/(?:<script defer src=["']\/?assets\/(?:app|v53-upgrades|v56-fixes)\.js[^>]*><\/script>\s*)+/gi, `<script defer src="assets/platform.js?v=${release}"></script>\n`);
  if (file === 'teacher-login.html') {
    html = html.replace(/<script defer src=["']assets\/(?:platform|app|admin|v53-upgrades|v55-admin|v56-fixes|v59-admin|v60-admin)\.js[^>]*><\/script>\s*/gi, '');
    html = html.replace('</body>', `<script defer src="assets/admin-platform.js?v=${release}"></script>\n</body>`);
  }
  const publicBundleTag = `<script defer src="assets/platform.js?v=${release}"></script>`;
  const adminBundleTag = `<script defer src="assets/admin-platform.js?v=${release}"></script>`;
  const cssBundlePattern = /<link rel="stylesheet" href="assets\/platform\.css\?v=[^"]+">\s*/g;
  let cssSeen = false, publicSeen = false, adminSeen = false;
  html = html.replace(cssBundlePattern, match => cssSeen ? '' : (cssSeen = true, match));
  html = html.replace(new RegExp(publicBundleTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), match => publicSeen ? '' : (publicSeen = true, match));
  html = html.replace(new RegExp(adminBundleTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), match => adminSeen ? '' : (adminSeen = true, match));
  if (file === 'index.html') {
    // The public landing page does not need Firebase to produce its first
    // paint. Load it after the page is visible or immediately on interaction.
    html = html.replace(/<script defer src=["']https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-(?:app|auth|firestore|storage|functions)-compat\.js["']><\/script>\s*/gi, '');
    html = html.replace(/<script defer src=["']assets\/firebase-(?:config|sync)\.js[^>]*><\/script>\s*/gi, '');
    html = html.replace('</body>', `<script defer src="assets/firebase-lazy.js?v=${release}" data-version="${release}"></script>\n</body>`);
  }
  fs.writeFileSync(filePath, html);
}

const sitemapPages = Object.keys(seoPages).filter(file => !privatePages.has(file));
const today = new Date().toISOString().slice(0,10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages.map(file => `  <url><loc>${file==='index.html'?`${siteUrl}/`:`${siteUrl}/${file}`}</loc><lastmod>${today}</lastmod><changefreq>${file==='index.html'?'weekly':'monthly'}</changefreq><priority>${file==='index.html'?'1.0':'0.7'}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);

// Fail the production build if a page points at an asset removed by bundling
// or if the same surface bundle is injected twice. This protects the PWA
// fallback as well as pages with an extra page-specific script.
const builtPages = fs.readdirSync(dist).filter(name => name.endsWith('.html'));
const buildReferenceErrors = [];
for (const file of builtPages) {
  const html = fs.readFileSync(path.join(dist, file), 'utf8');
  for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)) {
    const raw = match[1];
    if (/^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    const clean = raw.split('?')[0].replace(/^\//, '');
    if (clean && !fs.existsSync(path.join(dist, clean))) {
      buildReferenceErrors.push(`${file}: missing ${raw}`);
    }
  }
  const publicBundles = (html.match(/assets\/platform\.js/g) || []).length;
  const adminBundles = (html.match(/assets\/admin-platform\.js/g) || []).length;
  const cssBundles = (html.match(/assets\/platform\.css/g) || []).length;
  if (cssBundles !== 1) buildReferenceErrors.push(`${file}: invalid stylesheet bundle count`);
  if (file === 'teacher-login.html') {
    if (publicBundles !== 0 || adminBundles !== 1) buildReferenceErrors.push(`${file}: invalid admin bundle count`);
  } else if (publicBundles !== 1 || adminBundles !== 0) {
    buildReferenceErrors.push(`${file}: invalid public bundle count`);
  }
}
if (buildReferenceErrors.length) {
  throw new Error(`Production build validation failed:\n${buildReferenceErrors.join('\n')}`);
}

console.log('Vercel build ready: static files copied, SEO metadata generated, and assets versioned.');
