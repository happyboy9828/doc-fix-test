"use client";

import { useEffect, useRef } from "react";
import { createCssMinifier } from "../../../utils/dev-tools/CSSMinifier/CSSMinifier";
import "../../../utils/dev-tools/CSSMinifier/CSSMinifier.css";

export default function CssMinifierPage() {
  const ref = useRef(null);

  useEffect(() => {
    const tool = createCssMinifier(ref.current);
    return () => tool.destroy();
  }, []);

  return <div ref={ref} className="tool-page" />;
}
