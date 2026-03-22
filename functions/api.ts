const axios = require('axios');
const https = require('https');

// Mover o Agent para fora do handler melhora a performance,
// reutilizando a mesma conexão em invocações subsequentes da Lambda
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

exports.handler = async (event) => {
  // Uso de optional chaining caso queryStringParameters venha nulo
  const targetUrl = event?.queryStringParameters?.url;

  if (!targetUrl) {
    return { 
      statusCode: 400, 
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "URL ausente" }) 
    };
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    const isApi = decodedUrl.includes('player_api.php');
    
    const response = await axios.get(decodedUrl, {
      timeout: 20000,
      // Importante: para API usamos JSON, para M3U usamos text
      responseType: isApi ? 'json' : 'text',
      headers: {
        'User-Agent': 'IPTVSmartersPlayer',
        'Accept': '*/*'
      },
      httpsAgent: httpsAgent,
    });

    return {
      statusCode: 200,
      headers: {
        // Define o Content-Type correto com base no que foi requisitado
        "Content-Type": isApi ? "application/json" : "text/plain",
        "Access-Control-Allow-Origin": "*",
      },
      // Se for M3U (texto), envia puro. Se for API, serializa como JSON.
      body: isApi ? JSON.stringify(response.data) : response.data,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Servidor IPTV Recusou", 
        details: error.message 
      }),
    };
  }
};
