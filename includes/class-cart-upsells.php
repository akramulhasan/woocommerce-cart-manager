<?php
class Cart_Upsells
{

    public function __construct()
    {
        add_action('woocommerce_cart_collaterals', [$this, 'display_cart_upsells']);
    }

    // Display product upsells or cross-sells.
    public function display_cart_upsells()
    {
        $cart_items = WC()->cart->get_cart();
        echo '<h3>You May Also Like</h3><div class="upsell-products">';
        foreach ($cart_items as $item) {
            $related_products = wc_get_related_products($item['product_id'], 3); // Fetch 3 products.
            foreach ($related_products as $related_id) {
                $product = wc_get_product($related_id);
                echo '<div class="upsell-item">';
                echo '<a href="' . get_permalink($related_id) . '">' . $product->get_image() . '</a>';
                echo '<p>' . $product->get_name() . '</p>';
                echo '<p>$' . $product->get_price() . '</p>';
                echo '</div>';
            }
        }
        echo '</div>';
    }
}
