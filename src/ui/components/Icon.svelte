<script module lang="ts">
  export type IconName =
    | 'video' | 'strobe' | 'ruler' | 'pin' | 'chart' | 'share' | 'camera' | 'folder'
    | 'play' | 'pause' | 'step-back' | 'step-forward' | 'rotate' | 'crop' | 'more'
    | 'check' | 'close' | 'warning' | 'plus' | 'chevron';

  const PATHS: Record<IconName, string> = {
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    strobe: '<rect x="3" y="5" width="4" height="14" rx="1"/><rect x="10" y="5" width="4" height="14" rx="1"/><rect x="17" y="5" width="4" height="14" rx="1"/>',
    ruler: '<rect x="2" y="8" width="20" height="8" rx="1.5"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
    pin: '<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 15l3-4 3 2 5-6"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    'step-back': '<path d="M6 5v14"/><path d="M19 5l-10 7 10 7z"/>',
    'step-forward': '<path d="M18 5v14"/><path d="M5 5l10 7-10 7z"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    warning: '<path d="M12 3L2 20h20z"/><path d="M12 10v5M12 17.5v.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>'
  };
</script>

<script lang="ts">
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
  aria-hidden="true"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  {@html PATHS[name]}
</svg>

<style>
  svg {
    flex: none;
  }
</style>
