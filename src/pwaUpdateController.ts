/** Callback registrado por PwaUpdateNotifier (useRegisterSW). */
let reloadFn: (() => Promise<void>) | null = null;

export function setPwaReloadHandler(fn: (() => Promise<void>) | null) {
  reloadFn = fn;
}

export async function runPwaReload(): Promise<void> {
  if (reloadFn) await reloadFn();
}
