<?php
require_once __DIR__ . '/../includes/helpers.php';
bootstrap();

if (empty($_SESSION['user_id'])) {
    json_out(['error' => 'Не выполнен вход'], 401);
}
$stmt = db()->prepare('SELECT ' . USER_COLUMNS . ' FROM users WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();
if (!$user) {
    json_out(['error' => 'Пользователь не найден'], 404);
}
$user['consent'] = (int) $user['consent'];
json_out($user);
