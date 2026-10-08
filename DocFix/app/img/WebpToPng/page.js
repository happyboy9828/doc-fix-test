"use client";

import { useEffect, useRef } from "react";
import { mountWebpToPng } from "../../../utils/img/WebpToPng/WebpToPng";
import "../../../utils/img/WebpToPng/WebpToPng.css";

export default function WebpToPngPage() {
  const ref = useRef(null);

  useEffect(() => mountWebpToPng(ref.current), []);

  return <div ref={ref} className="tool-page" />;
}