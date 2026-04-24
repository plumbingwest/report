// api/photos.js — Vercel Serverless Function
// GET /api/photos?project_id=123
// Returns all photos for a CompanyCam project

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.COMPANYCAM_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'COMPANYCAM_TOKEN environment variable not set' });
  }

  const { project_id } = req.query;
  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  try {
    // Fetch all pages of photos (up to 200)
    const allPhotos = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const url = new URL(`https://api.companycam.com/v2/projects/${project_id}/photos`);
      url.searchParams.set('per_page', String(perPage));
      url.searchParams.set('page', String(page));

      const ccRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!ccRes.ok) {
        const text = await ccRes.text();
        return res.status(ccRes.status).json({ error: `CompanyCam error: ${text}` });
      }

      const data = await ccRes.json();
      const photos = Array.isArray(data) ? data : data.photos || [];

      allPhotos.push(...photos);

      // Stop if we got fewer than a full page
      if (photos.length < perPage) break;
      page++;
      if (page > 4) break; // safety cap at 200 photos
    }

    return res.status(200).json({ photos: allPhotos });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
