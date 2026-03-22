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
    // Decodifica a URL e garante que ela use a porta 80 se for HTTP
    let decodedUrl = decodeURIComponent(targetUrl);
    
    // Força a porta 80 caso o usuário tenha esquecido ou o servidor exija
    if (decodedUrl.startsWith('http://') && !decodedUrl.includes(':80') && !decodedUrl.includes(':8080')) {
        // Opcional: Você pode manipular a string aqui se quiser forçar, 
        // mas como você vai digitar no app, o axios já vai ler o que você mandar.
    }

    const response = await axios.get(decodedUrl, {
      timeout: 40000, // 40 segundos para listas muito grandes
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      },
      // Ignora verificações de SSL para evitar conflitos com o Netlify
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-cache"
      },
      body: response.data,
    };
  } catch (error) {
    console.error("Erro no servidor IPTV:", error.message);
    
    return {
      statusCode: 502,
      body: JSON.stringify({ 
        error: "O servidor de IPTV (Porta 80) demorou a responder ou recusou a conexão.", 
        details: error.message 
      }),
    };
  }
};
