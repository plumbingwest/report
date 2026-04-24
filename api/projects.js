// api/projects.js — Vercel Serverless Function
// GET /api/projects?q=search+term
// Returns matching CompanyCam projects

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.COMPANYCAM_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'COMPANYCAM_TOKEN environment variable not set' });
  }

  const q = req.query.q || '';

  try {
    // CompanyCam v2 API — list projects with search filter
    const url = new URL('https://api.companycam.com/v2/projects');
    if (q) url.searchParams.set('search', q);
    url.searchParams.set('per_page', '20');
    url.searchParams.set('page', '1');

    const ccRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!ccRes.ok) {
      const text = await ccRes.text();
      return res.status(ccRes.status).json({ error: `CompanyCam error: ${text}` });
    }

    const data = await ccRes.json();

    // Normalize to what the front-end expects
    const projects = (Array.isArray(data) ? data : data.projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      address: [p.address?.street_address_1, p.address?.city, p.address?.state]
        .filter(Boolean)
        .join(', '),
    }));

    return res.status(200).json({ projects });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
