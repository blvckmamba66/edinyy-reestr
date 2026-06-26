<?php
require_once __DIR__ . '/../includes/helpers.php';
bootstrap();
require_admin();

$b = read_json_body();
$id = (int) ($b['id'] ?? 0);
$stmt = db()->prepare('DELETE FROM users WHERE id = ?');
$stmt->execute([$id]);
if ($stmt->rowCount() === 0) {
    json_out(['error' => 'Пользователь не найден'], 404);
}
json_out(['ok' => true]);
