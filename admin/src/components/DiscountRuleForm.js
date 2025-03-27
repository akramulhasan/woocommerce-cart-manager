import { __ } from "@wordpress/i18n";
import {
  Button,
  TextControl,
  SelectControl,
  RadioControl,
  Notice,
  FormTokenField,
} from "@wordpress/components";
import { useState, useEffect } from "@wordpress/element";
import "./DiscountRuleForm.css";

function DiscountRuleForm({
  onSave,
  initialData,
  onCancel,
  submitLabel,
  existingRules = [],
}) {
  const [formData, setFormData] = useState({
    name: "",
    type: "cart_based",
    trigger: {
      type: "cart_total",
      value: "",
      products: [],
      categories: [],
    },
    discount: {
      type: "percentage",
      value: "",
    },
    message: "",
  });

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  // Load initial data when editing
  useEffect(() => {
    if (initialData) {
      if (initialData.type === "minimum_spend") {
        setFormData({
          name: initialData.name,
          type: "cart_based",
          trigger: {
            type: "cart_total",
            value: initialData.amount,
            products: [],
            categories: [],
          },
          discount: {
            type: "percentage",
            value: initialData.discount,
          },
          message: initialData.message,
        });
      } else {
        setFormData(initialData);
      }
    }
  }, [initialData]);

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/products`, {
        headers: {
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
        },
      });
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
    setIsLoadingProducts(false);
  };

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/categories`, {
        headers: {
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
        },
      });
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
    setIsLoadingCategories(false);
  };

  const checkForConflictingRules = (submissionData) => {
    const newTriggerValue = parseFloat(submissionData.trigger.value);
    const newTriggerType = submissionData.trigger.type;

    // Check for conflicts with existing rules
    const conflictingRule = existingRules.find((rule) => {
      // Skip comparing with self when editing
      if (initialData && rule.id === initialData.id) {
        return false;
      }

      // Check if rule types match
      if (rule.trigger.type !== newTriggerType) {
        return false;
      }

      // For cart total triggers, check for exact match
      if (
        newTriggerType === "cart_total" &&
        parseFloat(rule.trigger.value) === newTriggerValue
      ) {
        return true;
      }

      // For quantity triggers, check for overlapping products/categories
      if (
        newTriggerType === "item_quantity" &&
        parseFloat(rule.trigger.value) === newTriggerValue
      ) {
        const ruleProducts = rule.trigger.products || [];
        const ruleCategories = rule.trigger.categories || [];
        const newProducts = submissionData.trigger.products || [];
        const newCategories = submissionData.trigger.categories || [];

        // If both rules apply to all products (no specific selections)
        if (
          ruleProducts.length === 0 &&
          ruleCategories.length === 0 &&
          newProducts.length === 0 &&
          newCategories.length === 0
        ) {
          return true;
        }

        // Check for overlapping products or categories
        const hasOverlappingProducts = ruleProducts.some((product) =>
          newProducts.includes(product)
        );
        const hasOverlappingCategories = ruleCategories.some((category) =>
          newCategories.includes(category)
        );

        return hasOverlappingProducts || hasOverlappingCategories;
      }

      return false;
    });

    return conflictingRule;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.name || !formData.trigger.value || !formData.discount.value) {
      setError(__("Please fill in all required fields.", "wc-cart-manager"));
      return;
    }

    // Convert to numeric values
    const submissionData = {
      ...formData,
      trigger: {
        ...formData.trigger,
        value: parseFloat(formData.trigger.value),
      },
      discount: {
        ...formData.discount,
        value: parseFloat(formData.discount.value),
      },
    };

    // If editing, include the rule ID
    if (initialData && initialData.id) {
      submissionData.id = initialData.id;
    }

    // Check for conflicting rules before submission
    const conflictingRule = checkForConflictingRules(submissionData);
    if (conflictingRule) {
      const triggerType =
        submissionData.trigger.type === "cart_total"
          ? __("cart total", "wc-cart-manager")
          : __("quantity", "wc-cart-manager");

      setError(
        sprintf(
          __(
            "A rule with the same %s trigger (%s) already exists.",
            "wc-cart-manager"
          ),
          triggerType,
          submissionData.trigger.value
        )
      );
      return;
    }

    try {
      const response = await onSave(submissionData);

      if (response && response.error) {
        setError(response.error);
        return;
      }

      if (response) {
        setSuccess(
          initialData
            ? __("Rule updated successfully!", "wc-cart-manager")
            : __("Rule created successfully!", "wc-cart-manager")
        );

        if (!initialData) {
          // Reset form only for new rules
          setFormData({
            name: "",
            type: "cart_based",
            trigger: {
              type: "cart_total",
              value: "",
              products: [],
              categories: [],
            },
            discount: {
              type: "percentage",
              value: "",
            },
            message: "",
          });
        }

        if (onCancel) {
          onCancel(); // Close the modal for updates
        }
      }
    } catch (err) {
      console.error("Rule operation error:", err);
      setError(
        initialData
          ? __("Error updating rule. Please try again.", "wc-cart-manager")
          : __("Error creating rule. Please try again.", "wc-cart-manager")
      );
    }
  };

  const handleInputChange = (key, value) => {
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="discount-rule-form">
      {error && (
        <Notice status="error" isDismissible={false}>
          {error}
        </Notice>
      )}
      {success && (
        <Notice status="success" isDismissible={false}>
          {success}
        </Notice>
      )}

      <TextControl
        label={__("Rule Name", "wc-cart-manager")}
        value={formData.name}
        onChange={(value) => handleInputChange("name", value)}
        help={__("Enter a name for this rule", "wc-cart-manager")}
        required
      />

      <SelectControl
        label={__("Trigger Type", "wc-cart-manager")}
        value={formData.trigger.type}
        options={[
          {
            label: __("Cart Total", "wc-cart-manager"),
            value: "cart_total",
          },
          {
            label: __("Item Quantity", "wc-cart-manager"),
            value: "item_quantity",
          },
        ]}
        onChange={(value) => handleInputChange("trigger.type", value)}
      />

      <TextControl
        label={
          formData.trigger.type === "cart_total"
            ? __("Minimum Spend", "wc-cart-manager")
            : __("Minimum Quantity", "wc-cart-manager")
        }
        type="number"
        value={formData.trigger.value}
        onChange={(value) => handleInputChange("trigger.value", value)}
        help={
          formData.trigger.type === "cart_total"
            ? __(
                "Minimum cart total required to apply discount",
                "wc-cart-manager"
              )
            : __(
                "Minimum quantity of selected items required",
                "wc-cart-manager"
              )
        }
        required
      />

      {formData.trigger.type === "item_quantity" && (
        <>
          <FormTokenField
            label={__("Apply to Products", "wc-cart-manager")}
            value={formData.trigger.products}
            suggestions={products.map((p) => p.name)}
            onChange={(tokens) => handleInputChange("trigger.products", tokens)}
            help={__("Select products this rule applies to", "wc-cart-manager")}
          />

          <FormTokenField
            label={__("Apply to Categories", "wc-cart-manager")}
            value={formData.trigger.categories}
            suggestions={categories.map((c) => c.name)}
            onChange={(tokens) =>
              handleInputChange("trigger.categories", tokens)
            }
            help={__(
              "Select categories this rule applies to",
              "wc-cart-manager"
            )}
          />
        </>
      )}

      <div className="discount-type-section">
        <RadioControl
          label={__("Discount Type", "wc-cart-manager")}
          selected={formData.discount.type}
          options={[
            {
              label: __("Percentage Discount", "wc-cart-manager"),
              value: "percentage",
            },
            {
              label: __("Fixed Amount Discount", "wc-cart-manager"),
              value: "fixed",
            },
          ]}
          onChange={(value) => handleInputChange("discount.type", value)}
        />
      </div>

      <TextControl
        label={
          formData.discount.type === "percentage"
            ? __("Discount Percentage", "wc-cart-manager")
            : __("Discount Amount", "wc-cart-manager")
        }
        type="number"
        value={formData.discount.value}
        onChange={(value) => handleInputChange("discount.value", value)}
        help={
          formData.discount.type === "percentage"
            ? __(
                "Enter percentage value (e.g., 10 for 10% off)",
                "wc-cart-manager"
              )
            : __("Enter fixed discount amount", "wc-cart-manager")
        }
        required
      />

      <TextControl
        label={__("Message", "wc-cart-manager")}
        value={formData.message}
        onChange={(value) => handleInputChange("message", value)}
        help={__("Custom message to display on cart page", "wc-cart-manager")}
      />

      <div className="form-actions">
        <Button variant="primary" type="submit">
          {submitLabel || __("Create Rule", "wc-cart-manager")}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            {__("Cancel", "wc-cart-manager")}
          </Button>
        )}
      </div>
    </form>
  );
}

export default DiscountRuleForm;
