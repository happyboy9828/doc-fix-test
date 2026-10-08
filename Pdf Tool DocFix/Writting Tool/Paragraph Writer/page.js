import { initParagraphWriter } from "../utility/tool.js";
import "../utility/tool.css";

export function renderToolPage() {
  const pageContainer = document.createElement("div");
  pageContainer.id = "paragraph-writer-app";

  setTimeout(() => {
    initParagraphWriter("paragraph-writer-app");
  }, 0);

  return pageContainer;
}