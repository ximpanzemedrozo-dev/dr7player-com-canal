const express = require('express');
const axios = require('axios');
const https = require('https');

const app = express();
// A Discloud vai definir a porta automaticamente
const port = process.env.PORT || 8080; 

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Rota principal do proxy que o seu aplicativo vai chamar
app.get('/api/proxy-m3u', async (req, res) => {
  const targetUrl = req.query.url;

  // Libera o acesso para o seu aplicativo
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!targetUrl) {
    return res.status(400).json({ error: "URL ausente" });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    const isApi = decodedUrl.includes('player_api.php');
    
    // IP falso para enganar o bloqueio do servidor IPTV
    const randomIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

    const response = await axios.get(decodedUrl, {
      timeout: 60000, // 60 segundos inteiros para baixar a lista sem cortes!
      responseType: isApi ? 'json' : 'text',
      headers: {
        'User-Agent': 'IPTVSmartersPlayer',
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'X-Forwarded-For': randomIP
      },
      httpsAgent: httpsAgent,
      validateStatus: function (status) {
        return true; 
      },
    });

    res.status(response.status);
    res.setHeader("Content-Type", isApi ? "application/json" : "text/plain");

    if (isApi) {
      res.json(response.data);
    } else {
      res.send(response.data);
    }

  } catch (error) {
    res.status(502).json({ 
      error: "Falha de conexão com o servidor IPTV", 
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor proxy rodando na porta ${port}`);
});
