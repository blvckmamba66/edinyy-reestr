// Модуль отправки SMS.
// По умолчанию работает в ДЕМО-режиме: код не отправляется, а выводится в консоль
// и возвращается на экран регистрации.
// Чтобы включить реальную отправку через SMS.ru — задайте переменную окружения
// SMSRU_API_ID (получить бесплатно в личном кабинете https://sms.ru).

const SMSRU_API_ID = process.env.SMSRU_API_ID || '';

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

  try {
    const url = new URL('https://sms.ru/sms/send');
    url.searchParams.set('api_id', SMSRU_API_ID);
    url.searchParams.set('to', phone.replace('+', ''));
    url.searchParams.set('msg', text);
    url.searchParams.set('json', '1');

    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();

    if (data.status === 'OK') {
      return { ok: true, demo: false };
    }
    return { ok: false, demo: false, error: data.status_text || 'Ошибка отправки SMS' };
  } catch (e) {
    return { ok: false, demo: false, error: 'Не удалось связаться с SMS-сервисом' };
  }
}
