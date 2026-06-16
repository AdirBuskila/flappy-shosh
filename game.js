/* Flappy Shosh — a Flappy Bird clone starring Nataf's head.
 * Vanilla HTML5 Canvas, no dependencies. Logical resolution: 288x512. */
(() => {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const W = 288;
  const H = 512;
  const BASE_H = 112;          // base.png height
  const GROUND_Y = H - BASE_H; // top of the ground strip (playfield bottom)

  const GRAVITY = 0.42;        // downward accel per frame (60fps reference)
  const FLAP = -7.2;           // upward impulse on flap
  const MAX_FALL = 11;         // terminal velocity

  const BIRD_X = 64;           // bird's fixed horizontal position
  const BIRD_W = 42;           // drawn width of the head (height derived from photo)

  const PIPE_W = 52;           // pipe-green/red.png width
  const PIPE_GAP = 118;        // vertical gap the head must fly through
  const PIPE_SPACING = 150;    // horizontal distance between pipe pairs
  const PIPE_SPEED = 2.1;      // world scroll speed (px/frame)
  const PIPE_MARGIN = 50;      // min distance of gap from top / ground

  const BEST_KEY = "flappy-shosh-best";

  // ---------------------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; // smooth for the photo head; sprites still look fine
  const loadingEl = document.getElementById("loading");

  // ---------------------------------------------------------------------------
  // Asset loading
  // ---------------------------------------------------------------------------
  const IMAGE_SRC = {
    bgDay: "assets/sprites/background-day.png",
    bgNight: "assets/sprites/background-night.png",
    base: "assets/sprites/base.png",
    pipeGreen: "assets/sprites/pipe-green.png",
    pipeRed: "assets/sprites/pipe-red.png",
    message: "assets/sprites/message.png",
    gameover: "assets/sprites/gameover.png",
    nataf: "assets/nataf.png",
    n0: "assets/sprites/0.png",
    n1: "assets/sprites/1.png",
    n2: "assets/sprites/2.png",
    n3: "assets/sprites/3.png",
    n4: "assets/sprites/4.png",
    n5: "assets/sprites/5.png",
    n6: "assets/sprites/6.png",
    n7: "assets/sprites/7.png",
    n8: "assets/sprites/8.png",
    n9: "assets/sprites/9.png",
  };

  const AUDIO_SRC = {
    shosh: "assets/shosh.ogg",
    point: "assets/audio/point.ogg",
    hit: "assets/audio/hit.ogg",
    die: "assets/audio/die.ogg",
    swoosh: "assets/audio/swoosh.ogg",
  };

  const images = {};
  const audioBuffers = {}; // template <audio> elements, cloned on play

  function loadImages() {
    const entries = Object.entries(IMAGE_SRC);
    return Promise.all(
      entries.map(
        ([key, src]) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load " + src));
            img.src = src;
            images[key] = img;
          })
      )
    );
  }

  function loadAudio() {
    for (const [key, src] of Object.entries(AUDIO_SRC)) {
      const a = new Audio();
      a.src = src;
      a.preload = "auto";
      audioBuffers[key] = a;
    }
  }

  // Numbers indexed 0-9 for easy digit lookup.
  let numbers = [];

  // ---------------------------------------------------------------------------
  // Audio playback (clone so rapid/overlapping sounds retrigger cleanly)
  // ---------------------------------------------------------------------------
  function play(name, volume = 1) {
    const tpl = audioBuffers[name];
    if (!tpl) return;
    try {
      const node = tpl.cloneNode();
      node.volume = volume;
      node.play().catch(() => {}); // ignore autoplay rejections
    } catch (e) {
      /* no-op */
    }
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  const STATE = { READY: "ready", PLAY: "play", OVER: "over" };
  let state = STATE.READY;

  let best = 0;
  try {
    best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {
    best = 0;
  }

  const bird = {
    y: H * 0.45,
    vel: 0,
    w: BIRD_W,
    h: BIRD_W, // recomputed from the photo's aspect ratio once loaded
    rot: 0,
  };

  let pipes = [];
  let score = 0;
  let groundX = 0;
  let bgKey = "bgDay";
  let pipeKey = "pipeGreen";
  let overAt = 0;      // timestamp the game ended (gates restart)
  let flashAlpha = 0;  // white flash on crash
  let frame = 0;       // running frame counter for idle animation

  function resetBirdSize() {
    const img = images.nataf;
    if (img && img.naturalWidth) {
      bird.w = BIRD_W;
      bird.h = BIRD_W * (img.naturalHeight / img.naturalWidth);
    }
  }

  function reset() {
    state = STATE.READY;
    bird.y = H * 0.45;
    bird.vel = 0;
    bird.rot = 0;
    pipes = [];
    score = 0;
    flashAlpha = 0;
    bgKey = Math.random() < 0.5 ? "bgDay" : "bgNight";
    pipeKey = Math.random() < 0.5 ? "pipeGreen" : "pipeRed";
  }

  function startPlay() {
    state = STATE.PLAY;
    spawnPipe(W + 30);
    spawnPipe(W + 30 + PIPE_SPACING);
  }

  function spawnPipe(x) {
    const minGapY = PIPE_MARGIN + PIPE_GAP / 2;
    const maxGapY = GROUND_Y - PIPE_MARGIN - PIPE_GAP / 2;
    const gapCenter = minGapY + Math.random() * (maxGapY - minGapY);
    pipes.push({ x, gapY: gapCenter, scored: false });
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function flap() {
    bird.vel = FLAP;
    play("shosh");
  }

  function onInput() {
    if (state === STATE.READY) {
      startPlay();
      flap();
    } else if (state === STATE.PLAY) {
      flap();
    } else if (state === STATE.OVER) {
      // small delay so the death tap doesn't instantly restart
      if (performance.now() - overAt > 450) {
        play("swoosh", 0.6);
        reset();
      }
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      onInput();
    }
  });
  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    onInput();
  });
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      onInput();
    },
    { passive: false }
  );

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function gameOver() {
    state = STATE.OVER;
    overAt = performance.now();
    flashAlpha = 0.85;
    play("hit");
    setTimeout(() => play("die"), 220);
    if (score > best) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (e) {
        /* ignore */
      }
    }
  }

  // Forgiving hitbox: shrink the head box since corners are transparent.
  function birdBox() {
    const hw = bird.w * 0.66;
    const hh = bird.h * 0.62;
    return {
      left: BIRD_X - hw / 2,
      right: BIRD_X + hw / 2,
      top: bird.y - hh / 2,
      bottom: bird.y + hh / 2,
    };
  }

  function update(f) {
    frame++;

    // Ground scrolls while not on the game-over screen.
    if (state !== STATE.OVER) {
      groundX = (groundX - PIPE_SPEED * f) % images.base.naturalWidth;
    }

    if (state === STATE.READY) {
      // gentle idle bob
      bird.y = H * 0.45 + Math.sin(frame / 12) * 6;
      bird.rot = Math.sin(frame / 12) * 0.08;
      return;
    }

    if (state === STATE.PLAY) {
      bird.vel = Math.min(bird.vel + GRAVITY * f, MAX_FALL);
      bird.y += bird.vel * f;

      // rotation from velocity: nose up when rising, dive when falling
      const t = (bird.vel + 8) / 19; // ~0 (rising) .. 1 (max fall)
      bird.rot = -0.45 + Math.max(0, Math.min(1, t)) * (1.6 + 0.45);

      // move + recycle pipes, spawn new ones at fixed spacing
      for (const p of pipes) p.x -= PIPE_SPEED * f;
      const last = pipes[pipes.length - 1];
      if (last && last.x <= W - PIPE_SPACING) spawnPipe(last.x + PIPE_SPACING);
      if (pipes.length && pipes[0].x < -PIPE_W) pipes.shift();

      // scoring
      for (const p of pipes) {
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
          p.scored = true;
          score++;
          play("point", 0.8);
        }
      }

      // collisions
      const box = birdBox();
      if (box.bottom >= GROUND_Y) {
        bird.y = GROUND_Y - (bird.h * 0.62) / 2;
        gameOver();
        return;
      }
      if (box.top <= 0) {
        bird.y = (bird.h * 0.62) / 2;
        bird.vel = 0;
      }
      for (const p of pipes) {
        const inX = box.right > p.x && box.left < p.x + PIPE_W;
        if (!inX) continue;
        const gapTop = p.gapY - PIPE_GAP / 2;
        const gapBottom = p.gapY + PIPE_GAP / 2;
        if (box.top < gapTop || box.bottom > gapBottom) {
          gameOver();
          return;
        }
      }
      return;
    }

    if (state === STATE.OVER) {
      // let the head drop onto the ground after dying
      if (birdBox().bottom < GROUND_Y) {
        bird.vel = Math.min(bird.vel + GRAVITY * f, MAX_FALL);
        bird.y += bird.vel * f;
        bird.rot = Math.min(bird.rot + 0.12 * f, 1.6);
      } else {
        bird.y = GROUND_Y - (bird.h * 0.62) / 2;
      }
      if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.06 * f);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function drawBackground() {
    ctx.drawImage(images[bgKey], 0, 0, W, H);
  }

  function drawPipes() {
    const pipeImg = images[pipeKey];
    const ph = pipeImg.naturalHeight;
    for (const p of pipes) {
      const gapTop = p.gapY - PIPE_GAP / 2;
      const gapBottom = p.gapY + PIPE_GAP / 2;
      // top pipe (flipped vertically), bottom of sprite aligned to gapTop
      ctx.save();
      ctx.translate(p.x, gapTop);
      ctx.scale(1, -1);
      ctx.drawImage(pipeImg, 0, 0, PIPE_W, ph);
      ctx.restore();
      // bottom pipe
      ctx.drawImage(pipeImg, p.x, gapBottom, PIPE_W, ph);
    }
  }

  function drawGround() {
    const baseImg = images.base;
    const bw = baseImg.naturalWidth;
    for (let x = groundX; x < W; x += bw) {
      ctx.drawImage(baseImg, x, GROUND_Y, bw, BASE_H);
    }
  }

  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rot);
    ctx.drawImage(images.nataf, -bird.w / 2, -bird.h / 2, bird.w, bird.h);
    ctx.restore();
  }

  // Draw a number using the digit sprites, centered horizontally on cx.
  function drawNumber(value, cx, topY, scale = 1) {
    const digits = String(value).split("");
    let total = 0;
    for (const d of digits) total += numbers[+d].naturalWidth * scale + 1 * scale;
    total -= 1 * scale;
    let x = cx - total / 2;
    for (const d of digits) {
      const img = numbers[+d];
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, x, topY, w, h);
      x += w + 1 * scale;
    }
  }

  function drawTitle() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 30px 'Segoe UI', system-ui, sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.fillStyle = "#ffffff";
    ctx.strokeText("FLAPPY SHOSH", W / 2, 90);
    ctx.fillText("FLAPPY SHOSH", W / 2, 90);
    ctx.restore();
  }

  function drawReady() {
    drawTitle();

    // "Get Ready!" subtitle
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 22px 'Segoe UI', system-ui, sans-serif";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.fillStyle = "#ffe24d";
    ctx.strokeText("Get Ready!", W / 2, 132);
    ctx.fillText("Get Ready!", W / 2, 132);

    // tap-to-start hint with a bobbing arrow above the head
    const ay = 300 + Math.sin(frame / 9) * 5;
    ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif";
    ctx.lineWidth = 4;
    ctx.fillStyle = "#fff";
    ctx.strokeText("tap to Shosh", W / 2, 360);
    ctx.fillText("tap to Shosh", W / 2, 360);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.moveTo(W / 2, ay - 14);
    ctx.lineTo(W / 2 - 9, ay);
    ctx.lineTo(W / 2 + 9, ay);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Medal: colored ring with Nataf's head clipped inside, by score tier.
  function medalTier(s) {
    if (s >= 40) return { ring: "#e5e4e2", rim: "#b7c6cf", name: "platinum" };
    if (s >= 30) return { ring: "#ffd34d", rim: "#caa024", name: "gold" };
    if (s >= 20) return { ring: "#d6d6d6", rim: "#9aa0a6", name: "silver" };
    if (s >= 10) return { ring: "#cd7f32", rim: "#9c5e22", name: "bronze" };
    return null;
  }

  function drawMedal(cx, cy, r) {
    const tier = medalTier(score);
    if (!tier) return;
    ctx.save();
    // outer rim + face
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = tier.rim;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = tier.ring;
    ctx.fill();
    // clipped head
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.clip();
    const img = images.nataf;
    const ar = img.naturalHeight / img.naturalWidth;
    const dw = (r - 6) * 2;
    const dh = dw * ar;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2 - 2, dw, dh);
    ctx.restore();
    // glossy highlight
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.55, Math.PI, Math.PI * 1.5);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawGameOver() {
    const go = images.gameover;
    const gw = 192, gh = (go.naturalHeight / go.naturalWidth) * gw;
    ctx.drawImage(go, (W - gw) / 2, 96, gw, gh);

    // scoreboard panel
    const px = 44, py = 150, pw = W - px * 2, ph = 118;
    ctx.save();
    roundRect(px, py, pw, ph, 12);
    ctx.fillStyle = "rgba(222, 216, 149, 0.96)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(90, 80, 40, 0.8)";
    ctx.stroke();
    ctx.restore();

    // medal on the left
    drawMedal(px + 34, py + ph / 2, 26);

    // labels + scores on the right
    ctx.save();
    ctx.textAlign = "right";
    ctx.fillStyle = "#7a5a18";
    ctx.font = "700 13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillText("SCORE", px + pw - 16, py + 26);
    ctx.fillText("BEST", px + pw - 16, py + 78);
    ctx.restore();

    drawNumber(score, px + pw - 40, py + 30, 0.62);
    drawNumber(best, px + pw - 40, py + 82, 0.62);

    // restart hint (blinking)
    if (Math.floor(frame / 24) % 2 === 0) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "700 14px 'Segoe UI', system-ui, sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.fillStyle = "#fff";
      ctx.strokeText("tap to play again", W / 2, py + ph + 34);
      ctx.fillText("tap to play again", W / 2, py + ph + 34);
      ctx.restore();
    }
  }

  function render() {
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();

    if (state === STATE.PLAY) {
      drawNumber(score, W / 2, 40, 1);
    } else if (state === STATE.READY) {
      drawReady();
    } else if (state === STATE.OVER) {
      drawNumber(score, W / 2, 40, 1);
      drawGameOver();
    }

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------------------
  // Main loop (delta-normalized to 60fps)
  // ---------------------------------------------------------------------------
  let lastTime = 0;
  function loop(now) {
    if (!lastTime) lastTime = now;
    let f = (now - lastTime) / (1000 / 60);
    lastTime = now;
    if (f > 3) f = 3; // clamp big gaps (tab switches)
    update(f);
    render();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  loadAudio();
  loadImages()
    .then(() => {
      numbers = [
        images.n0, images.n1, images.n2, images.n3, images.n4,
        images.n5, images.n6, images.n7, images.n8, images.n9,
      ];
      resetBirdSize();
      reset();
      loadingEl.classList.add("hidden");
      requestAnimationFrame(loop);
    })
    .catch((err) => {
      loadingEl.textContent = "Failed to load assets :(";
      console.error(err);
    });
})();
