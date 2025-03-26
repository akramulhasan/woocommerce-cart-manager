import React from "react";

const CampaignTable = ({ rules, onDelete, onEdit }) => {
  return (
    <div>
      <h2>Available Discount Rules</h2>
      {rules.length === 0 ? (
        <p>No rules created yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Condition</th>
              <th>Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.label}</td>
                <td>{rule.type}</td>
                <td>
                  {rule.type === "buy_x_get_y"
                    ? `Buy ${rule.condition.buy_x}, Get ${rule.condition.get_y}`
                    : `Min Cart Total: ${rule.condition.cart_total}`}
                </td>
                <td>{rule.type === "free_shipping" ? "N/A" : rule.value}</td>
                <td>
                  <button onClick={() => onEdit(rule)}>Edit</button>
                  <button onClick={() => onDelete(rule.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CampaignTable;
