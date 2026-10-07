import type { VercelRequest, VercelResponse } from '@vercel/node';

export const VISION_SYSTEM_PROMPT = `You are analysing a certificate image to turn it into a reusable template. Transcribe every piece of TEXT you can see. For each text block return: bbox as normalised [x0,y0,x1,y1] in 0..1 of the image; the exact text; guessed font family (sans/serif/mono + closest common Google font name); weight (300-800); approximate font size as a fraction of image height; colour hex; alignment; and 'role': 'fixed' if the text would be identical on every certificate issued by this organisation (institution names, headings like CERTIFICATE, signatory names, fixed labels) or 'variable' if it is specific to one recipient or event (recipient name, certificate number, course or event name, dates, grade, role verb, certificate type like 'OF PARTICIPATION'). For paragraphs that mix fixed and variable parts, return the text with variable parts wrapped as {{snake_case_key}} and list each key with a human label, a type (text|date|number|textarea|select) and the original sample value. Do not invent text. Do not include logos, seals or signatures as text. Return JSON matching the provided schema and nothing else.

OUTPUT JSON FORMAT:
{
  "suggestedName": "String",
  "blocks": [
    {
      "bbox": [0.1, 0.2, 0.4, 0.25],
      "text": "Certificate No: {{certificate_number}}",
      "fontFamily": "Plus Jakarta Sans",
      "fontWeight": 600,
      "fontSizeFraction": 0.02,
      "colorHex": "#1E293B",
      "align": "left",
      "role": "variable",
      "fields": [
        {
          "key": "certificate_number",
          "label": "Certificate Number",
          "type": "text",
          "sample": "SASET/CBT/001",
          "mapsTo": "certificate_number"
        }
      ]
    }
  ]
}`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { imageDataUrl, width, height } = body || {};

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      res.status(400).json({ error: 'Missing required imageDataUrl parameter.' });
      return;
    }

    if (imageDataUrl.length > 3.5 * 1024 * 1024) {
      res.status(413).json({ error: 'Payload exceeds 3 MB limit.' });
      return;
    }

    const provider = process.env.TEMPLATE_AI_PROVIDER || 'gemini';
    const geminiKey = process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (provider === 'gemini' && geminiKey) {
      const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        res.status(400).json({ error: 'Invalid base64 data URL' });
        return;
      }
      const mimeType = match[1];
      const base64Data = match[2];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              { text: VISION_SYSTEM_PROMPT },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = (await response.json()) as any;
        const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          const parsed = JSON.parse(candidateText);
          res.status(200).json({ engine: 'vision', ...parsed, canvas: { width, height } });
          return;
        }
      }
    } else if (provider === 'anthropic' && anthropicKey) {
      const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1] as 'image/jpeg' | 'image/png' | 'image/webp';
        const base64Data = match[2];

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mimeType,
                      data: base64Data,
                    },
                  },
                  {
                    type: 'text',
                    text: VISION_SYSTEM_PROMPT + '\nRespond ONLY with valid JSON.',
                  },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const text = data.content?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            res.status(200).json({ engine: 'vision', ...parsed, canvas: { width, height } });
            return;
          }
        }
      }
    }

    res.status(503).json({
      error: 'Vision AI key not configured or service unavailable; falling back to OCR / manual mode.',
      fallbackToOcr: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ error: msg, fallbackToOcr: true });
  }
}
