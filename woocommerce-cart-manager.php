<?php

/**
 * Plugin Name: WooCommerce Cart Manager
 * Plugin URI: https://example.com/woocommerce-cart-manager
 * Description: Advanced cart management and discount rules for WooCommerce
 * Version: 1.0.0
 * Requires at least: 5.8
 * Requires PHP: 8.0
 * Author: Your Name
 * Author URI: https://example.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wc-cart-manager
 * Domain Path: /languages
 *
 * @package WooCommerceCartManager
 */

// Exit if accessed directly.
defined('ABSPATH') || exit;

// Define plugin constants
define('WC_CART_MANAGER_VERSION', '1.0.0');
define('WC_CART_MANAGER_FILE', __FILE__);
define('WC_CART_MANAGER_PATH', plugin_dir_path(__FILE__));
define('WC_CART_MANAGER_URL', plugin_dir_url(__FILE__));

// Check if WooCommerce is active
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')), true)) {
    add_action('admin_notices', function () {
?>
        <div class="notice notice-error">
            <p><?php echo wp_kses_post(sprintf(
                    /* translators: %s: Plugin name */
                    __('<strong>%s</strong> requires WooCommerce to be installed and activated.', 'wc-cart-manager'),
                    'WooCommerce Cart Manager'
                )); ?></p>
        </div>
    <?php
    });
    return;
}

// Include core files.
require_once WC_CART_MANAGER_PATH . 'includes/class-cart-manager-init.php';
require_once WC_CART_MANAGER_PATH . 'includes/class-cart-manager-admin.php';
require_once WC_CART_MANAGER_PATH . 'includes/class-cart-manager-api.php';
require_once WC_CART_MANAGER_PATH . 'includes/class-cart-manager-frontend.php';
require_once WC_CART_MANAGER_PATH . 'includes/class-cart-manager-activator.php';

// Register activation hook
register_activation_hook(WC_CART_MANAGER_FILE, array('Cart_Manager_Activator', 'activate'));

// Hook to initialize the plugin.
add_action('plugins_loaded', 'wcm_initialize_plugin');

// Add plugin action links
add_filter('plugin_action_links_' . plugin_basename(WC_CART_MANAGER_FILE), 'wcm_add_action_links');

function wcm_add_action_links($links)
{
    $settings_link = '<a href="' . admin_url('admin.php?page=wc-cart-manager') . '">' . __('Settings', 'wc-cart-manager') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
}

function wcm_initialize_plugin()
{
    if (!class_exists('WooCommerce')) {
        add_action('admin_notices', 'wcm_woocommerce_missing_notice');
        return;
    }

    // Initialize plugin classes
    if (class_exists('Cart_Manager_Init')) {
        new Cart_Manager_Init();
    }

    if (class_exists('Cart_Manager_Admin')) {
        new Cart_Manager_Admin();
    }

    if (class_exists('Cart_Manager_API')) {
        new Cart_Manager_API();
    }

    if (class_exists('Cart_Manager_Frontend')) {
        new Cart_Manager_Frontend();
    }
}

// Display admin notice if WooCommerce is not installed
function wcm_woocommerce_missing_notice()
{
    ?>
    <div class="notice notice-error">
        <p><?php echo wp_kses_post(sprintf(
                /* translators: %s: Plugin name */
                __('<strong>%s</strong> requires WooCommerce to be installed and activated.', 'wc-cart-manager'),
                'WooCommerce Cart Manager'
            )); ?></p>
    </div>
<?php
}
