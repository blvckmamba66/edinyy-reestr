<?php
require_once __DIR__ . '/../includes/helpers.php';
bootstrap();

$b = read_json_body();
$fn   = trim($b['first_name']  ?? '');
$ln   = trim($b['last_name']   ?? '');
$bp   = trim($b['birth_place'] ?? '');
$cit  = trim($b['citizenship'] ?? '');
$addr = trim($b['address']     ?? '');
$spec = trim($b['specialty']   ?? '');
$gender = $b['gender'] ?? '';
$consent = !empty($b['consent']);
$code = $b['code'] ?? '';

if ($fn === '' || $ln === '' || $bp === '' || $cit === '' || $addr === '' || $spec === '') {
    json_out(['error' => 'Заполните все обязательные поля'], 400);
}
if ($gender !== 'М' && $gender !== 'Ж') {
    json_out(['error' => 'Укажите пол (М или Ж)'], 400);
}
$phone = normalize_phone($b['phone'] ?? null);
if (!$phone) {
    json_out(['error' => 'Некорректный номер телефона'], 400);
}
if (!$consent) {
    json_out(['error' => 'Необходимо согласие на обработку персональных данных'], 400);
}

$stmt = db()->prepare('SELECT id FROM users WHERE phone = ?');
$stmt->execute([$phone]);
if ($stmt->fetch()) {
    json_out(['error' => 'Пользователь с таким номером уже зарегистрирован'], 409);
}

// Проверка кода подтверждения
if (!verify_otp($phone, $code)) {
    json_out(['error' => 'Неверный или просроченный код подтверждения'], 400);
}

$now = date('Y-m-d H:i:s');
$stmt = db()->prepare(
    'INSERT INTO users (first_name, last_name, gender, birth_place, citizenship, address, specialty, phone, consent, admin_comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, "", ?, ?)'
);
$stmt->execute([$fn, $ln, $gender, $bp, $cit, $addr, $spec, $phone, $now, $now]);
$id = (int) db()->lastInsertId();

db()->prepare('DELETE FROM otp_codes WHERE phone = ?')->execute([$phone]);

$_SESSION['user_id'] = $id;
json_out(['ok' => true, 'id' => $id]);


// Проверяет код. true — верный (помечает verified), иначе false.
function verify_otp($phone, $code)
{
    $stmt = db()->prepare('SELECT * FROM otp_codes WHERE phone = ?');
    $stmt->execute([$phone]);
    $row = $stmt->fetch();
    if (!$row) return false;
    if ((int) (microtime(true) * 1000) > (int) $row['expires_at']) return false;
    if ((int) $row['attempts'] >= 5) return false;
    if (trim((string)$code) !== $row['code']) {
        db()->prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?')->execute([$phone]);
        return false;
    }
    db()->prepare('UPDATE otp_codes SET verified = 1 WHERE phone = ?')->execute([$phone]);
    return true;
}
