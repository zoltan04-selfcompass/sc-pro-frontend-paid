export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Ellenőrizzük, hogy a kérés a /stream vagy /start útvonalra megy-e
    if (url.pathname === '/stream' || url.pathname === '/start') {
      // Ha igen, továbbítjuk a kérést a Service Bindingon keresztül a worker-hez
      return env.worker.fetch(request);
    }
    // Ha nem, akkor a Pages statikus tartalmát szolgáljuk ki
    return env.ASSETS.fetch(request);
  }
}
