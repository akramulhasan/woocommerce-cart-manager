<?php

/**
 * Fired during plugin activation
 *
 * @package WooCommerceCartManager
 */

defined('ABSPATH') || exit;

class Cart_Manager_Activator
{

    /**
     * Runs during plugin activation
     */
    public static function activate()
    {
        self::migrate_rules();
    }

    /**
     * Migrate existing rules to new format
     */
    private static function migrate_rules()
    {
        $rules = get_option('wc_cart_manager_rules', array());
        $updated_rules = array();

        foreach ($rules as $rule) {
            if (isset($rule['type']) && $rule['type'] === 'minimum_spend') {
                // Convert old minimum spend rule to new format
                $updated_rules[] = array(
                    'id' => $rule['id'],
                    'name' => $rule['name'],
                    'type' => 'cart_based',
                    'trigger' => array(
                        'type' => 'cart_total',
                        'value' => floatval($rule['amount'])
                    ),
                    'discount' => array(
                        'type' => 'percentage',
                        'value' => floatval($rule['discount'])
                    ),
                    'message' => $rule['message']
                );
            } else if (isset($rule['type']) && $rule['type'] === 'cart_based') {
                // Already in new format
                $updated_rules[] = $rule;
            }
        }

        update_option('wc_cart_manager_rules', $updated_rules);
    }
}
