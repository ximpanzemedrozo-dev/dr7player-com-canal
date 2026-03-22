const axios = require('axios');

exports.handler = async (event) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, body: "URL ausente" };
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    
    const response = await axios.get(decodedUrl, {
      timeout: 20000,
      // Importante: para API usamos JSON, para M3U usamos text
      responseType: decodedUrl.includes('player_api.php') ? 'json' : 'text',
      headers: {
        'User-Agent': 'IPTVSmartersPlayer',
        'Accept': '*/*'
      },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(response.data),
    };
  } catch (error) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Servidor IPTV Recusou", details: error.message }),
    };
  }
};
