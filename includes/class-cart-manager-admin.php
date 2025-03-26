<?php

/**
 * Admin functionality
 *
 * @package WooCommerceCartManager
 */

defined('ABSPATH') || exit;

class Cart_Manager_Admin
{
    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
    }

    /**
     * Add admin menu
     */
    public function add_admin_menu()
    {
        add_submenu_page(
            'woocommerce',
            __('Cart Manager', 'wc-cart-manager'),
            __('Cart Manager', 'wc-cart-manager'),
            'manage_woocommerce',
            'wc-cart-manager',
            array($this, 'render_admin_page')
        );
    }

    /**
     * Enqueue admin scripts
     *
     * @param string $hook Current admin page hook.
     */
    public function enqueue_admin_scripts($hook)
    {
        if ('woocommerce_page_wc-cart-manager' !== $hook) {
            return;
        }

        // Enqueue WordPress components
        wp_enqueue_script('wp-components');
        wp_enqueue_script('wp-element');
        wp_enqueue_script('wp-i18n');
        wp_enqueue_style('wp-components');

        // Enqueue our React app
        wp_enqueue_script(
            'wc-cart-manager-admin',
            WC_CART_MANAGER_URL . 'admin/build/index.js',
            array('wp-element', 'wp-components', 'wp-i18n'),
            filemtime(WC_CART_MANAGER_PATH . 'admin/build/index.js'),
            true
        );

        // Add initial data if needed
        wp_localize_script(
            'wc-cart-manager-admin',
            'wcCartManagerAdmin',
            array(
                'apiNonce' => wp_create_nonce('wp_rest'),
                'apiUrl' => rest_url('wc-cart-manager/v1'),
            )
        );
    }

    /**
     * Render admin page
     */
    public function render_admin_page()
    {
?>
        <div id="wc-cart-manager-admin"></div>
<?php
    }
}
