import { render } from "@wordpress/element";
import App from "./App";
import "./index.css";

// Render the App component into the WordPress admin page
const rootElement = document.getElementById("wc-cart-manager-admin");
if (rootElement) {
  render(<App />, rootElement);
}
console.log("Testing wp-scripts start!");
