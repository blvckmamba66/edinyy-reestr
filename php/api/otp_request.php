<?php
require_once __DIR__ . '/../includes/helpers.php';
require_once __DIR__ . '/../includes/sms.php';
bootstrap();

$body = read_json_body();
$phone = normalize_phone($body['phone'] ?? null);
if (!$phone) {
    json_out(['error' => 'Некорректный номер телефона'], 400);
}

$stmt = db()->prepare('SELECT id FROM users WHERE phone = ?');
$stmt->execute([$phone]);
if ($stmt->fetch()) {
    json_out(['error' => 'Пользователь с таким номером уже зарегистрирован'], 409);
}

$code = (string) random_int(100000, 999999);
$expires = (int) (microtime(true) * 1000) + 5 * 60 * 1000; // +5 минут (мс)

$stmt = db()->prepare(
    'INSERT INTO otp_codes (phone, code, expires_at, attempts, verified) VALUES (?, ?, ?, 0, 0)
     ON DUPLICATE KEY UPDATE code = VALUES(code), expires_at = VALUES(expires_at), attempts = 0, verified = 0'
);
$stmt->execute([$phone, $code, $expires]);

$res = send_sms($phone, "Код подтверждения регистрации: $code");
if (empty($res['ok'])) {
    json_out(['error' => $res['error'] ?? 'Не удалось отправить SMS'], 502);
}

$out = ['ok' => true, 'demo' => !empty($res['demo'])];
if (!empty($res['demo'])) {
    $out['code'] = $code; // в демо-режиме показываем код на экране
}
json_out($out);
