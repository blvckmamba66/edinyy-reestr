<?php
require_once __DIR__ . '/config.php';

// Включён ли демо-режим (нет ключа SMS.ru)
function sms_is_demo()
{
    return SMSRU_API_ID === '';
}

// Отправляет SMS. Возвращает ['ok'=>bool, 'demo'=>bool, 'error'=>?string].
function send_sms($phone, $text)
{
    if (sms_is_demo()) {
        error_log("[SMS-ДЕМО] $phone: $text");
        return ['ok' => true, 'demo' => true];
    }

    $to = str_replace('+', '', $phone);
    $params = [
        'api_id' => SMSRU_API_ID,
        'to'     => $to,
        'msg'    => $text,
        'json'   => '1',
    ];
    if (SMSRU_FROM !== '') {
        $params['from'] = SMSRU_FROM;
    }
    $url = 'https://sms.ru/sms/send?' . http_build_query($params);

    $body = sms_http_get($url);
    if ($body === false) {
        return ['ok' => false, 'demo' => false, 'error' => 'Не удалось связаться с SMS-сервисом'];
    }

    $data = json_decode($body, true);
    error_log('[SMS.ru] ответ: ' . $body);

    if (!is_array($data)) {
        return ['ok' => false, 'demo' => false, 'error' => 'Некорректный ответ SMS-сервиса'];
    }

    // Ошибка на верхнем уровне (ключ, баланс, аккаунт)
    if (($data['status'] ?? '') !== 'OK') {
        $code = $data['status_code'] ?? '?';
        $txt  = $data['status_text'] ?? 'ошибка';
        return ['ok' => false, 'demo' => false, 'error' => "SMS.ru: $txt (код $code)"];
    }

    // Статус по конкретному номеру
    if (isset($data['sms'][$to]) && ($data['sms'][$to]['status'] ?? '') !== 'OK') {
        $code = $data['sms'][$to]['status_code'] ?? '?';
        $txt  = $data['sms'][$to]['status_text'] ?? 'сообщение отклонено';
        return ['ok' => false, 'demo' => false, 'error' => "SMS.ru (номер $to): $txt (код $code)"];
    }

    return ['ok' => true, 'demo' => false];
}

// HTTP GET через cURL или file_get_contents (что доступно на хостинге)
function sms_http_get($url)
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $res = curl_exec($ch);
        curl_close($ch);
        return $res;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 15]]);
    return @file_get_contents($url, false, $ctx);
}
