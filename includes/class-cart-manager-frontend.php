<?php

/**
 * Frontend functionality
 *
 * @package WooCommerceCartManager
 * @since 1.0.0
 */

defined('ABSPATH') || exit;

/**
 * Cart Manager Frontend Class
 *
 * @since 1.0.0
 */
class Cart_Manager_Frontend
{
    /**
     * Track if discount has been applied
     *
     * @var bool
     */
    private static $discount_applied = false;

    /**
     * Track if debug info has been shown
     *
     * @var bool
     */
    private static $debug_shown = false;

    /**
     * Store current discounts
     *
     * @var array
     */
    private static $current_discounts = array();

    /**
     * Store applied rule IDs
     *
     * @var array
     */
    private static $applied_rules = array();

    /**
     * Store running total for calculations
     *
     * @var float
     */
    private static $running_total = 0;

    private $is_calculating = false;

    /**
     * Constructor
     */
    public function __construct()
    {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));

        // AJAX handlers for cart updates
        add_action('wp_ajax_update_cart_messages', array($this, 'ajax_update_cart_messages'));
        add_action('wp_ajax_nopriv_update_cart_messages', array($this, 'ajax_update_cart_messages'));

        // Hook into cart update events
        add_action('woocommerce_before_calculate_totals', array($this, 'reset_discount_state'), 10);
        add_action('woocommerce_cart_calculate_fees', array($this, 'apply_cart_discounts'), 20);
    }

    /**
     * Enqueue scripts
     */
    public function enqueue_scripts()
    {
        if (!is_cart() && !is_checkout()) {
            return;
        }

        wp_enqueue_script(
            'wc-cart-manager-frontend',
            plugin_dir_url(WC_CART_MANAGER_FILE) . 'assets/js/frontend.js',
            array('jquery'),
            WC_CART_MANAGER_VERSION,
            true
        );

        wp_localize_script('wc-cart-manager-frontend', 'wcCartManager', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wc_cart_manager_nonce')
        ));
    }

    public function reset_discount_state()
    {
        self::$discount_applied = false;
        self::$current_discounts = array();
        self::$applied_rules = array();
        self::$running_total = 0;
    }

    public function ajax_update_cart_messages()
    {
        check_ajax_referer('wc_cart_manager_nonce', 'nonce');

        ob_start();
        $this->display_discount_messages();
        $messages = ob_get_clean();

        wp_send_json_success(array(
            'messages' => $messages,
            'has_discount' => self::$discount_applied
        ));
    }

    /**
     * Get applicable items and their totals for a rule
     */
    private function get_applicable_items($cart, $rule)
    {
        $applicable_items = array();
        $total_quantity = 0;
        $total_amount = 0;

        // Get selected products and categories from trigger
        $selected_products = !empty($rule['trigger']['products']) ? (array)$rule['trigger']['products'] : array();
        $selected_categories = !empty($rule['trigger']['categories']) ? (array)$rule['trigger']['categories'] : array();

        foreach ($cart->get_cart() as $cart_item_key => $cart_item) {
            $product = $cart_item['data'];
            if (!$product instanceof WC_Product) {
                continue;
            }

            $product_id = $product->get_id();
            $variation_id = $cart_item['variation_id'];
            $is_applicable = false;

            // For item quantity trigger with no specific products/categories, apply to all items
            if ($rule['trigger']['type'] === 'item_quantity' && empty($selected_products) && empty($selected_categories)) {
                $is_applicable = true;
            } else {
                // Check products first
                if (!empty($selected_products)) {
                    // Check if product ID or name matches
                    foreach ($selected_products as $selected_product) {
                        if (
                            // Match by ID
                            $product_id == $selected_product ||
                            ($variation_id && $variation_id == $selected_product) ||
                            // Match by name
                            strtolower($product->get_name()) === strtolower($selected_product)
                        ) {
                            $is_applicable = true;
                            break;
                        }
                    }
                }

                // If not found in products and categories are specified, check categories
                if (!$is_applicable && !empty($selected_categories)) {
                    $product_cats = wc_get_product_cat_ids($product_id);
                    foreach ($selected_categories as $category) {
                        // Try to match by category ID or name
                        if (
                            in_array($category, $product_cats) ||
                            $this->category_name_matches($product_cats, $category)
                        ) {
                            $is_applicable = true;
                            break;
                        }
                    }
                }
            }

            if ($is_applicable) {
                $line_total = $cart_item['line_total'];
                $quantity = $cart_item['quantity'];

                $applicable_items[$cart_item_key] = array(
                    'quantity' => $quantity,
                    'line_total' => $line_total,
                    'product_id' => $product_id,
                    'variation_id' => $variation_id
                );

                $total_quantity += $quantity;
                $total_amount += $line_total;
            }
        }

        return array(
            'items' => $applicable_items,
            'total_quantity' => $total_quantity,
            'total_amount' => $total_amount
        );
    }

    /**
     * Check if a category name matches any of the product's categories
     * 
     * @param array $product_cat_ids Array of product category IDs
     * @param string|int $category Category ID or name to check
     * @return bool Whether there's a match
     */
    private function category_name_matches($product_cat_ids, $category)
    {
        if (empty($product_cat_ids)) {
            return false;
        }

        // If category is numeric, we already checked by ID
        if (is_numeric($category)) {
            return false;
        }

        // Get all category names for the product
        $product_cat_names = array();
        foreach ($product_cat_ids as $cat_id) {
            $term = get_term($cat_id, 'product_cat');
            if ($term && !is_wp_error($term)) {
                $product_cat_names[] = strtolower($term->name);
            }
        }

        return in_array(strtolower($category), $product_cat_names);
    }

    /**
     * Get trigger type specific data
     * 
     * @param array $rule The rule to process
     * @return array Trigger type data
     */
    private function get_trigger_type_data($rule)
    {
        if (!isset($rule['trigger']['type'])) {
            return false;
        }

        return array(
            'type' => $rule['trigger']['type'],
            'value' => isset($rule['trigger']['value']) ? floatval($rule['trigger']['value']) : 0,
            'products' => isset($rule['trigger']['products']) ? array_map('absint', $rule['trigger']['products']) : array(),
            'categories' => isset($rule['trigger']['categories']) ? array_map('absint', $rule['trigger']['categories']) : array()
        );
    }

    /**
     * Get discount type data
     * 
     * @param array $rule The rule to process
     * @return array|bool Discount data or false if invalid
     */
    private function get_discount_data($rule)
    {
        if (!isset($rule['discount']['type'], $rule['discount']['value'])) {
            return false;
        }

        return array(
            'type' => $rule['discount']['type'],
            'value' => floatval($rule['discount']['value']),
            'label' => $rule['discount']['type'] === 'percentage' ?
                $rule['discount']['value'] . '%' :
                wc_price($rule['discount']['value'])
        );
    }

    /**
     * Check if item quantity trigger conditions are met
     * 
     * @param array $trigger_data Trigger type data
     * @param array $applicable_data Applicable items data
     * @return bool Whether conditions are met
     */
    private function is_item_quantity_condition_met($trigger_data, $applicable_data)
    {
        return $applicable_data['total_quantity'] >= $trigger_data['value'];
    }

    /**
     * Calculate item quantity discount amount
     * 
     * @param array $discount_data Discount configuration
     * @param float $total_amount Total amount to calculate discount from
     * @return float Calculated discount amount
     */
    private function calculate_item_quantity_discount($discount_data, $total_amount)
    {
        if ($discount_data['type'] === 'percentage') {
            return round($total_amount * ($discount_data['value'] / 100), 2);
        }
        return min($discount_data['value'], $total_amount);
    }

    /**
     * Create discount fee object
     * 
     * @param string $label Discount label
     * @param float $amount Discount amount
     * @param bool $is_selected_items Whether discount applies to selected items
     * @return object Fee object
     */
    private function create_discount_fee($label, $amount, $is_selected_items = false)
    {
        $label_parts = array($label);
        if ($is_selected_items) {
            $label_parts[] = '(Selected Items)';
        }

        return (object) array(
            'id' => uniqid('quantity_discount_'),
            'name' => implode(' ', $label_parts) . ' Discount',
            'amount' => -$amount,
            'tax_class' => '',
            'taxable' => false,
            'tax_data' => array(),
            'tax' => 0,
            'total' => -$amount
        );
    }

    /**
     * Get item quantity threshold message
     * 
     * @param array $trigger_data Trigger data
     * @param array $applicable_data Applicable items data
     * @param string $discount_label Discount label
     * @return string|bool Message or false if no message
     */
    private function get_item_quantity_message($trigger_data, $applicable_data, $discount_label)
    {
        $has_specific_items = !empty($trigger_data['products']) || !empty($trigger_data['categories']);

        // Only show message if items are applicable or no specific items selected
        if (empty($applicable_data['items']) && $has_specific_items) {
            return false;
        }

        if ($this->is_item_quantity_condition_met($trigger_data, $applicable_data)) {
            return sprintf(
                __('%s discount has been applied%s', 'wc-cart-manager'),
                $discount_label,
                $has_specific_items ? ' to selected items' : ''
            );
        }

        $remaining = $trigger_data['value'] - $applicable_data['total_quantity'];
        return sprintf(
            __('Add %d more %sitem(s) to get %s discount!', 'wc-cart-manager'),
            $remaining,
            $has_specific_items ? 'qualifying ' : '',
            $discount_label
        );
    }

    /**
     * Process item quantity trigger rules
     */
    private function process_item_quantity_rules($cart, $rules)
    {
        $applied_discounts = array();

        foreach ($rules as $rule) {
            // Skip disabled rules
            if (isset($rule['status']) && $rule['status'] !== 'enabled') {
                continue;
            }

            // Get trigger and discount data
            $trigger_data = $this->get_trigger_type_data($rule);
            $discount_data = $this->get_discount_data($rule);

            if (!$trigger_data || !$discount_data) {
                continue;
            }

            // Get applicable items
            $applicable_data = $this->get_applicable_items($cart, $rule);

            // Check if conditions are met
            if ($this->is_item_quantity_condition_met($trigger_data, $applicable_data)) {
                $discount_amount = $this->calculate_item_quantity_discount(
                    $discount_data,
                    $applicable_data['total_amount']
                );

                if ($discount_amount > 0) {
                    // Create and add fee
                    $has_specific_items = !empty($trigger_data['products']) || !empty($trigger_data['categories']);
                    $fee = $this->create_discount_fee(
                        $discount_data['label'],
                        $discount_amount,
                        $has_specific_items
                    );

                    $cart->fees_api()->add_fee($fee);

                    // Track applied discount
                    $applied_discounts[] = array(
                        'rule' => $rule,
                        'amount' => $discount_amount,
                        'applicable_items' => $applicable_data['items'],
                        'total_quantity' => $applicable_data['total_quantity'],
                        'total_amount' => $applicable_data['total_amount']
                    );

                    self::$discount_applied = true;
                    self::$applied_rules[] = $rule['id'];
                }
            }
        }

        return $applied_discounts;
    }

    /**
     * Display discount messages
     */
    public function display_discount_messages()
    {
        if (!WC()->cart) {
            return;
        }

        $cart = WC()->cart;
        $rules = get_option('wc_cart_manager_rules', array());
        $messages = array();

        if (!is_array($rules)) {
            return;
        }

        foreach ($rules as $rule) {
            if (!isset($rule['type']) || $rule['type'] !== 'cart_based') {
                continue;
            }

            $trigger_data = $this->get_trigger_type_data($rule);
            $discount_data = $this->get_discount_data($rule);

            if (!$trigger_data || !$discount_data) {
                continue;
            }

            // Process messages based on trigger type
            if ($trigger_data['type'] === 'cart_total') {
                $cart_total = $cart->get_cart_contents_total();
                if ($cart_total >= $trigger_data['value']) {
                    $messages[] = sprintf(
                        __('%s discount has been applied', 'wc-cart-manager'),
                        $discount_data['label']
                    );
                } else {
                    $remaining = $trigger_data['value'] - $cart_total;
                    $messages[] = sprintf(
                        __('Spend %s more to get %s discount!', 'wc-cart-manager'),
                        wc_price($remaining),
                        $discount_data['label']
                    );
                }
            } elseif ($trigger_data['type'] === 'item_quantity') {
                $applicable_data = $this->get_applicable_items($cart, $rule);
                $message = $this->get_item_quantity_message(
                    $trigger_data,
                    $applicable_data,
                    $discount_data['label']
                );

                if ($message) {
                    $messages[] = $message;
                }
            }
        }

        if (!empty($messages)) {
            echo '<div class="wc-cart-manager-messages">';
            foreach ($messages as $message) {
                echo '<div class="wc-cart-manager-message">' . wp_kses_post($message) . '</div>';
            }
            echo '</div>';
        }
    }

    /**
     * Process cart total trigger rules
     */
    private function process_cart_total_rules($cart, $rules)
    {
        $cart_total = floatval($cart->get_cart_contents_total());
        $applied_discounts = array();

        foreach ($rules as $rule) {
            // Skip disabled rules
            if (isset($rule['status']) && $rule['status'] !== 'enabled') {
                continue;
            }

            $trigger_value = floatval($rule['trigger']['value']);
            $discount_type = $rule['discount']['type'];
            $discount_value = floatval($rule['discount']['value']);

            // Check if cart total meets the requirement
            if ($cart_total >= $trigger_value) {
                $discount_amount = 0;

                // Calculate discount
                if ($discount_type === 'percentage') {
                    $discount_amount = round(($cart_total * $discount_value / 100), 2);
                } else {
                    $discount_amount = min($discount_value, $cart_total);
                }

                if ($discount_amount > 0) {
                    // Create label
                    $label = ($discount_type === 'percentage' ? $discount_value . '%' : wc_price($discount_value)) . ' Discount';

                    // Add fee
                    $fee = (object) array(
                        'id' => uniqid('cart_total_discount_'),
                        'name' => $label,
                        'amount' => -$discount_amount,
                        'tax_class' => '',
                        'taxable' => false,
                        'tax_data' => array(),
                        'tax' => 0,
                        'total' => -$discount_amount
                    );

                    $cart->fees_api()->add_fee($fee);
                    $applied_discounts[] = array(
                        'rule' => $rule,
                        'amount' => $discount_amount
                    );

                    self::$discount_applied = true;
                }
            }
        }

        return $applied_discounts;
    }

    /**
     * Apply cart discounts
     */
    public function apply_cart_discounts($cart)
    {
        if ($this->is_calculating || (is_admin() && !defined('DOING_AJAX'))) {
            return;
        }

        $this->is_calculating = true;

        // Clear all fees
        $cart->fees_api()->set_fees();

        // Get all rules
        $all_rules = get_option('wc_cart_manager_rules', array());
        if (!is_array($all_rules) || empty($all_rules)) {
            $this->is_calculating = false;
            return;
        }

        // Reset tracking variables
        self::$discount_applied = false;
        self::$current_discounts = array();
        self::$applied_rules = array();

        // Separate rules by trigger type
        $cart_total_rules = array();
        $item_quantity_rules = array();

        foreach ($all_rules as $rule) {
            if (!isset($rule['type'], $rule['trigger'], $rule['discount'])) {
                continue;
            }

            if ($rule['trigger']['type'] === 'cart_total') {
                $cart_total_rules[] = $rule;
            } elseif ($rule['trigger']['type'] === 'item_quantity') {
                $item_quantity_rules[] = $rule;
            }
        }

        $applied_discounts = array();

        // Process cart total rules if any exist
        if (!empty($cart_total_rules)) {
            $cart_total_discounts = $this->process_cart_total_rules($cart, $cart_total_rules);
            $applied_discounts = array_merge($applied_discounts, $cart_total_discounts);
        }

        // Process item quantity rules if any exist
        if (!empty($item_quantity_rules)) {
            $item_quantity_discounts = $this->process_item_quantity_rules($cart, $item_quantity_rules);
            $applied_discounts = array_merge($applied_discounts, $item_quantity_discounts);
        }

        // Update discount tracking
        if (!empty($applied_discounts)) {
            foreach ($applied_discounts as $discount) {
                self::$current_discounts[] = array(
                    'type' => $discount['rule']['discount']['type'],
                    'value' => $discount['rule']['discount']['value'],
                    'amount' => $discount['amount'],
                    'trigger_type' => $discount['rule']['trigger']['type'],
                    'products' => isset($discount['rule']['trigger']['products']) ? $discount['rule']['trigger']['products'] : array(),
                    'categories' => isset($discount['rule']['trigger']['categories']) ? $discount['rule']['trigger']['categories'] : array()
                );
            }
        }

        $this->is_calculating = false;
    }

    public function apply_discount_rules($cart)
    {
        if (is_admin() && !defined('DOING_AJAX')) {
            return;
        }

        if (did_action('woocommerce_before_calculate_totals') >= 2) {
            return;
        }

        $rules = get_option('wc_cart_manager_rules', array());
        if (empty($rules)) {
            return;
        }

        foreach ($rules as $rule) {
            // Skip disabled rules
            if (isset($rule['status']) && $rule['status'] !== 'enabled') {
                continue;
            }

            if ($rule['type'] === 'cart_based') {
                $trigger_data = $this->get_trigger_type_data($rule);
                $applicable_data = $this->get_applicable_items($cart, $rule);

                if ($trigger_data['type'] === 'cart_total') {
                    $this->process_cart_total_rules($cart, array($rule));
                } elseif ($trigger_data['type'] === 'item_quantity') {
                    $this->process_item_quantity_rules($cart, array($rule));
                }
            }
        }
    }
}

// Initialize frontend
new Cart_Manager_Frontend();
