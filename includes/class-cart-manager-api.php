<?php

/**
 * API functionality
 *
 * @package WooCommerceCartManager
 */

defined('ABSPATH') || exit;

/**
 * Cart Manager API Class
 *
 * @since 1.0.0
 */
class Cart_Manager_API
{
    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('rest_api_init', array($this, 'register_routes'));
    }

    /**
     * Register REST API routes
     *
     * @since 1.0.0
     * @return void
     */
    public function register_routes()
    {
        $version = '1';
        $namespace = 'wc-cart-manager/v' . $version;

        register_rest_route($namespace, '/rules', array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => array($this, 'get_rules'),
                'permission_callback' => array($this, 'check_admin_permission'),
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => array($this, 'create_rule'),
                'permission_callback' => array($this, 'check_admin_permission'),
                'args'                => $this->get_rule_schema(),
            ),
        ));

        register_rest_route($namespace, '/rules/(?P<id>[\d]+)', array(
            array(
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => array($this, 'update_rule'),
                'permission_callback' => array($this, 'check_admin_permission'),
                'args'                => $this->get_rule_schema(),
            ),
            array(
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => array($this, 'delete_rule'),
                'permission_callback' => array($this, 'check_admin_permission'),
            ),
        ));

        register_rest_route($namespace, '/products', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_products'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));

        register_rest_route($namespace, '/categories', array(
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => array($this, 'get_categories'),
            'permission_callback' => array($this, 'check_admin_permission'),
        ));
    }

    /**
     * Check if user has permission
     *
     * @since 1.0.0
     * @return bool
     */
    public function check_admin_permission()
    {
        // First check if user has the required capability
        if (!current_user_can('manage_woocommerce')) {
            return false;
        }

        // For GET requests, we don't need to verify nonce
        if ('GET' === $_SERVER['REQUEST_METHOD']) {
            return true;
        }

        // For other methods (POST, PUT, DELETE), verify the nonce
        $nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? $_SERVER['HTTP_X_WP_NONCE'] : '';
        if (empty($nonce)) {
            return false;
        }

        // Verify the nonce
        $result = wp_verify_nonce($nonce, 'wp_rest');
        return false !== $result;
    }

    /**
     * Get rule schema
     *
     * @since 1.0.0
     * @return array
     */
    private function get_rule_schema()
    {
        return array(
            'name' => array(
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'type' => array(
                'type'              => 'string',
                'required'          => false,
                'enum'              => array('cart_based'),
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'trigger' => array(
                'type'       => 'object',
                'required'   => false,
                'properties' => array(
                    'type' => array(
                        'type'              => 'string',
                        'required'          => false,
                        'enum'              => array('cart_total', 'item_quantity'),
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'value' => array(
                        'type'              => 'number',
                        'required'          => false,
                        'sanitize_callback' => array($this, 'sanitize_float'),
                    ),
                    'products' => array(
                        'type'  => 'array',
                        'items' => array(
                            'type'              => 'string',
                            'sanitize_callback' => 'sanitize_text_field',
                        ),
                    ),
                    'categories' => array(
                        'type'  => 'array',
                        'items' => array(
                            'type'              => 'string',
                            'sanitize_callback' => 'sanitize_text_field',
                        ),
                    ),
                ),
            ),
            'discount' => array(
                'type'       => 'object',
                'required'   => false,
                'properties' => array(
                    'type' => array(
                        'type'              => 'string',
                        'required'          => false,
                        'enum'              => array('percentage', 'fixed'),
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                    'value' => array(
                        'type'              => 'number',
                        'required'          => false,
                        'sanitize_callback' => array($this, 'sanitize_float'),
                    ),
                ),
            ),
            'message' => array(
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'wp_kses_post',
            ),
            'status' => array(
                'type'              => 'string',
                'required'          => false,
                'enum'              => array('enabled', 'disabled'),
                'default'           => 'enabled',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }

    /**
     * Sanitize float value
     *
     * @since 1.0.0
     * @param mixed $value Value to sanitize.
     * @return float
     */
    public function sanitize_float($value)
    {
        return filter_var($value, FILTER_SANITIZE_NUMBER_FLOAT, FILTER_FLAG_ALLOW_FRACTION);
    }

    /**
     * Validate rule data
     *
     * @since 1.0.0
     * @param array $new_rule New rule data.
     * @param array $existing_rules Existing rules.
     * @param int   $exclude_rule_id Rule ID to exclude from validation.
     * @return true|WP_Error
     */
    private function validate_rule($new_rule, $existing_rules, $exclude_rule_id = null)
    {
        if (
            !isset($new_rule['type']) || 'cart_based' !== $new_rule['type'] ||
            !isset($new_rule['trigger']) || !isset($new_rule['discount'])
        ) {
            return new WP_Error(
                'invalid_rule_format',
                esc_html__('Invalid rule format. Missing required fields.', 'wc-cart-manager'),
                array('status' => 400)
            );
        }

        $trigger = $new_rule['trigger'];
        $discount = $new_rule['discount'];

        if (
            !isset($trigger['type']) || !isset($trigger['value']) ||
            !isset($discount['type']) || !isset($discount['value'])
        ) {
            return new WP_Error(
                'invalid_rule_format',
                esc_html__('Invalid rule format. Missing trigger or discount details.', 'wc-cart-manager'),
                array('status' => 400)
            );
        }

        // Validate numeric values
        if (!is_numeric($trigger['value']) || !is_numeric($discount['value'])) {
            return new WP_Error(
                'invalid_values',
                esc_html__('Invalid numeric values provided.', 'wc-cart-manager'),
                array('status' => 400)
            );
        }

        // Check for conflicting rules
        foreach ($existing_rules as $rule) {
            if ($exclude_rule_id && isset($rule['id']) && $rule['id'] === $exclude_rule_id) {
                continue;
            }

            if ($rule['trigger']['type'] === $trigger['type']) {
                if (
                    'cart_total' === $trigger['type'] &&
                    abs(floatval($rule['trigger']['value']) - floatval($trigger['value'])) < 0.01
                ) {
                    return new WP_Error(
                        'conflicting_rule',
                        esc_html__('A rule with the same cart total trigger already exists.', 'wc-cart-manager'),
                        array('status' => 400)
                    );
                }

                if (
                    'item_quantity' === $trigger['type'] &&
                    abs(floatval($rule['trigger']['value']) - floatval($trigger['value'])) < 0.01
                ) {
                    $rule_products = isset($rule['trigger']['products']) ? $rule['trigger']['products'] : array();
                    $rule_categories = isset($rule['trigger']['categories']) ? $rule['trigger']['categories'] : array();
                    $new_products = isset($trigger['products']) ? $trigger['products'] : array();
                    $new_categories = isset($trigger['categories']) ? $trigger['categories'] : array();

                    $rule_applies_all = empty($rule_products) && empty($rule_categories);
                    $new_applies_all = empty($new_products) && empty($new_categories);

                    if ($rule_applies_all && $new_applies_all) {
                        return new WP_Error(
                            'conflicting_rule',
                            esc_html__('A rule with the same quantity trigger for all products already exists.', 'wc-cart-manager'),
                            array('status' => 400)
                        );
                    }

                    $products_overlap = !empty(array_intersect($rule_products, $new_products));
                    $categories_overlap = !empty(array_intersect($rule_categories, $new_categories));

                    if ($products_overlap || $categories_overlap) {
                        return new WP_Error(
                            'conflicting_rule',
                            esc_html__('A rule with overlapping products or categories already exists for the same quantity.', 'wc-cart-manager'),
                            array('status' => 400)
                        );
                    }
                }
            }
        }

        return true;
    }

    /**
     * Get all rules
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_rules()
    {
        $rules = get_option('wc_cart_manager_rules', array());
        return rest_ensure_response($rules);
    }

    /**
     * Create a new rule
     *
     * @since 1.0.0
     * @param WP_REST_Request $request Request object.
     * @return WP_REST_Response|WP_Error
     */
    public function create_rule($request)
    {
        $rules = get_option('wc_cart_manager_rules', array());
        $new_rule = $this->sanitize_rule($request->get_params());

        // Validate the new rule
        $validation_result = $this->validate_rule($new_rule, $rules);
        if (is_wp_error($validation_result)) {
            return $validation_result;
        }

        $new_rule['id'] = time();
        $rules[] = $new_rule;

        if (!update_option('wc_cart_manager_rules', $rules)) {
            return new WP_Error(
                'rule_not_created',
                esc_html__('Failed to create rule.', 'wc-cart-manager'),
                array('status' => 500)
            );
        }

        return rest_ensure_response($new_rule);
    }

    /**
     * Update an existing rule
     *
     * @since 1.0.0
     * @param WP_REST_Request $request Request object.
     * @return WP_REST_Response|WP_Error
     */
    public function update_rule($request)
    {
        try {
            $rules = get_option('wc_cart_manager_rules', array());
            $rule_id = (int) $request->get_param('id');
            $params = $request->get_params();

            // Remove 'id' from params as it's not part of the rule data
            unset($params['id']);

            // If only status is being updated
            if (count($params) === 1 && isset($params['status'])) {
                $rule_updated = false;
                $updated_rule = null;

                foreach ($rules as $key => $rule) {
                    if ($rule['id'] === $rule_id) {
                        $rules[$key]['status'] = sanitize_text_field($params['status']);
                        $updated_rule = $rules[$key];
                        $rule_updated = true;
                        break;
                    }
                }

                if (!$rule_updated) {
                    return new WP_Error(
                        'rule_not_found',
                        esc_html__('Rule not found.', 'wc-cart-manager'),
                        array('status' => 404)
                    );
                }

                if (!update_option('wc_cart_manager_rules', $rules)) {
                    return new WP_Error(
                        'rule_not_updated',
                        esc_html__('Failed to update rule.', 'wc-cart-manager'),
                        array('status' => 500)
                    );
                }

                return rest_ensure_response($updated_rule);
            }

            // For full rule updates
            $updated_rule = $this->sanitize_rule($params);
            $validation_result = $this->validate_rule($updated_rule, $rules, $rule_id);

            if (is_wp_error($validation_result)) {
                return $validation_result;
            }

            $rule_updated = false;
            foreach ($rules as $key => $rule) {
                if ($rule['id'] === $rule_id) {
                    // Preserve the rule ID and merge the updates
                    $rules[$key] = array_merge($rule, $updated_rule);
                    $updated_rule = $rules[$key];
                    $rule_updated = true;
                    break;
                }
            }

            if (!$rule_updated) {
                return new WP_Error(
                    'rule_not_found',
                    esc_html__('Rule not found.', 'wc-cart-manager'),
                    array('status' => 404)
                );
            }

            if (!update_option('wc_cart_manager_rules', $rules)) {
                return new WP_Error(
                    'rule_not_updated',
                    esc_html__('Failed to update rule.', 'wc-cart-manager'),
                    array('status' => 500)
                );
            }

            return rest_ensure_response($updated_rule);
        } catch (Exception $e) {
            error_log('Cart Manager API Error: ' . $e->getMessage());
            return new WP_Error(
                'update_error',
                esc_html__('An error occurred while updating the rule.', 'wc-cart-manager'),
                array('status' => 500)
            );
        }
    }

    /**
     * Delete a rule
     *
     * @since 1.0.0
     * @param WP_REST_Request $request Request object.
     * @return WP_REST_Response|WP_Error
     */
    public function delete_rule($request)
    {
        $rules = get_option('wc_cart_manager_rules', array());
        $rule_id = (int) $request->get_param('id');
        $rule_found = false;

        foreach ($rules as $key => $rule) {
            if ($rule['id'] === $rule_id) {
                array_splice($rules, $key, 1);
                $rule_found = true;
                break;
            }
        }

        if (!$rule_found) {
            return new WP_Error(
                'rule_not_found',
                esc_html__('Rule not found.', 'wc-cart-manager'),
                array('status' => 404)
            );
        }

        if (!update_option('wc_cart_manager_rules', $rules)) {
            return new WP_Error(
                'rule_not_deleted',
                esc_html__('Failed to delete rule.', 'wc-cart-manager'),
                array('status' => 500)
            );
        }

        return rest_ensure_response(true);
    }

    /**
     * Get products
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_products()
    {
        $args = array(
            'status' => 'publish',
            'limit'  => -1,
        );

        $products = wc_get_products($args);
        $formatted_products = array();

        foreach ($products as $product) {
            if (!$product instanceof WC_Product) {
                continue;
            }

            $formatted_products[] = array(
                'id'   => absint($product->get_id()),
                'name' => wp_kses_post($product->get_name()),
                'sku'  => sanitize_text_field($product->get_sku()),
            );
        }

        return rest_ensure_response($formatted_products);
    }

    /**
     * Get categories
     *
     * @since 1.0.0
     * @return WP_REST_Response
     */
    public function get_categories()
    {
        $args = array(
            'taxonomy'   => 'product_cat',
            'hide_empty' => false,
        );

        $categories = get_terms($args);
        $formatted_categories = array();

        if (!is_wp_error($categories)) {
            foreach ($categories as $category) {
                $formatted_categories[] = array(
                    'id'   => absint($category->term_id),
                    'name' => sanitize_text_field($category->name),
                    'slug' => sanitize_key($category->slug),
                );
            }
        }

        return rest_ensure_response($formatted_categories);
    }

    /**
     * Sanitize rule data
     *
     * @since 1.0.0
     * @param array $rule Rule data to sanitize.
     * @return array
     */
    private function sanitize_rule($rule)
    {
        $sanitized = array();

        if (isset($rule['name'])) {
            $sanitized['name'] = sanitize_text_field($rule['name']);
        }

        if (isset($rule['type'])) {
            $sanitized['type'] = sanitize_text_field($rule['type']);
        }

        if (isset($rule['trigger'])) {
            $sanitized['trigger'] = array();
            if (isset($rule['trigger']['type'])) {
                $sanitized['trigger']['type'] = sanitize_text_field($rule['trigger']['type']);
            }
            if (isset($rule['trigger']['value'])) {
                $sanitized['trigger']['value'] = $this->sanitize_float($rule['trigger']['value']);
            }
            if (isset($rule['trigger']['products'])) {
                $sanitized['trigger']['products'] = array_map('sanitize_text_field', $rule['trigger']['products']);
            }
            if (isset($rule['trigger']['categories'])) {
                $sanitized['trigger']['categories'] = array_map('sanitize_text_field', $rule['trigger']['categories']);
            }
        }

        if (isset($rule['discount'])) {
            $sanitized['discount'] = array();
            if (isset($rule['discount']['type'])) {
                $sanitized['discount']['type'] = sanitize_text_field($rule['discount']['type']);
            }
            if (isset($rule['discount']['value'])) {
                $sanitized['discount']['value'] = $this->sanitize_float($rule['discount']['value']);
            }
        }

        if (isset($rule['message'])) {
            $sanitized['message'] = wp_kses_post($rule['message']);
        }

        if (isset($rule['status'])) {
            $sanitized['status'] = sanitize_text_field($rule['status']);
        }

        return $sanitized;
    }
}

// Initialize API Class
new Cart_Manager_API();
