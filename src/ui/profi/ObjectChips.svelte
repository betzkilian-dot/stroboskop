<script lang="ts">
  import { MAX_OBJECTS, type TrackedObject } from '../../lib/measure/model';
  import Icon from '../components/Icon.svelte';

  let {
    objects,
    active,
    onselect,
    onadd,
    onrename,
    ondelete,
  }: {
    objects: TrackedObject[];
    active: number;
    onselect: (id: number) => void;
    onadd: () => void;
    onrename: (id: number, name: string) => void;
    ondelete: (id: number) => void;
  } = $props();

  let menu = $state<number | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;
  const menuObj = $derived(objects.find((o) => o.id === menu) ?? null);

  function down(id: number) {
    longPressed = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      longPressed = true;
      menu = id;
    }, 550);
  }
  function stop() {
    clearTimeout(timer);
  }
  function click(id: number) {
    if (longPressed) {
      longPressed = false;
      return;
    }
    onselect(id);
  }
</script>

<div class="chips" role="group" aria-label="Objekte">
  {#each objects as o (o.id)}
    <button
      type="button"
      class="chip"
      class:on={o.id === active}
      aria-pressed={o.id === active}
      data-testid="object-chip"
      onclick={() => click(o.id)}
      ondblclick={() => (menu = o.id)}
      onpointerdown={() => down(o.id)}
      onpointerup={stop}
      onpointerleave={stop}
      onpointercancel={stop}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <span class="dot" style:background={o.color}></span>{o.name}
    </button>
  {/each}
  <button
    type="button"
    class="chip add"
    aria-label="Objekt hinzufügen"
    disabled={objects.length >= MAX_OBJECTS}
    onclick={onadd}><Icon name="plus" size={18} /></button
  >
</div>

{#if menuObj}
  <div class="menu" data-testid="object-menu">
    <label class="name"
      >Name
      <input
        type="text"
        autocomplete="off"
        value={menuObj.name}
        oninput={(e) => onrename(menuObj.id, e.currentTarget.value)}
      />
    </label>
    <div class="row">
      <button
        type="button"
        disabled={objects.length <= 1}
        onclick={() => {
          ondelete(menuObj.id);
          menu = null;
        }}>Objekt löschen</button
      >
      <button type="button" onclick={() => (menu = null)}>Fertig</button>
    </div>
  </div>
{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    min-width: 44px;
    padding: 0 12px;
    border: 2px solid transparent;
    border-radius: 22px;
    justify-content: center;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .chip.on {
    border-color: var(--acc);
    background: var(--acc-soft);
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .menu {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .name {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .name input {
    min-height: 44px;
    font-size: 1rem;
    padding: 0 12px;
    box-sizing: border-box;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row button {
    flex: 1;
    min-height: 44px;
  }
</style>
