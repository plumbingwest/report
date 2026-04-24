// api/generate-report.js — Vercel Serverless Function
// POST /api/generate-report
// Calls Claude to write the report, then renders it as a PDF via HTML

export const config = {
  api: {
    responseLimit: '10mb',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const ccToken = process.env.COMPANYCAM_TOKEN;

  if (!claudeKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable not set' });
  }

  const { address, date, type, findings, actions, scope, disclaimer, preparedBy, photos } = req.body;

  // ─── 1. Download selected photos as base64 ─────────────────────────────
  const photoData = [];
  for (const photo of photos || []) {
    try {
      const photoRes = await fetch(photo.url, {
        headers: ccToken ? { Authorization: `Bearer ${ccToken}` } : {},
      });
      if (photoRes.ok) {
        const buffer = await photoRes.arrayBuffer();
        const b64 = Buffer.from(buffer).toString('base64');
        const ct = photoRes.headers.get('content-type') || 'image/jpeg';
        photoData.push({ ...photo, b64, contentType: ct });
      }
    } catch {
      // Skip photos that fail to download
    }
  }

  // ─── 2. Call Claude to generate professional report text ───────────────
  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const reportTypeLabel = {
    leak: 'Leak Investigation Report',
    freeze: 'Freeze Damage Assessment & Service Report',
    general: 'Plumbing Investigation Report',
  }[type] || 'Investigation Report';

  const photoDescriptions = photoData.map((p, i) =>
    `Photo ${i + 1}: ${p.caption || '(no caption provided)'}`
  ).join('\n');

  const systemPrompt = `You are a professional report writer for Plumbing West, a licensed plumbing contractor specializing in insurance restoration work in Minnesota. You write clear, factual, professional investigation reports for insurance claims.

Your reports are read by insurance adjusters, general contractors, and property owners. Use precise plumbing terminology but keep language accessible. Be direct and factual — no filler.

Write in third person. Do not use "I" or "we" excessively — prefer "Plumbing West" or passive construction where natural.`;

  const userPrompt = `Write a professional plumbing investigation report with these details:

PROPERTY: ${address}
DATE OF SERVICE: ${formattedDate}
REPORT TYPE: ${reportTypeLabel}
PREPARED BY: ${preparedBy}

RAW FINDINGS FROM TECHNICIAN:
${findings}

ACTIONS TAKEN:
${actions || 'Not specified'}

SCOPE OF REPAIR / RECOMMENDATIONS:
${scope || 'Not specified'}

${disclaimer ? `SPECIAL NOTES / DISCLAIMER:\n${disclaimer}` : ''}

PHOTOS INCLUDED (${photoData.length} total):
${photoDescriptions || 'No photos selected'}

Write the following sections in order. Use these exact section headers:
1. Background
2. Findings (use numbered findings if there are multiple issues; use bold lead-in labels like "**Burst Pipe:**")
3. Actions Taken (bullet list)
4. Scope of Repair Required
${disclaimer ? '5. Disclaimer\n6. Documentation Photographs (just list the photo captions as "Photo 1: ...", "Photo 2: ..." etc.)' : '5. Documentation Photographs (just list the photo captions as "Photo 1: ...", "Photo 2: ..." etc.)'}

Keep the tone professional and factual. Each section should be substantive but concise. Do not add a title — that will be added separately. Do not include any preamble.

Return ONLY the report body content using markdown formatting (## for section headers, **bold** for emphasis, - for bullets). Nothing else.`;

  let reportMarkdown = '';
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json();
      return res.status(500).json({ error: `Claude API error: ${err.error?.message}` });
    }

    const claudeData = await claudeRes.json();
    reportMarkdown = claudeData.content?.[0]?.text || '';
  } catch (err) {
    return res.status(500).json({ error: `Claude call failed: ${err.message}` });
  }

  // ─── 3. Convert markdown to HTML sections ─────────────────────────────
  function mdToHtml(md) {
    return md
      .split('\n')
      .map(line => {
        if (line.startsWith('## ')) return `<h3>${line.slice(3)}</h3>`;
        if (line.startsWith('### ')) return `<h4>${line.slice(4)}</h4>`;
        if (line.startsWith('- ')) return `<li>${inlineFormat(line.slice(2))}</li>`;
        if (line.match(/^\d+\. /)) return `<li>${inlineFormat(line.replace(/^\d+\. /, ''))}</li>`;
        if (line.trim() === '') return '<br/>';
        return `<p>${inlineFormat(line)}</p>`;
      })
      .join('\n')
      .replace(/(<li>.*<\/li>\n?)+/g, match => `<ul>${match}</ul>`);
  }

  function inlineFormat(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  const reportHtml = mdToHtml(reportMarkdown);

  // ─── 4. Build photo HTML ───────────────────────────────────────────────
  const photosHtml = photoData.map((p, i) => `
    <div class="photo-block">
      <img src="data:${p.contentType};base64,${p.b64}" alt="Photo ${i + 1}" />
      <p class="photo-caption"><em>Photo ${i + 1}${p.caption ? ': ' + p.caption : ''}</em></p>
    </div>
  `).join('');

  // ─── 5. Build the full print-ready HTML document ──────────────────────
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: letter; margin: 1in; }

  * { box-sizing: border-box; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.55;
    margin: 0;
    padding: 0;
  }

  /* ── Letterhead ── */
  .letterhead {
    margin-bottom: 6px;
  }
  .lh-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .company-name {
    font-size: 18pt;
    font-weight: bold;
    font-style: italic;
    color: #1a1a1a;
    line-height: 1.1;
  }
  .company-sub {
    font-size: 10pt;
    color: #555;
    margin-top: 2px;
  }
  .company-phone {
    font-size: 10pt;
    color: #1a1a1a;
    text-align: right;
    margin-top: 4px;
  }
  .red-rule {
    border: none;
    border-top: 3px double #c0392b;
    margin: 8px 0 18px 0;
  }

  /* ── Report header ── */
  .report-title {
    font-size: 14pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .report-subtitle {
    font-size: 10pt;
    font-weight: bold;
    text-align: center;
    color: #555;
    margin-bottom: 18px;
  }
  .meta-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 22px;
  }
  .meta-table td {
    padding: 4px 8px;
    font-size: 10.5pt;
  }
  .meta-table .meta-label {
    font-weight: bold;
    width: 140px;
    color: #333;
  }

  /* ── Body sections ── */
  h3 {
    font-size: 11pt;
    font-weight: bold;
    margin: 18px 0 6px 0;
    border-bottom: 1px solid #ddd;
    padding-bottom: 3px;
    color: #1a1a2e;
  }
  h4 {
    font-size: 11pt;
    font-weight: bold;
    margin: 12px 0 4px 0;
  }
  p { margin: 0 0 8px 0; }
  ul {
    margin: 4px 0 10px 0;
    padding-left: 22px;
  }
  li { margin-bottom: 4px; }

  /* ── Photos ── */
  .photos-section { margin-top: 24px; }
  .photo-block {
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .photo-block img {
    max-width: 100%;
    max-height: 4in;
    display: block;
    border: 1px solid #ccc;
    border-radius: 3px;
  }
  .photo-caption {
    font-size: 9.5pt;
    color: #555;
    margin-top: 5px;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 32px;
    font-size: 9pt;
    color: #777;
    text-align: center;
    border-top: 1px solid #ddd;
    padding-top: 8px;
  }
</style>
</head>
<body>

<div class="letterhead">
  <div class="lh-top">
    <div>
      <div class="company-name">Plumbing West</div>
      <div class="company-sub">Insurance Restoration</div>
    </div>
    <div class="company-phone">Phone: (320) 587-0300</div>
  </div>
  <hr class="red-rule" />
</div>

<div class="report-title">${reportTypeLabel}</div>

<table class="meta-table">
  <tr>
    <td class="meta-label">Property:</td>
    <td>${address}</td>
  </tr>
  <tr>
    <td class="meta-label">Date of Service:</td>
    <td>${formattedDate}</td>
  </tr>
  <tr>
    <td class="meta-label">Prepared By:</td>
    <td>${preparedBy}</td>
  </tr>
</table>

<div class="report-body">
  ${reportHtml}
</div>

${photoData.length > 0 ? `<div class="photos-section">${photosHtml}</div>` : ''}

<div class="footer">
  Plumbing West &nbsp;|&nbsp; Insurance Restoration &nbsp;|&nbsp; Hutchinson, MN &nbsp;|&nbsp; Licensed Plumbing Contractor — State of Minnesota
</div>

</body>
</html>`;

  // ─── 6. Use Vercel's built-in chromium to render PDF ──────────────────
  // We use @sparticuz/chromium + puppeteer-core (standard Vercel pattern)
  try {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }, // margins already in CSS @page
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PlumbingWest_Report.pdf"`);
    return res.send(Buffer.from(pdf));

  } catch (err) {
    // Fallback: return the HTML so user can print-to-PDF manually
    res.setHeader('Content-Type', 'text/html');
    return res.send(fullHtml);
  }
}
