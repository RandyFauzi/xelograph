export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Koneksi gagal. Coba lagi.');
  return data;
}
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
