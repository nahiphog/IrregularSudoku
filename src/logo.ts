/** Play the supplied Lottie artwork; retain the static fallback until ready. */
export async function mountAnimatedLogo(container: HTMLElement, base: string) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches) return;
  try {
    const { default: lottie } = await import('lottie-web');
    const animation = lottie.loadAnimation({
      container, renderer: 'svg', loop: true, autoplay: true,
      path: `${base}irregular-logo.json`,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
    });
    const sync = () => {
      container.parentElement?.classList.toggle('is-playing', !motion.matches);
      if (motion.matches) animation.pause(); else animation.play();
    };
    animation.addEventListener('DOMLoaded', sync);
    animation.addEventListener('data_failed', () => container.parentElement?.classList.remove('is-playing'));
    motion.addEventListener('change', sync);
  } catch { /* The static logo remains visible if the player cannot load. */ }
}
