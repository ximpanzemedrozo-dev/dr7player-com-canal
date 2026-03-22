const axios = require('axios');

exports.handler = async (event) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: "URL não fornecida" }) 
    };
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);

    // Fazendo a requisição com Headers de um Navegador Real
    const response = await axios.get(decodedUrl, {
      timeout: 30000, // Aumentei para 30 segundos (listas M3U grandes demoram)
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      },
      // Ignora erros de SSL do servidor IPTV
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "no-cache"
      },
      body: response.data,
    };
  } catch (error) {
    console.error("Erro no Proxy:", error.message);
    
    // Se o servidor de IPTV der erro, tentamos avisar o que foi
    return {
      statusCode: error.response ? error.response.status : 502,
      body: JSON.stringify({ 
        error: "O servidor de IPTV não respondeu corretamente.", 
        details: error.message 
      }),
    };
  }
};
