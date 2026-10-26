(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scenes = [...document.querySelectorAll('.scene')];
  const starts = []; let total = 0;
  scenes.forEach(scene => { starts.push(total); total += Number(scene.dataset.duration); });
  const beats = scenes.map(scene => [...scene.querySelectorAll('[data-in]')]);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let elapsed = 0, playing = false, ready = false, previousFrame = 0, current = -1;
  let soundOn = false, audio, audioGain, lastNote = -1;
  const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  $('seek').max = total;

  function render() {
    const ended = elapsed >= total;
    const index = ended ? scenes.length - 1 : starts.findLastIndex(start => elapsed >= start);
    const scene = scenes[index], time = elapsed - starts[index];
    document.body.classList.toggle('dark', scene.classList.contains('dark'));
    document.body.classList.toggle('ended', ended);
    document.body.classList.toggle('reduced', motion.matches);
    document.body.classList.toggle('is-paused', !playing);
    if (index !== current) {
      scenes.forEach((item, i) => { item.hidden = i !== index; item.inert = i !== index; });
      current = index;
      $('announcement').textContent = `第 ${index + 1} 段，共 ${scenes.length} 段。${scene.getAttribute('aria-label')}`;
    }
    scene.style.setProperty('--p', Math.min(1, time / Number(scene.dataset.duration)));
    beats[index].forEach(beat => {
      let visible = time >= Number(beat.dataset.in) && (!beat.dataset.out || time < Number(beat.dataset.out));
      if (motion.matches && beat.classList.contains('shot')) visible = beat.hasAttribute('data-still');
      if (motion.matches && beat.classList.contains('visitor')) visible = true;
      beat.classList.toggle('visible', visible);
    });
    $('reading-caption').textContent = scene.dataset.reading;
    $('time').textContent = `${clock(elapsed)} / ${clock(total)}`;
    $('segment').textContent = `${String(index + 1).padStart(2, '0')} / ${scenes.length}`;
    const percent = ended ? 100 : Math.min(99, Math.floor(elapsed / total * 100));
    $('percent').textContent = `${percent}%`;
    $('seek').value = elapsed;
    $('seek').setAttribute('aria-valuetext', `${percent}%，${clock(elapsed)}，共 ${clock(total)}`);
    $('play').textContent = playing ? '暂停' : ended ? '重播' : '播放';
    $('play').setAttribute('aria-label', playing ? '暂停播放' : ended ? '重播影片' : '继续播放');
    $('play').setAttribute('aria-pressed', String(playing));
    $('previous').disabled = index === 0 && elapsed === 0;
    $('next').disabled = ended;
    $('end-links').hidden = !ended;
  }

  function setPlaying(value) {
    playing = value && ready && elapsed < total;
    previousFrame = performance.now();
    if (audio) {
      if (playing && soundOn) audio.resume().catch(() => {});
      else audio.suspend().catch(() => {});
    }
    render();
  }
  function seek(value) {
    elapsed = Math.max(0, Math.min(total, value));
    previousFrame = performance.now(); lastNote = -1;
    if (elapsed === total) setPlaying(false);
    else render();
  }
  function replay() { seek(0); setPlaying(!motion.matches); }
  $('play').addEventListener('click', () => elapsed >= total ? replay() : setPlaying(!playing));
  $('previous').addEventListener('click', () => seek(starts[Math.max(0, current - 1)]));
  $('next').addEventListener('click', () => seek(current === scenes.length - 1 ? total : starts[current + 1]));
  $('skip').addEventListener('click', () => seek(total));
  $('replay').addEventListener('click', replay);
  $('seek').addEventListener('input', event => seek(Number(event.target.value)));
  document.addEventListener('keydown', event => {
    if (event.target.closest('input,button,a,dialog') || document.querySelector('dialog[open]')) return;
    if (event.code === 'Space') { event.preventDefault(); $('play').click(); }
    if (event.code === 'ArrowLeft') { event.preventDefault(); $('previous').click(); }
    if (event.code === 'ArrowRight') { event.preventDefault(); $('next').click(); }
    if (event.code === 'Escape') setPlaying(false);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPlaying(false); });
  motion.addEventListener('change', () => { if (motion.matches) setPlaying(false); render(); });

  // Only original, quiet pentatonic tones. No files, third-party music, or autoplay audio.
  $('sound').addEventListener('click', async () => {
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        audioGain = audio.createGain(); audioGain.gain.value = .09; audioGain.connect(audio.destination);
      }
      soundOn = !soundOn; lastNote = -1;
      $('sound').textContent = soundOn ? '声音：开' : '声音：关';
      $('sound').setAttribute('aria-pressed', String(soundOn));
      if (soundOn && playing) await audio.resume(); else await audio.suspend();
    } catch { $('sound').textContent = '声音暂不可用'; soundOn = false; }
  });
  function tone() {
    if (!audio || !soundOn || !playing || audio.state !== 'running') return;
    const step = Math.floor(elapsed / 5);
    if (step === lastNote) return;
    lastNote = step;
    // Leave actual silence around failure, the awkward old concept, and the long look back.
    if ([5, 6, 10].includes(current)) return;
    const notes = [220, 261.63, 293.66, 329.63, 392];
    [notes[step % notes.length], notes[(step + 2) % notes.length] / 2].forEach((frequency, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + i * .12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.24, start + .15);
      gain.gain.exponentialRampToValueAtTime(.001, start + 3.5);
      oscillator.connect(gain); gain.connect(audioGain); oscillator.start(start); oscillator.stop(start + 3.6);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }

  for (const id of ['about', 'explore']) {
    const dialog = $(id); let resumeAfterClose = false;
    $(`${id}-open`).addEventListener('click', () => {
      resumeAfterClose = playing; setPlaying(false); dialog.showModal();
    });
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    }});
    dialog.addEventListener('close', () => { if (resumeAfterClose && !document.hidden) setPlaying(true); });
  }
  function tick(now) {
    if (playing) {
      elapsed = Math.min(total, elapsed + Math.max(0, Math.min((now - previousFrame) / 1000, .25)));
      if (elapsed === total) setPlaying(false);
      render(); tone();
    }
    previousFrame = now;
    requestAnimationFrame(tick);
  }
  render(); requestAnimationFrame(tick);
  const images = [...document.images];
  Promise.all(images.map(image => image.decode().catch(() => false))).then(() => {
    const missing = images.filter(image => !image.naturalWidth);
    ready = true; $('play').disabled = false;
    if (missing.length) {
      $('loading').textContent = `${missing.length} 张画面未加载，请稍后重试。`;
      document.body.dataset.assetErrors = String(missing.length);
      render();
    } else {
      $('loading').hidden = true;
      if (motion.matches) $('announcement').textContent = '已减少动态效果，影片暂停。可以播放、拖动进度或逐段阅读。';
      setPlaying(!motion.matches && !document.hidden);
    }
    document.body.dataset.ready = 'true';
  });
})();
