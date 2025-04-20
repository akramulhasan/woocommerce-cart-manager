import { __ } from "@wordpress/i18n";
import {
  Button,
  Spinner,
  Modal,
  TextControl,
  RadioControl,
  FormToggle,
} from "@wordpress/components";
import { useState } from "@wordpress/element";
import DiscountRuleForm from "./DiscountRuleForm";
import "./RulesTable.css";

function RulesTable({
  rules,
  isLoading,
  onDeleteRule,
  onUpdateRule,
  onEditClick,
}) {
  const [editingRule, setEditingRule] = useState(null);

  if (isLoading) {
    return (
      <div className="rules-table-loading">
        <Spinner />
      </div>
    );
  }

  if (!rules.length) {
    return (
      <div className="rules-table-empty">
        <p>{__("No discount rules found.", "wc-cart-manager")}</p>
        <Button
          variant="primary"
          onClick={onEditClick}
          className="create-rule-empty-button"
        >
          {__("Create Your First Rule", "wc-cart-manager")}
        </Button>
      </div>
    );
  }

  const handleEditClick = (rule) => {
    setEditingRule(rule);
  };

  const handleStatusChange = async (ruleId, enabled) => {
    try {
      const response = await fetch(
        `${wcCartManagerAdmin.apiUrl}/rules/${ruleId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          },
          body: JSON.stringify({
            status: enabled ? "enabled" : "disabled",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update rule status");
      }

      const updatedRule = await response.json();

      // Update the local state immediately
      const updatedRules = rules.map((rule) =>
        rule.id === ruleId ? { ...rule, status: updatedRule.status } : rule
      );

      // Call onUpdateRule with the updated rule
      await onUpdateRule(updatedRule);
    } catch (error) {
      console.error("Error updating rule status:", error);
      // Revert the toggle state if the update failed
      const updatedRules = rules.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              status: rule.status === "enabled" ? "disabled" : "enabled",
            }
          : rule
      );
      await onUpdateRule(updatedRules.find((rule) => rule.id === ruleId));
    }
  };

  const handleUpdateRule = async (updatedRule) => {
    try {
      // Check if any changes were made
      const originalRule = rules.find((rule) => rule.id === updatedRule.id);
      if (originalRule) {
        const hasChanges = Object.keys(updatedRule).some((key) => {
          if (key === "trigger" || key === "discount") {
            return Object.keys(updatedRule[key]).some(
              (subKey) =>
                JSON.stringify(updatedRule[key][subKey]) !==
                JSON.stringify(originalRule[key][subKey])
            );
          }
          return (
            JSON.stringify(updatedRule[key]) !==
            JSON.stringify(originalRule[key])
          );
        });

        // If no changes were made, just close the form and return null
        if (!hasChanges) {
          setEditingRule(null);
          return null;
        }
      }

      const result = await onUpdateRule(updatedRule);
      if (result && result.error) {
        return result;
      }
      if (result) {
        setEditingRule(null);
        return result;
      }
      return {
        error: __("Error updating rule. Please try again.", "wc-cart-manager"),
      };
    } catch (error) {
      console.error("Error updating rule:", error);
      return {
        error: __("Error updating rule. Please try again.", "wc-cart-manager"),
      };
    }
  };

  const formatTriggerType = (rule) => {
    if (rule.type === "cart_based") {
      return rule.trigger.type === "cart_total"
        ? __("Cart Total", "wc-cart-manager")
        : __("Item Quantity", "wc-cart-manager");
    }
    return rule.trigger.type;
  };

  const formatAmount = (rule) => {
    if (rule.type === "cart_based") {
      if (rule.trigger.type === "cart_total") {
        return `$${rule.trigger.value}`;
      } else if (rule.trigger.type === "item_quantity") {
        return rule.trigger.value;
      }
    }
    return rule.trigger.value;
  };

  const formatDiscount = (rule) => {
    if (rule.type === "cart_based") {
      return rule.discount.type === "percentage"
        ? `${rule.discount.value}%`
        : `$${rule.discount.value}`;
    }
    return rule.discount.value;
  };

  return (
    <div className="rules-table-wrapper">
      <table className="rules-table">
        <thead>
          <tr>
            <th>{__("Name", "wc-cart-manager")}</th>
            <th>{__("Trigger Type", "wc-cart-manager")}</th>
            <th>{__("Trigger Amount", "wc-cart-manager")}</th>
            <th>{__("Discount", "wc-cart-manager")}</th>
            <th>{__("Message", "wc-cart-manager")}</th>
            <th>{__("Status", "wc-cart-manager")}</th>
            <th>{__("Actions", "wc-cart-manager")}</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{formatTriggerType(rule)}</td>
              <td>{formatAmount(rule)}</td>
              <td>{formatDiscount(rule)}</td>
              <td>{rule.message}</td>
              <td>
                <div className="status-toggle">
                  <FormToggle
                    checked={rule.status !== "disabled"}
                    onChange={() =>
                      handleStatusChange(rule.id, rule.status !== "enabled")
                    }
                  />
                  <span className="status-label">
                    {rule.status === "enabled"
                      ? __("Enabled", "wc-cart-manager")
                      : __("Disabled", "wc-cart-manager")}
                  </span>
                </div>
              </td>
              <td>
                <div className="rule-actions">
                  <Button
                    variant="secondary"
                    onClick={() => handleEditClick(rule)}
                    className="edit-button"
                  >
                    {__("Edit", "wc-cart-manager")}
                  </Button>
                  <Button
                    isDestructive
                    onClick={() => onDeleteRule(rule.id)}
                    className="delete-button"
                  >
                    {__("Delete", "wc-cart-manager")}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingRule && (
        <Modal
          title={__("Edit Discount Rule", "wc-cart-manager")}
          onRequestClose={() => setEditingRule(null)}
          className="edit-rule-modal"
          overlayClassName="edit-rule-modal-overlay"
        >
          <DiscountRuleForm
            onSave={handleUpdateRule}
            initialData={editingRule}
            onCancel={() => setEditingRule(null)}
            submitLabel={__("Update Rule", "wc-cart-manager")}
            existingRules={rules}
          />
        </Modal>
      )}
    </div>
  );
}

export default RulesTable;
