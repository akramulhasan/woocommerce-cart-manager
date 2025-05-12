jQuery(function ($) {
  var updateTimer;

  function updateCartMessages() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(function () {
      $.ajax({
        url: wcCartManager.ajax_url,
        type: "POST",
        data: {
          action: "update_cart_messages",
          nonce: wcCartManager.nonce,
        },
        success: function (response) {
          if (response.success) {
            
            // Update messages
            if (response.data.messages) {
              // Check if we're on a Cart Block page
              const isCartBlock =
                document.querySelector(".wp-block-woocommerce-cart") !== null;

              if (isCartBlock) {
                // Handle Cart Block
                const cartBlock = document.querySelector(
                  ".wp-block-woocommerce-cart"
                );
                let messageContainer = cartBlock.querySelector(
                  ".wc-cart-manager-messages"
                );

                if (!messageContainer) {
                  messageContainer = document.createElement("div");
                  messageContainer.className = "wc-cart-manager-messages";
                  cartBlock.insertBefore(
                    messageContainer,
                    cartBlock.firstChild
                  );
                }

                messageContainer.innerHTML = response.data.messages;
              } else {
                // Handle Classic Cart
                if ($(".wc-cart-manager-messages").length) {
                  $(".wc-cart-manager-messages").replaceWith(
                    response.data.messages
                  );
                } else {
                  $(".woocommerce-cart-form").before(response.data.messages);
                }
              }
            } else {
              $(".wc-cart-manager-messages").remove();
            }

            // Force cart totals update
            $( document.body ).trigger( 'updated_cart_totals' );
            // $(document.body).trigger("wc_fragment_refresh");
            // if (typeof wc_cart_fragments_params !== "undefined") {
            //   $(document.body).trigger("wc_fragment_refresh");
            // }
          }
        },
      });
    }, 300);
  }

  // Initial update when page loads
  $(document).ready(updateCartMessages);

  // Update on cart changes
  $(document.body).on(
    "updated_cart_totals updated_checkout removed_from_cart added_to_cart",
    updateCartMessages
  );

  // Update on quantity changes
  $(".woocommerce-cart-form, .wp-block-woocommerce-cart").on(
    "change",
    "input.qty",
    function () {
      var $form = $(this).closest("form");
      var $button = $form.find("button[name='update_cart']");
      var $row = $(this).closest("tr, .wc-block-cart-item");
      var cart_item_key = $row.attr("data-cart_item_key");
      var quantity = $(this).val();

      // Disable the update button
      $button.prop("disabled", true);

      // Send AJAX request to update quantity
      $.ajax({
        url: wc_cart_params.ajax_url,
        type: "POST",
        data: {
          action: "woocommerce_update_cart",
          cart_item_key: cart_item_key,
          quantity: quantity,
          security: wc_cart_params.update_cart_nonce,
        },
        success: function (response) {
          if (response.success) {
            // Update cart fragments
            // $(document.body).trigger("wc_fragment_refresh");
            $( document.body ).trigger( 'updated_cart_totals' );
            // Update cart messages
            updateCartMessages();
          }
        },
        complete: function () {
          // Re-enable the update button
          $button.prop("disabled", false);
        },
      });
    }
  );

  // Update after form submission
  // $(".woocommerce-cart-form, .wp-block-woocommerce-cart").on(
  //   "submit",
  //   function () {
  //     setTimeout(updateCartMessages, 1000);
  //   }
  // );

  // // Additional handler for cart fragments refresh
  // $(document.body).on("wc_fragments_refreshed", function () {
  //   updateCartMessages();
  // });

  // Function to update cart message
  function updateCartMessage() {
    $.ajax({
      url: wcCartManager.ajaxUrl,
      type: "POST",
      data: {
        action: "update_cart_message",
        nonce: wcCartManager.nonce,
      },
      success: function (response) {
        if (response.success && response.data) {
          const messageElement = $("#wc-cart-message");
          if (messageElement.length) {
            if (response.data.message) {
              messageElement.html(response.data.message).show();
            } else {
              messageElement.hide();
            }
          } else if (response.data.message) {
            // If message element doesn't exist, create it
            $(".woocommerce-cart-form").before(
              '<div class="wc-cart-message" id="wc-cart-message">' +
                response.data.message +
                "</div>"
            );
          }
        }
      },
    });
  }

  // Update message when cart is updated
  $(document.body).on("updated_cart_totals updated_checkout", function () {
    updateCartMessage();
  });

  // Update message when cart quantities are changed
  $(document.body).on("change", "input.qty", function () {
    const updateCartButton = $('button[name="update_cart"]');
    if (updateCartButton.length) {
      updateCartButton.prop("disabled", false);
      // Don't trigger click automatically, let WooCommerce handle it
    }
  });
});
