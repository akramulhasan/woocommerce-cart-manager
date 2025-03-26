import { __ } from "@wordpress/i18n";
import {
  Button,
  Spinner,
  Modal,
  TextControl,
  RadioControl,
} from "@wordpress/components";
import { useState } from "@wordpress/element";
import DiscountRuleForm from "./DiscountRuleForm";
import "./RulesTable.css";

function RulesTable({ rules, isLoading, onDeleteRule, onUpdateRule }) {
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
      </div>
    );
  }

  const handleEditClick = (rule) => {
    setEditingRule(rule);
  };

  const handleUpdateRule = async (updatedRule) => {
    try {
      const result = await onUpdateRule(updatedRule);
      if (result && result.error) {
        // Don't close modal if there's an error
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

  const formatAmount = (rule) => {
    if (rule.type === "cart_based") {
      return `$${rule.trigger.value}`;
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
            <th>{__("Trigger Amount", "wc-cart-manager")}</th>
            <th>{__("Discount", "wc-cart-manager")}</th>
            <th>{__("Message", "wc-cart-manager")}</th>
            <th>{__("Actions", "wc-cart-manager")}</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.name}</td>
              <td>{formatAmount(rule)}</td>
              <td>{formatDiscount(rule)}</td>
              <td>{rule.message}</td>
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
