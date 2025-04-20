import { __ } from "@wordpress/i18n";
import {
  SelectControl,
  ColorPicker,
  Button,
  Notice,
} from "@wordpress/components";
import { useState, useEffect } from "@wordpress/element";
import "./SettingsPanel.css";

function SettingsPanel() {
  const [settings, setSettings] = useState({
    message_position: "above_cart",
    colors: {
      background: "#f8f8f8",
      text: "#333333",
      border: "#dddddd",
      success: "#28a745",
      threshold: "#ffc107",
    },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/settings`, {
        headers: {
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${wcCartManagerAdmin.apiUrl}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": wcCartManagerAdmin.apiNonce,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save settings");
      }

      setSuccess(__("Settings saved successfully!", "wc-cart-manager"));
    } catch (error) {
      console.error("Error saving settings:", error);
      setError(
        error.message ||
          __("Error saving settings. Please try again.", "wc-cart-manager")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleColorChange = (colorKey, value) => {
    setSettings((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: value,
      },
    }));
  };

  return (
    <div className="settings-panel">
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

      <div className="settings-section">
        <h3>{__("Message Display Settings", "wc-cart-manager")}</h3>
        <SelectControl
          label={__("Message Position", "wc-cart-manager")}
          value={settings.message_position}
          options={[
            {
              label: __("Above Cart (Classic & Block)", "wc-cart-manager"),
              value: "above_cart",
            },
            {
              label: __("Above Cart Totals (Classic Only)", "wc-cart-manager"),
              value: "above_totals",
            },
            {
              label: __("Below Cart Totals (Classic Only)", "wc-cart-manager"),
              value: "below_totals",
            },
            {
              label: __("Inside Cart Totals (Classic Only)", "wc-cart-manager"),
              value: "inside_totals",
            },
          ]}
          onChange={(value) =>
            setSettings((prev) => ({ ...prev, message_position: value }))
          }
        />
      </div>

      <div className="settings-section">
        <h3>{__("Color Settings", "wc-cart-manager")}</h3>
        <div className="color-settings-grid">
          <div className="color-setting">
            <label>{__("Background Color", "wc-cart-manager")}</label>
            <ColorPicker
              color={settings.colors.background}
              onChange={(value) => handleColorChange("background", value)}
            />
          </div>
          <div className="color-setting">
            <label>{__("Text Color", "wc-cart-manager")}</label>
            <ColorPicker
              color={settings.colors.text}
              onChange={(value) => handleColorChange("text", value)}
            />
          </div>
          <div className="color-setting">
            <label>{__("Border Color", "wc-cart-manager")}</label>
            <ColorPicker
              color={settings.colors.border}
              onChange={(value) => handleColorChange("border", value)}
            />
          </div>
          <div className="color-setting">
            <label>{__("Success Message Color", "wc-cart-manager")}</label>
            <ColorPicker
              color={settings.colors.success}
              onChange={(value) => handleColorChange("success", value)}
            />
          </div>
          <div className="color-setting">
            <label>{__("Threshold Message Color", "wc-cart-manager")}</label>
            <ColorPicker
              color={settings.colors.threshold}
              onChange={(value) => handleColorChange("threshold", value)}
            />
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <Button
          variant="primary"
          onClick={handleSaveSettings}
          isBusy={isSaving}
          disabled={isSaving}
        >
          {isSaving
            ? __("Saving...", "wc-cart-manager")
            : __("Save Settings", "wc-cart-manager")}
        </Button>
      </div>
    </div>
  );
}

export default SettingsPanel;
