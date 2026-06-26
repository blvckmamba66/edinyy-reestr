<?php
require_once __DIR__ . '/../includes/helpers.php';
ensure_session();
unset($_SESSION['is_admin']);
json_out(['ok' => true]);
