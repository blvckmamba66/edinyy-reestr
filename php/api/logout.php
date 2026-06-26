<?php
require_once __DIR__ . '/../includes/helpers.php';
ensure_session();
unset($_SESSION['user_id']);
json_out(['ok' => true]);
