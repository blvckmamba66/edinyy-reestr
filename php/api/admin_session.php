<?php
require_once __DIR__ . '/../includes/helpers.php';
ensure_session();
json_out(['isAdmin' => !empty($_SESSION['is_admin'])]);
