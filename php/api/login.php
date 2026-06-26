<?php
require_once __DIR__ . '/../includes/helpers.php';
bootstrap();

$b = read_json_body();
$phone = normalize_phone($b['phone'] ?? null);
if (!$phone) {
    json_out(['error' => 'Некорректный номер телефона'], 400);
}
$stmt = db()->prepare('SELECT id FROM users WHERE phone = ?');
$stmt->execute([$phone]);
$user = $stmt->fetch();
if (!$user) {
    json_out(['error' => 'Пользователь не найден. Сначала зарегистрируйтесь.'], 404);
}
$_SESSION['user_id'] = (int) $user['id'];
json_out(['ok' => true]);
