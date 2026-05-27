// Operator-facing English errors (network/config), per project precedent.
interface GreenApiCreds {
  idInstance: string
  tokenInstance: string
  apiUrl: string
}

export async function sendText(
  creds: GreenApiCreds,
  chatId: string,
  message: string,
): Promise<string> {
  const url = `${creds.apiUrl}/waInstance${creds.idInstance}/sendMessage/${creds.tokenInstance}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  })
  if (!res.ok) {
    throw new Error(`Green API send failed: ${res.status}`)
  }
  const json = (await res.json()) as { idMessage?: string }
  return json.idMessage ?? ''
}
