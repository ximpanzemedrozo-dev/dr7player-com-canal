const BASE_PROXY_URL = '/api/proxy-m3u';

export const fetchFromIPTV = async (server: string, params: object) => {
  try {
    // Monta a URL do servidor (Ex: http://server.com/player_api.php?username=X&password=Y&action=get_live_categories)
    const queryParams = new URLSearchParams(params as any).toString();
    const fullUrl = `${server}/player_api.php?${queryParams}`;

    // Passa tudo pelo nosso Proxy do Netlify
    const response = await fetch(`${BASE_PROXY_URL}?url=${encodeURIComponent(fullUrl)}`);
    
    if (!response.ok) throw new Error('Erro na rede');
    
    return await response.json();
  } catch (error) {
    console.error("Erro ao carregar conteúdo:", error);
    return null;
  }
};
