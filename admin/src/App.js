import { __ } from "@wordpress/i18n";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Modal,
  TabPanel,
} from "@wordpress/components";
import DiscountRuleForm from "./components/DiscountRuleForm";
import RulesTable from "./components/RulesTable";
import SettingsPanel from "./components/SettingsPanel";
import { useState, useEffect } from "@wordpress/element";
import "./App.css";

function App() {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/rules`, {
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      });

      if (!response.ok) {
        console.error("Error fetching rules. Status:", response.status);
        const errorData = await response.json();
        console.error("Error details:", errorData);
        setRules([]);
        return;
      }

      const data = await response.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching rules:", error);
      setRules([]);
    }
    setIsLoading(false);
  };

  const handleSaveRule = async (ruleData) => {
    try {
      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
        body: JSON.stringify(ruleData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error status:", response.status);
        console.error("Server error details:", data);

        if (response.status === 401 || response.status === 403) {
          return {
            error: __(
              "You don't have permission to perform this action. Please refresh the page and try again.",
              "wc-cart-manager"
            ),
          };
        }

        return {
          error:
            data.message ||
            __("Error creating rule. Please try again.", "wc-cart-manager"),
        };
      }

      await fetchRules(); // Refresh the rules list
      setIsCreatingRule(false); // Close the modal
      return data;
    } catch (error) {
      console.error("Error saving rule:", error);
      return {
        error: __("Error creating rule. Please try again.", "wc-cart-manager"),
      };
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      const response = await fetch(
        `${wcCartManagerAdmin.apiUrl}/rules/${ruleId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete rule");
      }

      await fetchRules(); // Refresh the rules list
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  };

  const handleUpdateRule = async (updatedRule) => {
    try {
      const response = await fetch(
        `${wcCartManagerAdmin.apiUrl}/rules/${updatedRule.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          },
          body: JSON.stringify(updatedRule),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update rule");
      }

      await fetchRules(); // Refresh the rules list
      return await response.json();
    } catch (error) {
      console.error("Error updating rule:", error);
      return {
        error: __("Error updating rule. Please try again.", "wc-cart-manager"),
      };
    }
  };

  const tabs = [
    {
      name: "discount-rules",
      title: __("Discount Rules", "wc-cart-manager"),
      content: (
        <div className="rules-section">
          <h3>{__("Active Discount Rules", "wc-cart-manager")}</h3>
          <RulesTable
            rules={rules}
            isLoading={isLoading}
            onDeleteRule={handleDeleteRule}
            onUpdateRule={handleUpdateRule}
            onEditClick={() => setIsCreatingRule(true)}
          />
        </div>
      ),
    },
    {
      name: "upsell-rules",
      title: __("Upsell Rules", "wc-cart-manager"),
      content: (
        <div className="upsell-section">
          <div className="upsell-pro-message">
            <p>
              {__(
                "Upsell Rules will be available in PRO version.",
                "wc-cart-manager"
              )}
            </p>
          </div>
        </div>
      ),
    },
    {
      name: "settings",
      title: __("Settings", "wc-cart-manager"),
      content: <SettingsPanel />,
    },
  ];

  return (
    <div className="wc-cart-manager-admin-app">
      <Card>
        <CardHeader>
          <h2>{__("WooCommerce Cart Manager", "wc-cart-manager")}</h2>
          <Button
            variant="primary"
            onClick={() => setIsCreatingRule(true)}
            className="create-rule-button"
          >
            {__("Create New Rule", "wc-cart-manager")}
          </Button>
        </CardHeader>
        <CardBody>
          <TabPanel
            className="wc-cart-manager-tabs"
            activeClass="active-tab"
            tabs={tabs}
          >
            {(tab) => tab.content}
          </TabPanel>
        </CardBody>
      </Card>

      {isCreatingRule && (
        <Modal
          title={__("Create New Discount Rule", "wc-cart-manager")}
          onRequestClose={() => setIsCreatingRule(false)}
          className="create-rule-modal"
          overlayClassName="create-rule-modal-overlay"
        >
          <DiscountRuleForm
            onSave={handleSaveRule}
            onCancel={() => setIsCreatingRule(false)}
            submitLabel={__("Create Rule", "wc-cart-manager")}
            existingRules={rules}
          />
        </Modal>
      )}
    </div>
  );
}

export default App;
