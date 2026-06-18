import Anthropic from '@anthropic-ai/sdk';
import type { Cat, Economy } from '@/types/game';
import {
  NEWS_MODEL,
  NEWS_MAX_TOKENS,
  NEWS_SYSTEM_PROMPT,
  buildNewsPrompt,
  buildFallbackNews,
} from '@/lib/engine/news';

interface NewsRequest {
  eventName: string;
  economy: Economy;
  cats: Cat[];
  catName?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: NewsRequest;
  try {
    body = (await request.json()) as NewsRequest;
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { eventName, economy, cats, catName } = body;
  if (!eventName || !economy) {
    return Response.json({ error: 'missing eventName or economy' }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // No key configured -> serve a local templated headline so the game still runs.
  if (!apiKey) {
    return Response.json({ news: buildFallbackNews(eventName, economy, catName) });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: NEWS_MODEL,
      max_tokens: NEWS_MAX_TOKENS,
      system: NEWS_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildNewsPrompt(eventName, economy, cats ?? [], catName) },
      ],
    });

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    return Response.json({ news: text || buildFallbackNews(eventName, economy, catName) });
  } catch {
    // On any API failure, fall back to the local headline rather than erroring.
    return Response.json({ news: buildFallbackNews(eventName, economy, catName) });
  }
}
