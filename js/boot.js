/* ============ boot.js — lo primero que corre (antes estaba dentro del HTML) ============
 * Fuera del HTML para que la política de seguridad (CSP, en dev.html) pueda
 * prohibir todo el código metido en la página: así, aunque algún día se
 * colara texto con código en algo que se pinta, el navegador no lo ejecuta.
 *   - El idioma de la pantalla de carga, antes de que cargue el juego.
 */
(function () {
  var s = null; try { s = localStorage.getItem('ps.lang'); } catch (e) {}
  var n = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').toLowerCase();
  var l = ['es', 'en', 'pt'].indexOf(s) >= 0 ? s : (n.indexOf('es') === 0 ? 'es' : n.indexOf('pt') === 0 ? 'pt' : 'en');
  document.documentElement.lang = l;
  if (l === 'en') {
    var p = document.querySelectorAll('#boot p');
    p[0].textContent = 'A Pokémon survival game, free in your browser and on mobile.';
    p[1].textContent = 'Loading…';
  }
  if (l === 'pt') {
    var p = document.querySelectorAll('#boot p');
    p[0].textContent = 'Sobreviva com seu Pokémon, sozinho ou com amigos.';
    p[1].textContent = 'Carregando…';
  }
})();
