export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server belum siap (${res.status}). Coba lagi sebentar atau hubungi panitia.`);
  }
  if (!res.ok)
    throw Object.assign(new Error(data.error || 'Koneksi gagal. Coba lagi.'), {
      code: data.code,
      status: res.status,
    });
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
