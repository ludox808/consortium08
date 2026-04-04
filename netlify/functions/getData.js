exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  const type = event.queryStringParameters?.type;
  const token = process.env.NOTION_TOKEN;
  if (!token) return { statusCode: 500, headers, body: JSON.stringify({ error: "NOTION_TOKEN not set" }) };

  const dbMap = {
    membres: "6436e822-48be-475c-879e-d019f780c39c",
    orgs: "26e8ec6c-0853-4ce4-96da-ad1d5ac25153",
    liens: "9924620e-87e1-4d5b-89eb-206b582b253b"
  };

  if (!dbMap[type]) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid type" }) };

  try {
    const resp = await fetch(`https://api.notion.com/v1/databases/${dbMap[type]}/query`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    const text = await resp.text();
    if (!resp.ok) return { statusCode: 500, headers, body: JSON.stringify({ error: text }) };
    return { statusCode: 200, headers, body: text };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
