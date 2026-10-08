"use client";

import { useEffect, useRef } from "react";
import { createHtmlMinifier } from "../../../utils/dev-tools/HTMLMinifier/HTMLMinifier";
import "../../../utils/dev-tools/HTMLMinifier/HTMLMinifier.css";

export default function HtmlMinifierPage() {
  const ref = useRef(null);

  useEffect(() => {
    const tool = createHtmlMinifier(ref.current);
    return () => tool.destroy();
  }, []);

  return <div ref={ref} className="tool-page" />;
}
