export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    let hasReloadedForUpdate = false;
    const shouldReloadOnControllerChange = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!shouldReloadOnControllerChange || hasReloadedForUpdate) {
        return;
      }
      hasReloadedForUpdate = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        void registration.update();
      })
      .catch((error: unknown) => {
        console.warn("Service worker registration failed.", error);
      });
  });
}
