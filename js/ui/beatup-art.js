/* Native tiles, Pokémon props and pixel-built street scenery. */
G.BeatupArt = (() => {
  const floors = new Map();
  function draw(ctx, s) {
    const R = G.BeatupRules, W = R.WIDTH, H = R.HEIGHT, cam = s.camera || 0;
    const skies = ['#17384b', '#121c39', '#3a1c31'], light = ['#95efe4', '#a6b9ff', '#ffb97d'][s.round];
    ctx.fillStyle = skies[s.round]; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#bddfe0'; ctx.fillRect(880, 65, 38, 38);
    for (let i = 0; i < 12; i++) {
      const x = i * 190 - (cam * 0.28 % 190) - 100, height = 90 + i % 4 * 22;
      ctx.fillStyle = i % 2 ? '#243344' : '#2d4252'; ctx.fillRect(x, 225 - height, 170, height);
      ctx.fillStyle = '#4c6470'; ctx.fillRect(x - 4, 222 - height, 178, 7);
      ctx.fillStyle = light;
      for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) if ((row + col + i) % 3) ctx.fillRect(x + 17 + col * 37, 238 - height + row * 23, 14, 10);
      ctx.fillStyle = '#0d1a2b'; ctx.fillRect(x + 65, 190, 33, 35);
    }
    let floor = floors.get(s.round);
    if (!floor) { floor = G.Tiles.paintChunk(0, 0, 16, () => 'floor', () => 0.4, s.round % G.Tiles.NORMAL, 8932); floors.set(s.round, floor); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 230, W, 390); ctx.clip();
    for (let x = -cam % 512 - 512; x < W; x += 512) ctx.drawImage(floor, x, 230, 512, 512);
    ctx.fillStyle = '#263844cf'; ctx.fillRect(0, 275, W, 315);
    ctx.fillStyle = '#9ba59b'; ctx.fillRect(0, 230, W, 10); ctx.fillRect(0, 604, W, 13);
    ctx.fillStyle = '#d6bc6a';
    for (let x = -cam % 180; x < W; x += 180) ctx.fillRect(x, 440, 65, 5);
    ctx.restore();
    for (let x = -cam % 510; x < W; x += 510) {
      ctx.fillStyle = '#5d7882'; ctx.fillRect(x + 35, 140, 6, 95); ctx.fillRect(x + 35, 140, 45, 5);
      ctx.fillStyle = light; ctx.fillRect(x + 67, 145, 18, 8);
      const prop = G.Tiles.propSprite(s.round % G.Tiles.NORMAL, s.round === 1 ? 'rock' : 'tree');
      ctx.drawImage(prop, x + 125, 241 - prop.height * 2, prop.width * 2, prop.height * 2);
    }
    ctx.save(); ctx.translate(-cam, 0);
    for (const b of s.props) {
      const img = G.Tiles.propSprite(s.round % G.Tiles.NORMAL, 'chest');
      ctx.globalAlpha = b.hp > 0 ? 1 : 0.2; ctx.drawImage(img, b.x - 22, b.y - 38, 44, 38);
    }
    ctx.restore();
    if (!s.fighting) {
      ctx.font = 'bold 29px Pixelify, sans-serif'; ctx.fillStyle = '#ffe28c'; ctx.textAlign = 'right';
      ctx.fillText('SIGA  →', W - 45, 208);
    }
  }
  return { draw };
})();
