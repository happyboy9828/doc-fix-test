import { initLoremIpsumGenerator } from "../utility/tool.js";
import "../utility/tool.css";

export function renderToolPage() {
  const pageContainer = document.createElement("div");
  pageContainer.id = "lorem-ipsum-app";

  setTimeout(() => {
    initLoremIpsumGenerator("lorem-ipsum-app");
  }, 0);

  return pageContainer;
}