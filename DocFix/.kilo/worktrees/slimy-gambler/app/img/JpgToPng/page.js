"use client";

import { useEffect, useRef } from "react";
import { mountJpgToPng } from "../../../utils/img/JpgToPng/JpgToPng";
import "../../../utils/img/JpgToPng/JpgToPng.css";

export default function JpgToPngPage() {
  const ref = useRef(null);

  useEffect(() => mountJpgToPng(ref.current), []);

  return <div ref={ref} className="tool-page" />;
}