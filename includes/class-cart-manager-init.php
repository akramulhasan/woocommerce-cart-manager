<?php
defined('ABSPATH') || exit;

class Cart_Manager_Init
{
    public function __construct()
    {
        require_once WC_CART_MANAGER_PATH . 'includes/class-cart-upsells.php';

        // Initialize functionality.
        new Cart_Upsells();
    }
}
