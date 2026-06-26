// Модуль отправки SMS.
// По умолчанию работает в ДЕМО-режиме: код не отправляется, а выводится в консоль
// и возвращается на экран регистрации.
// Чтобы включить реальную отправку через SMS.ru — задайте переменную окружения
// SMSRU_API_ID (получить бесплатно в личном кабинете https://sms.ru).

const SMSRU_API_ID = process.env.SMSRU_API_ID || '';
// Необязательно: одобренное имя отправителя. Если не задано — отправка с общего номера.
const SMSRU_FROM = process.env.SMSRU_FROM || '';

// Включён ли демо-режим (нет ключа реального провайдера)
export const SMS_DEMO = !SMSRU_API_ID;

/**
 * Отправляет SMS. Возвращает { ok, demo, error? }.
 */
export async function sendSms(phone, text) {
  if (SMS_DEMO) {
    console.log(`[SMS-ДЕМО] Сообщение на ${phone}: ${text}`);
    return { ok: true, demo: true };
  }

  const to = phone.replace('+', '');

  try {
    const url = new URL('https://sms.ru/sms/send');
    url.searchParams.set('api_id', SMSRU_API_ID);
    url.searchParams.set('to', to);
    url.searchParams.set('msg', text);
    url.searchParams.set('json', '1');
    if (SMSRU_FROM) url.searchParams.set('from', SMSRU_FROM);

    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();

    // Подробный лог ответа SMS.ru (виден в логах Render)
    console.log('[SMS.ru] ответ:', JSON.stringify(data));

    // 1) Ошибка на верхнем уровне (аккаунт, ключ, баланс и т.п.)
    if (data.status !== 'OK') {
      return {
        ok: false,
        demo: false,
        error: `SMS.ru: ${data.status_text || 'ошибка'} (код ${data.status_code ?? '?'})`
      };
    }

    // 2) Статус по конкретному номеру (может быть отказ, даже если сверху OK)
    const entry = data.sms && data.sms[to];
    if (entry && entry.status !== 'OK') {
      return {
        ok: false,
        demo: false,
        error: `SMS.ru (номер ${to}): ${entry.status_text || 'сообщение отклонено'} (код ${entry.status_code ?? '?'})`
      };
    }

    return { ok: true, demo: false };
  } catch (e) {
    console.error('[SMS.ru] исключение:', e);
    return { ok: false, demo: false, error: 'Не удалось связаться с SMS-сервисом' };
  }
}
