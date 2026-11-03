<script lang="ts">
  import { mediaToPlayerTime, playerToMediaTime } from '../../lib/frames';
  import Icon from './Icon.svelte';

  let {
    src,
    rotation = 0,
    mediaDurationS,
    currentTimeS = $bindable(0),
    playing = $bindable(false),
    rate = 1,
    seekOffsetS = 0,
  }: {
    src: string;
    /** zusaetzliche Drehung durch den Nutzer (die Container-Drehung wendet der Browser selbst an) */
    rotation?: 0 | 90 | 180 | 270;
    /** Dauer laut Demux; <video>.duration kann (Zeitlupe) gestreckt sein */
    mediaDurationS: number;
    /** Medienzeit in Sekunden */
    currentTimeS?: number;
    playing?: boolean;
    rate?: number;
    /** Beim externen Springen wird das Element um diesen Versatz hinter die Zielzeit gesetzt,
     *  damit der Browser sicher das Bild an der Zielzeit zeigt; currentTimeS bleibt die Zielzeit. */
    seekOffsetS?: number;
  } = $props();

  let box: HTMLDivElement;
  let video: HTMLVideoElement;
  let cw = $state(0);
  let ch = $state(0);
  let vw = $state(0);
  let vh = $state(0);
  /** zuletzt mit dem Element abgeglichene Medienzeit (nicht reaktiv: verhindert Rueckkopplung) */
  let synced = NaN;
  let raf = 0;

  const toMedia = (p: number) => playerToMediaTime(p, video.duration, mediaDurationS);
  const toPlayer = (m: number) => mediaToPlayerTime(m, video.duration, mediaDurationS);

  $effect(() => {
    const ro = new ResizeObserver(() => {
      cw = box.clientWidth;
      ch = box.clientHeight;
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  });

  /** Elementgroesse so, dass das (gedrehte) Bild in den Kasten passt */
  const size = $derived.by(() => {
    if (!vw || !vh || !cw || !ch) return null;
    const swap = rotation === 90 || rotation === 270;
    const s = swap ? Math.min(cw / vh, ch / vw) : Math.min(cw / vw, ch / vh);
    return { w: vw * s, h: vh * s };
  });

  function report() {
    const t = toMedia(video.currentTime);
    if (!Number.isFinite(t)) return;
    synced = t;
    currentTimeS = t;
  }
  function loop() {
    report();
    if (!video.paused) raf = requestAnimationFrame(loop);
  }

  // externe Zeit (Spulen, Einzelbild) -> Element
  $effect(() => {
    const t = currentTimeS;
    void mediaDurationS;
    if (!video || t === synced || !Number.isFinite(t)) return;
    synced = t;
    video.currentTime = Math.max(0, toPlayer(t + seekOffsetS));
  });

  $effect(() => {
    const want = playing;
    if (!video) return;
    if (want && video.paused) {
      video.play().catch(() => (playing = false));
    } else if (!want && !video.paused) {
      video.pause();
    }
  });

  $effect(() => {
    if (video) {
      video.playbackRate = rate;
      video.defaultPlaybackRate = rate;
    }
  });

  // neue Quelle: Zustand zuruecksetzen
  $effect(() => {
    void src;
    synced = NaN;
    vw = 0;
    vh = 0;
  });

  function onmeta() {
    vw = video.videoWidth;
    vh = video.videoHeight;
    video.muted = true;
    video.playbackRate = rate;
    // erst jetzt ist video.duration bekannt: gewuenschte Zeit neu umrechnen
    if (Number.isFinite(currentTimeS) && currentTimeS > 0) video.currentTime = toPlayer(currentTimeS + seekOffsetS);
    synced = currentTimeS;
  }
  function onplay() {
    playing = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function onpause() {
    playing = false;
    cancelAnimationFrame(raf);
    report();
  }
  function toggle() {
    playing = !playing;
  }
  function key(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div
  class="player"
  bind:this={box}
  data-testid="player"
  data-time={currentTimeS}
  role="button"
  tabindex="0"
  aria-label={playing ? 'Video anhalten' : 'Video abspielen'}
  onclick={toggle}
  onkeydown={key}
>
  <video
    bind:this={video}
    {src}
    playsinline
    muted
    preload="auto"
    style:width={size ? `${size.w}px` : '100%'}
    style:height={size ? `${size.h}px` : '100%'}
    style:transform={`translate(-50%, -50%) rotate(${rotation}deg)`}
    onloadedmetadata={onmeta}
    onplay={onplay}
    onpause={onpause}
    onended={onpause}
  ></video>
  {#if !playing}
    <span class="play" data-testid="play-overlay"><Icon name="play" size={26} /></span>
  {/if}
</div>

<style>
  .player {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    cursor: pointer;
    outline: none;
  }
  .player:focus-visible {
    box-shadow: inset 0 0 0 3px var(--acc);
  }
  video {
    position: absolute;
    left: 50%;
    top: 50%;
    object-fit: contain;
    display: block;
  }
  .play {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 60px;
    height: 60px;
    margin: -30px 0 0 -30px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .play :global(svg) {
    fill: #fff;
    margin-left: 3px;
  }
</style>
