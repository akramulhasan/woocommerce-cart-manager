const API_URL = "/wp-json/wc-cart-manager/v1/rules";

export const getRules = async () => {
  const response = await fetch(API_URL);
  return await response.json();
};

export const saveRule = async (rule) => {
  const method = rule.id ? "PUT" : "POST";
  await fetch(API_URL, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rule),
  });
};

export const deleteRule = async (id) => {
  await fetch(`${API_URL}/${id}`, { method: "DELETE" });
};
