exports.handler = async (event) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return { statusCode: 400, body: "URL ausente" };
  }

  try {
    const response = await fetch(decodeURIComponent(targetUrl));
    const data = await response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-mpegurl",
        "Access-Control-Allow-Origin": "*",
      },
      body: data,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
