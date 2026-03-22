const axios = require('axios');

exports.handler = async (event) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, body: "URL ausente" };
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    
    // Fazemos a chamada fingindo ser um player de IPTV real
    const response = await axios.get(decodedUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'IPTVSmartersPlayer', // Isso ajuda a não ser bloqueado pelo servidor
        'Accept': '*/*',
      },
      // Ignora erros de SSL/HTTPS de servidores antigos
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json", // O XC geralmente responde JSON
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    };
  } catch (error) {
    console.error("Erro no Proxy:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Erro ao buscar dados do servidor", details: error.message }),
    };
  }
};
