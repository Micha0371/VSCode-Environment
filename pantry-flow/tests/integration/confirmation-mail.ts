import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { localUrl } from './local-stack';

export const callback = 'pantryflowtest://auth/callback';
const mailpitUrl = new URL(localUrl);
mailpitUrl.port = '54324';
const mailpit = mailpitUrl.origin;
type Message = { ID: string; To: { Address: string }[] };
export async function messages(): Promise<Message[]> {
  const response = await fetch(`${mailpit}/api/v1/messages`, { signal: AbortSignal.timeout(10000) });
  assert.ok(response.ok);
  return (await response.json()).messages;
}
export async function confirmationLink(email: string, previous: Set<string>) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const message = (await messages()).find(m => !previous.has(m.ID) && m.To.some(to => to.Address === email));
    if (message) {
      const response = await fetch(`${mailpit}/api/v1/message/${encodeURIComponent(message.ID)}`, { signal: AbortSignal.timeout(10000) });
      assert.ok(response.ok);
      const content = await response.json();
      for (const match of content.HTML.matchAll(/href=["']([^"']+)["']/gu)) {
        const url = new URL(match[1].replaceAll('&amp;', '&'));
        if (url.origin === localUrl && url.pathname === '/auth/v1/verify') return url.toString();
      }
      throw new Error('Local confirmation email has no expected verification link');
    }
    await delay(200);
  }
  throw new Error('Local confirmation email did not arrive');
}
export async function openVerification(link: string) {
  const url = new URL(link);
  assert.equal(url.origin, localUrl);
  assert.equal(url.pathname, '/auth/v1/verify');
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 303);
  const target = new URL(response.headers.get('location')!);
  assert.equal(target.protocol, 'pantryflowtest:');
  assert.equal(target.hostname, 'auth');
  assert.equal(target.pathname, '/callback');
  return target;
}
