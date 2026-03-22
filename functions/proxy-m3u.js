exports.handler = async (event) => {
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
    
    let mockBody;
    let contentType;

    // Simula um tempo de carregamento de 500ms para você testar as telas de loading do App no celular
    await new Promise(resolve => setTimeout(resolve, 500));

    if (isApi) {
      contentType = "application/json";
      
      // Verifica o que o seu App está pedindo na API (XTREAM) e responde com dados falsos
      if (decodedUrl.includes('action=get_live_categories')) {
        mockBody = JSON.stringify([
          { category_id: "1", category_name: "TV Aberta", parent_id: 0 },
          { category_id: "2", category_name: "Esportes (Teste)", parent_id: 0 },
          { category_id: "3", category_name: "Filmes e Séries", parent_id: 0 }
        ]);
      } 
      else if (decodedUrl.includes('action=get_live_streams')) {
         mockBody = JSON.stringify([
          { num: 1, name: "Globo SP Fictício", stream_id: 101, stream_icon: "https://via.placeholder.com/150", category_id: "1" },
          { num: 2, name: "ESPN Fictício", stream_id: 102, stream_icon: "https://via.placeholder.com/150", category_id: "2" },
          { num: 3, name: "HBO Fictício", stream_id: 103, stream_icon: "https://via.placeholder.com/150", category_id: "3" }
        ]);
      } 
      else {
        // Se não tiver action, é o login padrão da API
        mockBody = JSON.stringify({
          user_info: {
            username: "MatheusDev",
            password: "123",
            message: "Logged In",
            auth: 1,
            status: "Active",
            exp_date: "1999999999", // Validade infinita
            is_trial: "0",
            active_cons: "0",
            max_connections: "1"
          },
          server_info: {
            url: "mock.dalvastream.local",
            port: "80",
            https_port: "443",
            server_protocol: "http",
            timezone: "America/Sao_Paulo",
            time_now: new Date().toISOString()
          }
        });
      }
    } else {
      // Se for pedido o formato M3U puro, retorna um texto simulando uma lista
      contentType = "text/plain";
      mockBody = `#EXTM3U\n#EXTINF:-1 tvg-id="1" tvg-name="Globo SP Fictício" group-title="TV Aberta",Globo SP Fictício\nhttp://mock.test/stream1.ts\n#EXTINF:-1 tvg-id="2" tvg-name="ESPN Fictício" group-title="Esportes",ESPN Fictício\nhttp://mock.test/stream2.ts`;
    }

    return {
      statusCode: 200, 
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      },
      body: mockBody,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "Erro no servidor de testes", 
        details: error.message
      }),
    };
  }
};
