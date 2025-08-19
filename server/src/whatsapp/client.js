import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';

let waClient;
let isReady = false;
let readyResolve;
const readyPromise = new Promise((res) => (readyResolve = res));

export function initWhatsApp() {
  if (waClient) return waClient;

  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: 'codinovo' }),
    puppeteer: {
      headless: true,
      executablePath: execPath && execPath.length ? execPath : undefined,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'],
      timeout: 60000,
    },
  });

  waClient.on('qr', (qr) => {
    console.log('Scan this QR to login WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  waClient.on('ready', () => {
    isReady = true;
    console.log('WhatsApp client ready');
    if (readyResolve) readyResolve(true);
  });


  waClient.on('auth_failure', (msg) => console.error('WA auth failure:', msg));
  waClient.on('disconnected', (reason) => {
    console.warn('WA disconnected:', reason);
    isReady = false;
  });

  waClient.initialize().catch((e) => console.error('WA initialize error:', e));
  return waClient;
}

export async function waitWhatsAppReady() {
  if (isReady) return true;
  return readyPromise;
}

function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }

/**
 * Sends a WA message after resolving a valid WhatsApp JID.
 * Throws codes: 'invalid_phone', 'not_registered_on_whatsapp', 'send_failed'
 */
export async function sendWaMessage(phone, text) {
  await waitWhatsAppReady();

  const digits = digitsOnly(phone);
  if (!digits || digits.length < 9) {
    const e = new Error('invalid_phone'); e.code = 'invalid_phone'; throw e;
  }

  try {
    const numberId = await waClient.getNumberId(digits);
    if (!numberId) {
      const e = new Error('not_registered_on_whatsapp'); e.code = 'not_registered_on_whatsapp'; throw e;
    }

    const jid = numberId._serialized; // "2010xxxxxxx@c.us"
    const res = await waClient.sendMessage(jid, text);
    return res;
  } catch (err) {
    console.error('sendWaMessage error:', { code: err?.code, message: err?.message });
    const e = new Error(err?.code || 'send_failed'); e.code = err?.code || 'send_failed'; e.cause = err; throw e;
  }
}