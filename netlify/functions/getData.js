'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL             = 'claude-sonnet-4-20250514';
const MAX_TOKENS        = 4000;

const DB_ORGS    = '26e8ec6c-0853-4ce4-96da-ad1d5ac25153';
const DB_MEMBRES = '6436e822-48be-475c-879e-d019f780c39c';
const DB_LIENS   = '9924620e-87e1-4d5b-89eb-206b582b253b';

// ── Prompts ────────────────────────────────────────────────────────────────
const PROMPTS = {
  orgs: `Use the Notion MCP tool to query ALL pages from the database with ID "${DB_ORGS}".
Return a JSON array where each element has exactly these fields:
- id: the Notion page ID (string)
- name: the page title / Name property (string)
- type: the Type or "Type d'organisation" property (string, default "")
- pilier: the Pilier property (string, default "")
- zone: the Zone or Territoire property (string, default "Liège")
- etp: the ETP property as a number (number, default 0)
- financement: the Financement property (string, default "")
- desc: the Description property (string, default "")
Return ONLY the raw JSON array, no explanation, no markdown fences.`,

  membres: `Use the Notion MCP tool to query ALL pages from the database with ID "${DB_MEMBRES}".
Return a JSON array where each element has exactly these fields:
- id: the Notion page ID (string)
- nom: the Nom property — full name (string)
- role: the Fonction or Rôle property (string, default "")
- email: the Email property (string, default "")
- tel: the Téléphone property (string, default "")
- photo: the first external URL from the Photo property if present, else null
- orgId: the Notion page ID of the first entry in the "Organisation liée" relation property (string or null)
- statut: the Statut property (string, default "")
Return ONLY the raw JSON array, no explanation, no markdown fences.`,

  liens: `Use the Notion MCP tool to query ALL pages from the database with ID "${DB_LIENS}".
Return a JSON array where each element has exactly these fields:
- from: the Notion page ID of the first relation entry in the "Membre 1" (or first member) property (string)
- to: the Notion page ID of the first relation entry in the "Membre 2" (or second member) property (string)
- type: the "Type de lien" property value mapped to one of exactly these strings: "collabore", "connait", "ancienne", "orgscontact"
Only include entries where both from and to are non-empty strings.
Return ONLY the raw JSON array, no explanation, no markdown fences.`
};

// ── JSON extraction ────────────────────────────────────────────────────────
function extractJSON(text) {
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  let best = null, bestLen = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '[' && text[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (esc) { esc = false; continue; }
      if (c === '\\' && inStr) { esc = true; continue; }
      if (c === '"') inStr = !inStr;
      if (!inStr) {
        if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          if (candidate.length > bestLen) {
            try { JSON.parse(candidate); best = candidate; bestLen = candidate.length; } catch (e) {}
          }
          break;
        }
      }
    }
  }
  if (!best) throw new Error('No valid JSON found in API response');
  return JSON.parse(best);
}

// ── Anthropic MCP call ─────────────────────────────────────────────────────
async function callAnthropicMCP(prompt) {
  const apiKey      = process.env.ANTHROPIC_API_KEY;
  const notionToken = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || '';

  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

  const mcpServer = { type: 'url', url: 'https://mcp.notion.com/mcp', name: 'notion' };
  if (notionToken) mcpServer.authorization_token = notionToken;

  const body = {
    model:       MODEL,
    max_tokens:  MAX_TOKENS,
    mcp_servers: [mcpServer],
    messages:    [{ role: 'user', content: prompt }]
  };

  const resp = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':  'mcp-client-2025-04-04'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const textBlocks = (data.content || []).filter(b => b.type === 'text');
  if (!textBlocks.length) throw new Error('No text content in Anthropic API response');
  return textBlocks[textBlocks.length - 1].text;
}

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const type = (event.queryStringParameters || {}).type;

  if (!PROMPTS[type]) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown type "${type}". Expected: orgs, membres, liens` })
    };
  }

  try {
    const raw  = await callAnthropicMCP(PROMPTS[type]);
    const data = extractJSON(raw);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error(`[getData] type=${type} error:`, err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
