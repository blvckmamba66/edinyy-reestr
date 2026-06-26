<?php
require_once __DIR__ . '/../includes/helpers.php';
bootstrap();
require_admin();

// Запрос одной записи по id
if (isset($_GET['id'])) {
    $stmt = db()->prepare('SELECT ' . USER_COLUMNS . ' FROM users WHERE id = ?');
    $stmt->execute([(int) $_GET['id']]);
    $user = $stmt->fetch();
    if (!$user) {
        json_out(['error' => 'Пользователь не найден'], 404);
    }
    json_out(with_custom_fields($user));
}

// Список (с поиском)
$search = trim($_GET['search'] ?? '');
if ($search !== '') {
    $like = '%' . $search . '%';
    $sql = 'SELECT ' . USER_COLUMNS . ' FROM users
            WHERE first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?
               OR birth_place LIKE ? OR citizenship LIKE ? OR address LIKE ? OR specialty LIKE ?
            ORDER BY created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute([$like, $like, $like, $like, $like, $like, $like]);
} else {
    $stmt = db()->query('SELECT ' . USER_COLUMNS . ' FROM users ORDER BY created_at DESC');
}
$rows = array_map('with_custom_fields', $stmt->fetchAll());
json_out($rows);
