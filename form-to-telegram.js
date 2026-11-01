/**
 * Приём заявок с сайта и отправка в Telegram (Cloudflare Worker).
 *
 * Переменные окружения (Settings → Variables and Secrets):
 *   BOT_TOKEN       — токен Telegram-бота (тип Secret)
 *   CHAT_ID         — числовой id чата, куда приходят заявки
 *   ALLOWED_ORIGIN  — адрес сайта без слэша на конце, например https://alterbeltech.github.io
 *                     (можно несколько через запятую)
 */

const MAX_BODY_BYTES = 10_000;
const LIMITS = { name: 100, phone: 30, message: 1500, page: 80, form: 60 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGIN || '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
      });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    }
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });
    if (!originOk) return reply(403, { ok: false, error: 'forbidden_origin' });
    if (!env.BOT_TOKEN || !env.CHAT_ID) return reply(500, { ok: false, error: 'not_configured' });

    let raw;
    try {
      raw = await request.text();
    } catch {
      return reply(400, { ok: false, error: 'bad_request' });
    }
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return reply(413, { ok: false, error: 'too_large' });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply(400, { ok: false, error: 'bad_json' });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return reply(400, { ok: false, error: 'bad_json' });
    }

    const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const name = clean(data.name, LIMITS.name);
    const phone = clean(data.phone, LIMITS.phone);
    const message = clean(data.message, LIMITS.message);
    const page = clean(data.page, LIMITS.page);
    const form = clean(data.form, LIMITS.form);

    // ловушка для ботов: у людей поле пустое. Отвечаем «ок», ничего не отправляя
    if (clean(data.website, 50)) return reply(200, { ok: true });

    if (!name || !phone) return reply(400, { ok: false, error: 'missing_fields' });
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15 || !/^[0-9+()\-\s]+$/.test(phone)) {
      return reply(400, { ok: false, error: 'bad_phone' });
    }

    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = [
      '🏗 <b>Заявка с сайта</b>',
      form ? `Форма: ${esc(form)}` : null,
      page ? `Страница: ${esc(page)}` : null,
      `Имя: ${esc(name)}`,
      `Телефон: ${esc(phone)}`,
      message ? `Сообщение: ${esc(message)}` : null,
    ].filter(Boolean);

    let tg;
    try {
      tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.CHAT_ID,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
    } catch {
      return reply(502, { ok: false, error: 'telegram_unreachable' });
    }
    if (!tg.ok) return reply(502, { ok: false, error: 'telegram_error' });

    return reply(200, { ok: true });
  },
};
