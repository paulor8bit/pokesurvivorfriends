const game = document.getElementById('game');
const loading = document.getElementById('loading');
const copy = document.getElementById('copy-site');
const retry = document.getElementById('retry');
let currentUrl = '';
function render(state) {
  if (!state) return;
  document.getElementById('status').textContent = state.message;
  document.getElementById('connection').className = 'connection ' + state.phase;
  copy.disabled = !state.publicUrl;
  retry.hidden = !['offline', 'error'].includes(state.phase);
  retry.disabled = false;
  if (state.localUrl && currentUrl !== state.localUrl) {
    currentUrl = state.localUrl; game.src = state.localUrl; game.hidden = false; loading.hidden = true;
  }
}
window.desktop.onState(render);
window.desktop.getState().then(render);
retry.onclick = async () => { retry.disabled = true; await window.desktop.retry(); };
copy.onclick = async () => {
  if (await window.desktop.copySite()) {
    copy.textContent = 'Site copiado'; setTimeout(() => { copy.textContent = 'Copiar site'; }, 1800);
  }
};
