// 홈 화면에 추가 + 오프라인: 서비스 워커를 등록하고, 지금까지 불러온 파일을 담아 두라고 알려 준다.

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  try {
    await navigator.serviceWorker.register('sw.js');
    const reg = await navigator.serviceWorker.ready;
    const page = location.href.split('#')[0];
    const loaded = performance.getEntriesByType('resource').map((e) => e.name);
    reg.active?.postMessage({ type: 'cache', urls: [page, ...loaded] });
  } catch {
    /* 지원하지 않거나 막힌 브라우저: 온라인에서만 */
  }
}
