import { __ } from "@wordpress/i18n";
import {
  Card,
  CardHeader,
  CardBody,
  TabPanel,
  Button,
  TextControl,
} from "@wordpress/components";
import DiscountRuleForm from "./components/DiscountRuleForm";
import RulesTable from "./components/RulesTable";
import { useState, useEffect } from "@wordpress/element";
import "./App.css";

function App() {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
      // Log the nonce for debugging (temporary)
      console.log("Using nonce:", wcCartManagerAdmin.apiNonce);

      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          // Add REST API specific headers
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin", // Important for cookies/nonce
        body: JSON.stringify(ruleData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Server error status:", response.status);
        console.error("Server error details:", data);

        // Handle specific error cases
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
      return data;
    } catch (error) {
      console.error("Error saving rule:", error);
      return {
        error: __("Error creating rule. Please try again.", "wc-cart-manager"),
      };
    }
  };

  const handleUpdateRule = async (updatedRule) => {
    try {
      // For status updates
      if (updatedRule && updatedRule.id && updatedRule.status) {
        await fetchRules();
        return true;
      }

      // For full rule updates
      if (!updatedRule || !updatedRule.id) {
        throw new Error("Invalid rule data");
      }

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

      await fetchRules();
      return true;
    } catch (error) {
      console.error("Error updating rule:", error);
      return {
        error: __("Error updating rule. Please try again.", "wc-cart-manager"),
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
            "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
          },
        }
      );

      if (response.ok) {
        fetchRules(); // Refresh the rules list
      }
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  };

  const tabs = [
    {
      name: "create-rule",
      title: __("Create Rule", "wc-cart-manager"),
      content: (
        <div className="discount-rule-section">
          <h3>{__("Create New Discount Rule", "wc-cart-manager")}</h3>
          <DiscountRuleForm
            onSave={handleSaveRule}
            submitLabel={__("Create Rule", "wc-cart-manager")}
            existingRules={rules}
          />
        </div>
      ),
    },
    {
      name: "rules-list",
      title: __("Active Rules", "wc-cart-manager"),
      content: (
        <div className="discount-rule-section">
          <h3>{__("Active Discount Rules", "wc-cart-manager")}</h3>
          <RulesTable
            rules={rules}
            isLoading={isLoading}
            onDeleteRule={handleDeleteRule}
            onUpdateRule={handleUpdateRule}
          />
        </div>
      ),
    },
    {
      name: "upsells",
      title: __("Upsell Rules", "wc-cart-manager"),
      content: (
        <div className="discount-rule-section">
          <h3>{__("Upsell Rules Configuration", "wc-cart-manager")}</h3>
          <p>
            {__(
              "Upsell configuration will be available in the next update.",
              "wc-cart-manager"
            )}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="wc-cart-manager-admin-app">
      <Card>
        <CardHeader>
          <h2>{__("WooCommerce Cart Manager", "wc-cart-manager")}</h2>
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
    </div>
  );
}

export default App;
