<?php
require_once __DIR__ . '/../includes/helpers.php';
ensure_session();

$b = read_json_body();
if (($b['login'] ?? '') === ADMIN_LOGIN && ($b['password'] ?? '') === ADMIN_PASSWORD) {
    $_SESSION['is_admin'] = true;
    json_out(['ok' => true]);
}
json_out(['error' => 'Неверный логин или пароль'], 401);
