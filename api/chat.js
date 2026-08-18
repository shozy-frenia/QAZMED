export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const systemPrompt = `You are an educational assistant...`;

  try {
    const response = await fetch('https://api.freetheai.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'bbl/gemini-3.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('FreeTheAi chat error:', response.status, errText);
      return res.status(response.status).json({ error: `FreeTheAi error: ${response.status}` });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Chat proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}
