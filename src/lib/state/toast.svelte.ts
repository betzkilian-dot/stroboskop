let timer: ReturnType<typeof setTimeout> | undefined;

export const toast = $state({
  message: null as string | null,
  show(text: string, ms = 2500) {
    clearTimeout(timer);
    toast.message = text;
    timer = setTimeout(() => (toast.message = null), ms);
  },
});
