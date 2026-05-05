export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 
  try {
    const { prompt, systemPrompt } = req.body;
    const fullPrompt = systemPrompt ? systemPrompt + '\n\n' + prompt : prompt;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${process.env.GEMINI_API_KEY||'AIzaSyCJlzgcdjTcW5GiiHcNvHAhyLUaxKwfjwE'}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: 2500, temperature: 0.9 }
        })
      }
    );
 
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Xatolik';
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
 
