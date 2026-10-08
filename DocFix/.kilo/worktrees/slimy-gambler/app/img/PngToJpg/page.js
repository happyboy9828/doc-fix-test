"use client";

import { useEffect, useRef } from "react";
import { mountPngToJpgTool } from "../../../utils/img/PngToJpg/PngToJpg";
import "../../../utils/img/PngToJpg/PngToJpg.css";

export default function PngToJpgPage() {
  const ref = useRef(null);

  useEffect(() => mountPngToJpgTool(ref.current), []);

  return <div ref={ref} className="tool-page" />;
}