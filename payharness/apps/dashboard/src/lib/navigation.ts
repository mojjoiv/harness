export function navigateTopLevel(url: string): void {
  if (typeof document === 'undefined') return;

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_top';
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
