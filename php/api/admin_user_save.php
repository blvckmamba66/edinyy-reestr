<?php
require_once __DIR__ . '/../includes/helpers.php';
bootstrap();
require_admin();

$b = read_json_body();
$id = (int) ($b['id'] ?? 0);

$stmt = db()->prepare('SELECT id FROM users WHERE id = ?');
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    json_out(['error' => 'Пользователь не найден'], 404);
}

$fn   = trim($b['first_name']  ?? '');
$ln   = trim($b['last_name']   ?? '');
$bp   = trim($b['birth_place'] ?? '');
$cit  = trim($b['citizenship'] ?? '');
$addr = trim($b['address']     ?? '');
$spec = trim($b['specialty']   ?? '');
$gender = $b['gender'] ?? '';
$comment = trim($b['admin_comment'] ?? '');

if ($fn === '' || $ln === '' || $bp === '' || $cit === '') {
    json_out(['error' => 'Заполните все обязательные поля'], 400);
}
if ($gender !== 'М' && $gender !== 'Ж') {
    json_out(['error' => 'Укажите пол (М или Ж)'], 400);
}
$phone = normalize_phone($b['phone'] ?? null);
if (!$phone) {
    json_out(['error' => 'Некорректный номер телефона'], 400);
}
$stmt = db()->prepare('SELECT id FROM users WHERE phone = ? AND id <> ?');
$stmt->execute([$phone, $id]);
if ($stmt->fetch()) {
    json_out(['error' => 'Другой пользователь уже использует этот номер'], 409);
}

$now = date('Y-m-d H:i:s');
$stmt = db()->prepare(
    'UPDATE users SET first_name=?, last_name=?, gender=?, birth_place=?, citizenship=?, address=?, specialty=?, phone=?, admin_comment=?, updated_at=? WHERE id=?'
);
$stmt->execute([$fn, $ln, $gender, $bp, $cit, $addr, $spec, $phone, $comment, $now, $id]);

// Пересохраняем произвольные поля
if (isset($b['custom_fields']) && is_array($b['custom_fields'])) {
    db()->prepare('DELETE FROM user_fields WHERE user_id = ?')->execute([$id]);
    $ins = db()->prepare('INSERT INTO user_fields (user_id, field_name, field_value) VALUES (?, ?, ?)');
    foreach ($b['custom_fields'] as $f) {
        $name = trim($f['field_name'] ?? '');
        $value = trim((string)($f['field_value'] ?? ''));
        if ($name !== '') {
            $ins->execute([$id, $name, $value]);
        }
    }
}

$stmt = db()->prepare('SELECT ' . USER_COLUMNS . ' FROM users WHERE id = ?');
$stmt->execute([$id]);
json_out(with_custom_fields($stmt->fetch()));
