export default async (req) => {
  const url = new URL(req.url);
  const lon = url.searchParams.get("lon");
  const lat = url.searchParams.get("lat");
  const product = url.searchParams.get("product") || "astro";
  const output = url.searchParams.get("output") || "json";

  const apiUrl = `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=${product}&output=${output}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = { path: "/api/weather" };